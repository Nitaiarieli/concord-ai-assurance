import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditEvents,
  canonicalChangeEvents,
  connectorDefinitions,
  connectorDeployments,
  connectorRuntimeCredentials,
  reconciliationRuns,
} from "@/db/schema";
import {
  connectorCatalog,
  createRuntimeEnrollmentToken,
  hashRuntimeToken,
  normalizeCanonicalChangeEvent,
  validateConnectorDeploymentInput,
  validateRuntimeHeartbeat,
} from "@/lib/integration-platform";
import { getOrCreateOrganization, registerApplication, requireOrganizationMembership } from "@/lib/workspace";

function now() {
  return new Date().toISOString();
}

async function ensureConnectorCatalog() {
  const db = await getDb();
  const timestamp = now();
  for (const connector of connectorCatalog) {
    const values = {
      id: `connector-${connector.key}`,
      connectorKey: connector.key,
      displayName: connector.name,
      connectorClass: connector.connectorClass,
      phase: connector.phase,
      readiness: connector.readiness,
      certification: connector.certification,
      manifestVersion: 1,
      capabilityManifestJson: JSON.stringify({
        eventMode: connector.eventMode,
        authMode: connector.authMode,
        capabilities: connector.capabilities,
      }),
      limitationsJson: JSON.stringify(connector.limitations),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.insert(connectorDefinitions).values(values).onConflictDoUpdate({
      target: connectorDefinitions.connectorKey,
      set: {
        displayName: values.displayName,
        connectorClass: values.connectorClass,
        phase: values.phase,
        readiness: values.readiness,
        certification: values.certification,
        capabilityManifestJson: values.capabilityManifestJson,
        limitationsJson: values.limitationsJson,
        updatedAt: timestamp,
      },
    });
  }
}

export async function getIntegrationPlatformSnapshot(email: string, displayName: string) {
  const organizationId = await getOrCreateOrganization(email, displayName);
  await ensureConnectorCatalog();
  const db = await getDb();
  const definitions = await db.select().from(connectorDefinitions).orderBy(asc(connectorDefinitions.id));
  const deployments = await db
    .select({
      id: connectorDeployments.id,
      connectorKey: connectorDefinitions.connectorKey,
      connectorName: connectorDefinitions.displayName,
      connectorClass: connectorDefinitions.connectorClass,
      displayName: connectorDeployments.displayName,
      externalInstanceKey: connectorDeployments.externalInstanceKey,
      environment: connectorDeployments.environment,
      deploymentMode: connectorDeployments.deploymentMode,
      status: connectorDeployments.status,
      healthStatus: connectorDeployments.healthStatus,
      runtimeVersion: connectorDeployments.runtimeVersion,
      policyVersion: connectorDeployments.policyVersion,
      lastHeartbeatAt: connectorDeployments.lastHeartbeatAt,
      createdAt: connectorDeployments.createdAt,
    })
    .from(connectorDeployments)
    .innerJoin(connectorDefinitions, eq(connectorDeployments.connectorDefinitionId, connectorDefinitions.id))
    .where(eq(connectorDeployments.organizationId, organizationId))
    .orderBy(desc(connectorDeployments.createdAt));
  const events = await db
    .select({ id: canonicalChangeEvents.id, processingStatus: canonicalChangeEvents.processingStatus })
    .from(canonicalChangeEvents)
    .where(eq(canonicalChangeEvents.organizationId, organizationId));
  const reconciliations = await db
    .select({ id: reconciliationRuns.id, status: reconciliationRuns.status, verificationClassification: reconciliationRuns.verificationClassification })
    .from(reconciliationRuns)
    .where(eq(reconciliationRuns.organizationId, organizationId));
  return {
    catalog: definitions.map((definition) => ({
      ...definition,
      capabilityManifest: JSON.parse(definition.capabilityManifestJson),
      limitations: JSON.parse(definition.limitationsJson),
    })),
    deployments,
    metrics: {
      deployments: deployments.length,
      healthyRuntimes: deployments.filter((deployment) => deployment.healthStatus === "healthy").length,
      canonicalEvents: events.length,
      fullyVerified: reconciliations.filter((run) => run.verificationClassification === "fully_verified").length,
      unresolved: reconciliations.filter((run) => !new Set(["completed", "unsupported"]).has(run.status)).length,
    },
  };
}

export async function createIntegrationDeployment(email: string, rawInput: unknown) {
  const membership = await requireOrganizationMembership(email);
  if (!new Set(["owner", "admin", "integration_admin"]).has(membership.role)) throw new Error("Integration administrator permission is required.");
  const input = validateConnectorDeploymentInput(rawInput);
  await ensureConnectorCatalog();
  const db = await getDb();
  const [definition] = await db
    .select()
    .from(connectorDefinitions)
    .where(eq(connectorDefinitions.connectorKey, input.connectorKey))
    .limit(1);
  if (!definition) throw new Error("Connector definition is unavailable.");

  let connectedApplicationId: string | null = null;
  let applicationInstanceId: string | null = null;
  if (input.environment === "production") {
    if (input.connectorKey !== "bookstack" && input.connectorKey !== "zulip") {
      throw new Error("Production enrollment is currently limited to BookStack and Zulip foundation connectors.");
    }
    const application = await registerApplication(email, {
      provider: input.connectorKey,
      displayName: input.displayName,
      externalInstanceKey: input.externalInstanceKey,
      environment: "production",
    });
    connectedApplicationId = application.id;
    applicationInstanceId = application.instanceId;
  }

  const timestamp = now();
  const deploymentId = crypto.randomUUID();
  const runtimeToken = createRuntimeEnrollmentToken();
  const tokenHash = await hashRuntimeToken(runtimeToken);
  const credentialId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(connectorDeployments).values({
    id: deploymentId,
    organizationId: membership.organizationId,
    connectorDefinitionId: definition.id,
    connectedApplicationId,
    applicationInstanceId,
    displayName: input.displayName,
    externalInstanceKey: input.externalInstanceKey,
    environment: input.environment,
    deploymentMode: input.deploymentMode,
    status: "enrollment_pending",
    healthStatus: "awaiting_runtime",
    secretReference: `customer-vault://connector/${deploymentId}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  try {
    await db.insert(connectorRuntimeCredentials).values({
      id: credentialId,
      organizationId: membership.organizationId,
      connectorDeploymentId: deploymentId,
      tokenHash,
      tokenPrefix: runtimeToken.slice(0, 12),
      status: "active",
      expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } catch (error) {
    await db.delete(connectorDeployments).where(eq(connectorDeployments.id, deploymentId));
    throw error;
  }
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: membership.organizationId,
    actorEmail: email.toLowerCase(),
    action: "connector.deployment_created",
    entityType: "connector_deployment",
    entityId: deploymentId,
    afterJson: JSON.stringify({ connectorKey: input.connectorKey, environment: input.environment, deploymentMode: input.deploymentMode, status: "enrollment_pending" }),
    occurredAt: timestamp,
  });
  return {
    deployment: { id: deploymentId, connectorKey: input.connectorKey, displayName: input.displayName, status: "enrollment_pending", healthStatus: "awaiting_runtime" },
    enrollment: { runtimeToken, expiresAt, displayedOnce: true },
  };
}

async function runtimeContext(rawToken: string) {
  const tokenHash = await hashRuntimeToken(rawToken);
  const db = await getDb();
  const [context] = await db
    .select({
      credentialId: connectorRuntimeCredentials.id,
      credentialStatus: connectorRuntimeCredentials.status,
      expiresAt: connectorRuntimeCredentials.expiresAt,
      organizationId: connectorRuntimeCredentials.organizationId,
      deploymentId: connectorDeployments.id,
      deploymentStatus: connectorDeployments.status,
    })
    .from(connectorRuntimeCredentials)
    .innerJoin(connectorDeployments, eq(connectorRuntimeCredentials.connectorDeploymentId, connectorDeployments.id))
    .where(eq(connectorRuntimeCredentials.tokenHash, tokenHash))
    .limit(1);
  if (!context || context.credentialStatus !== "active") throw new Error("Runtime credential is invalid or revoked.");
  if (context.expiresAt && Date.parse(context.expiresAt) <= Date.now()) throw new Error("Runtime credential has expired.");
  return context;
}

export async function recordRuntimeHeartbeat(rawToken: string, rawInput: unknown) {
  const context = await runtimeContext(rawToken);
  const heartbeat = validateRuntimeHeartbeat(rawInput);
  const timestamp = now();
  const db = await getDb();
  await db.update(connectorDeployments).set({
    status: "runtime_enrolled",
    healthStatus: heartbeat.health,
    runtimeVersion: heartbeat.runtimeVersion,
    policyVersion: heartbeat.policyVersion,
    lastHeartbeatAt: timestamp,
    updatedAt: timestamp,
  }).where(and(eq(connectorDeployments.id, context.deploymentId), eq(connectorDeployments.organizationId, context.organizationId)));
  await db.update(connectorRuntimeCredentials).set({ lastUsedAt: timestamp, updatedAt: timestamp }).where(eq(connectorRuntimeCredentials.id, context.credentialId));
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: context.organizationId,
    actorEmail: `runtime:${context.deploymentId}`,
    action: "connector.runtime_heartbeat",
    entityType: "connector_deployment",
    entityId: context.deploymentId,
    afterJson: JSON.stringify({ health: heartbeat.health, runtimeVersion: heartbeat.runtimeVersion, policyVersion: heartbeat.policyVersion, queueDepth: heartbeat.queueDepth, errorClassification: heartbeat.errorClassification }),
    occurredAt: timestamp,
  });
  return { accepted: true, deploymentId: context.deploymentId, receivedAt: timestamp };
}

export async function ingestCanonicalChangeEvent(rawToken: string, rawInput: unknown) {
  const context = await runtimeContext(rawToken);
  const event = normalizeCanonicalChangeEvent(rawInput);
  const db = await getDb();
  const [existing] = await db
    .select({ id: canonicalChangeEvents.id, processingStatus: canonicalChangeEvents.processingStatus })
    .from(canonicalChangeEvents)
    .where(and(eq(canonicalChangeEvents.connectorDeploymentId, context.deploymentId), eq(canonicalChangeEvents.sourceEventId, event.sourceEventId)))
    .limit(1);
  if (existing) return { accepted: true, duplicate: true, eventId: existing.id, processingStatus: existing.processingStatus };

  const timestamp = now();
  const eventId = crypto.randomUUID();
  const reconciliationId = crypto.randomUUID();
  await db.insert(canonicalChangeEvents).values({
    id: eventId,
    organizationId: context.organizationId,
    connectorDeploymentId: context.deploymentId,
    sourceEventId: event.sourceEventId,
    sourceObjectType: event.sourceObjectType,
    sourceObjectId: event.sourceObjectId,
    changeType: event.changeType,
    eventTimestamp: event.eventTimestamp,
    observedTimestamp: event.observedTimestamp,
    actorIdentityRef: event.actorIdentityRef,
    previousStateRef: event.previousStateRef,
    newStateRef: event.newStateRef,
    affectedIdentitiesJson: JSON.stringify(event.affectedIdentities),
    affectedGroupsJson: JSON.stringify(event.affectedGroups),
    permissionDeltaJson: JSON.stringify(event.permissionDelta),
    contentValidityDeltaJson: JSON.stringify(event.contentValidityDelta),
    sourceSystemVersion: event.sourceSystemVersion,
    correlationId: event.correlationId,
    evidenceReferencesJson: JSON.stringify(event.evidenceReferences),
    processingStatus: "detected",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  try {
    await db.insert(reconciliationRuns).values({
      id: reconciliationId,
      organizationId: context.organizationId,
      connectorDeploymentId: context.deploymentId,
      canonicalChangeEventId: eventId,
      idempotencyKey: `${context.deploymentId}:${event.sourceEventId}`,
      status: "detected",
      repairAction: "pending_policy",
      approvalState: "not_evaluated",
      destinationReadback: "not_started",
      verificationClassification: "unverified",
      startedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } catch (error) {
    await db.delete(canonicalChangeEvents).where(eq(canonicalChangeEvents.id, eventId));
    throw error;
  }
  await db.update(connectorRuntimeCredentials).set({ lastUsedAt: timestamp, updatedAt: timestamp }).where(eq(connectorRuntimeCredentials.id, context.credentialId));
  return { accepted: true, duplicate: false, eventId, reconciliationId, processingStatus: "detected" };
}
