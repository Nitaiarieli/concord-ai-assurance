export const connectorClasses = ["source", "identity_policy", "transformation", "destination_verification"] as const;
export type ConnectorClass = (typeof connectorClasses)[number];

export const connectorCatalog = [
  {
    key: "bookstack",
    name: "BookStack",
    connectorClass: "source" as const,
    phase: "Phase 1 · first implementation",
    readiness: "enrollment_open" as const,
    certification: "Foundation contract",
    eventMode: "Webhooks + periodic reconciliation",
    authMode: "Customer-vault API token",
    capabilities: ["Structured knowledge", "Roles and permissions", "Change observation", "Search read-back"],
    limitations: ["Live customer tenant validation required", "Behavioral verification requires a registered retrieval API"],
  },
  {
    key: "zulip",
    name: "Zulip",
    connectorClass: "source" as const,
    phase: "Phase 1 · second implementation",
    readiness: "enrollment_open" as const,
    certification: "Foundation contract",
    eventMode: "Realtime event queue + reconciliation",
    authMode: "Customer-vault bot or API credential",
    capabilities: ["Messages and topics", "Private channels", "Groups and roles", "Realtime events"],
    limitations: ["Metadata and content visibility must be tested separately", "Live customer tenant validation required"],
  },
  {
    key: "linear",
    name: "Linear",
    connectorClass: "source" as const,
    phase: "Phase 2 · black-box SaaS validation",
    readiness: "planned" as const,
    certification: "Not implemented",
    eventMode: "Supported API + webhooks + reconciliation",
    authMode: "Customer-authorized OAuth or API key",
    capabilities: ["Issues and projects", "Teams and members", "Webhooks", "API reconciliation"],
    limitations: ["Permission and audit coverage depends on authorized product interfaces", "Enrollment opens after the Phase 1 reuse gate"],
  },
  {
    key: "pinecone",
    name: "Pinecone",
    connectorClass: "destination_verification" as const,
    phase: "Phase 1 · destination contract",
    readiness: "contract_ready" as const,
    certification: "MVP contract",
    eventMode: "Policy-controlled destination operations",
    authMode: "Customer-vault API key",
    capabilities: ["Stable vector identifiers", "Metadata update", "Delete or quarantine", "Destination read-back"],
    limitations: ["Not a source connector", "Customer retrieval verification remains a separate required layer"],
  },
  {
    key: "redis",
    name: "Redis",
    connectorClass: "destination_verification" as const,
    phase: "Phase 1 · destination contract",
    readiness: "contract_ready" as const,
    certification: "MVP contract",
    eventMode: "Policy-controlled cache operations",
    authMode: "Customer-vault credential",
    capabilities: ["Stable cache keys", "Invalidate", "Delete", "Destination read-back"],
    limitations: ["Not a source connector", "Cluster and managed-service variants require conformance testing"],
  },
] as const;

export type ConnectorKey = (typeof connectorCatalog)[number]["key"];

export const canonicalChangeTypes = [
  "CONTENT_CREATED",
  "CONTENT_UPDATED",
  "CONTENT_DELETED",
  "CONTENT_RESTORED",
  "CONTENT_MOVED",
  "ACCESS_GRANTED",
  "ACCESS_REVOKED",
  "ROLE_CHANGED",
  "GROUP_MEMBERSHIP_CHANGED",
  "USER_DEACTIVATED",
  "CONTAINER_PRIVACY_CHANGED",
] as const;

export type CanonicalChangeType = (typeof canonicalChangeTypes)[number];

const forbiddenPayloadKeys = new Set([
  "content",
  "document",
  "documentBody",
  "embedding",
  "embeddings",
  "credential",
  "credentials",
  "token",
  "secret",
  "secretValue",
  "permissionSnapshot",
  "fullEvidence",
  "evidencePayload",
]);

function requiredString(value: unknown, field: string, max = 180) {
  if (typeof value !== "string") throw new Error(`${field} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`${field} must contain 1 to ${max} characters.`);
  return normalized;
}

function optionalString(value: unknown, field: string, max = 180) {
  if (value === undefined || value === null || value === "") return null;
  return requiredString(value, field, max);
}

function stringArray(value: unknown, field: string, maxItems = 100) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${field} must be an array with at most ${maxItems} entries.`);
  return value.map((item, index) => requiredString(item, `${field}[${index}]`, 240));
}

function safeObject(value: unknown, field: string, maxBytes = 4_000) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  const serialized = JSON.stringify(value);
  if (serialized.length > maxBytes) throw new Error(`${field} is too large.`);
  return value as Record<string, unknown>;
}

export function assertMinimizedOperationalPayload(value: unknown) {
  const visit = (current: unknown): string | null => {
    if (!current || typeof current !== "object") return null;
    if (Array.isArray(current)) {
      for (const item of current) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    for (const [key, nested] of Object.entries(current as Record<string, unknown>)) {
      if (forbiddenPayloadKeys.has(key)) return key;
      const found = visit(nested);
      if (found) return found;
    }
    return null;
  };
  const forbidden = visit(value);
  if (forbidden) throw new Error(`Payload contains prohibited customer-data field: ${forbidden}.`);
}

export function validateConnectorDeploymentInput(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Integration deployment input is required.");
  const value = input as Record<string, unknown>;
  const connectorKey = requiredString(value.connectorKey, "connectorKey", 40) as ConnectorKey;
  const connector = connectorCatalog.find((item) => item.key === connectorKey);
  if (!connector) throw new Error("Unsupported connector.");
  if (connector.readiness !== "enrollment_open") throw new Error(`${connector.name} enrollment is not open in this phase.`);
  const environment = requiredString(value.environment, "environment", 20);
  if (!new Set(["production", "staging", "sandbox"]).has(environment)) throw new Error("Unsupported environment.");
  const deploymentMode = requiredString(value.deploymentMode, "deploymentMode", 30);
  if (!new Set(["customer_cloud", "private_network", "air_gapped_preparation"]).has(deploymentMode)) throw new Error("Unsupported deployment mode.");
  return {
    connector,
    connectorKey,
    displayName: requiredString(value.displayName, "displayName", 100),
    externalInstanceKey: requiredString(value.externalInstanceKey, "externalInstanceKey", 180),
    environment: environment as "production" | "staging" | "sandbox",
    deploymentMode: deploymentMode as "customer_cloud" | "private_network" | "air_gapped_preparation",
  };
}

export function validateRuntimeHeartbeat(input: unknown) {
  assertMinimizedOperationalPayload(input);
  if (!input || typeof input !== "object") throw new Error("Heartbeat payload is required.");
  const value = input as Record<string, unknown>;
  const health = requiredString(value.health, "health", 20);
  if (!new Set(["healthy", "degraded", "offline_pending"]).has(health)) throw new Error("Unsupported health state.");
  const queueDepth = value.queueDepth === undefined ? 0 : Number(value.queueDepth);
  if (!Number.isSafeInteger(queueDepth) || queueDepth < 0 || queueDepth > 1_000_000) {
    throw new Error("queueDepth must be an integer between 0 and 1,000,000.");
  }
  return {
    health: health as "healthy" | "degraded" | "offline_pending",
    runtimeVersion: requiredString(value.runtimeVersion, "runtimeVersion", 60),
    policyVersion: optionalString(value.policyVersion, "policyVersion", 60),
    queueDepth,
    errorClassification: optionalString(value.errorClassification, "errorClassification", 80),
  };
}

export function normalizeCanonicalChangeEvent(input: unknown) {
  assertMinimizedOperationalPayload(input);
  if (!input || typeof input !== "object") throw new Error("Canonical event payload is required.");
  const value = input as Record<string, unknown>;
  const changeType = requiredString(value.changeType, "changeType", 60) as CanonicalChangeType;
  if (!canonicalChangeTypes.includes(changeType)) throw new Error("Unsupported canonical change type.");
  const eventTimestamp = requiredString(value.eventTimestamp, "eventTimestamp", 60);
  if (Number.isNaN(Date.parse(eventTimestamp))) throw new Error("eventTimestamp must be an ISO timestamp.");
  const observedTimestamp = optionalString(value.observedTimestamp, "observedTimestamp", 60) ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(observedTimestamp))) throw new Error("observedTimestamp must be an ISO timestamp.");
  return {
    sourceEventId: requiredString(value.eventId, "eventId", 180),
    sourceObjectType: requiredString(value.sourceObjectType, "sourceObjectType", 80),
    sourceObjectId: requiredString(value.sourceObjectId, "sourceObjectId", 240),
    changeType,
    eventTimestamp,
    observedTimestamp,
    actorIdentityRef: optionalString(value.actorIdentityRef, "actorIdentityRef", 240),
    previousStateRef: optionalString(value.previousStateRef, "previousStateRef", 240),
    newStateRef: optionalString(value.newStateRef, "newStateRef", 240),
    affectedIdentities: stringArray(value.affectedIdentities, "affectedIdentities"),
    affectedGroups: stringArray(value.affectedGroups, "affectedGroups"),
    permissionDelta: safeObject(value.permissionDelta, "permissionDelta"),
    contentValidityDelta: safeObject(value.contentValidityDelta, "contentValidityDelta"),
    sourceSystemVersion: optionalString(value.sourceSystemVersion, "sourceSystemVersion", 80),
    correlationId: requiredString(value.correlationId, "correlationId", 180),
    evidenceReferences: stringArray(value.evidenceReferences, "evidenceReferences", 50),
  };
}

export function createRuntimeEnrollmentToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `cnr_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function hashRuntimeToken(token: string) {
  if (!token.startsWith("cnr_") || token.length !== 52) throw new Error("Invalid runtime token format.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
