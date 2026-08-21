import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  consistencyEngineActions,
  consistencyEngineEdges,
  consistencyEngineEvents,
  consistencyEngineNodes,
  consistencyEngineProofs,
  consistencyEngineSecurityEpochs,
} from "@/db/schema";
import type { ConsistencyStore, EdgeContract, NodeRecord, NormalizedEvent, ProofObject, RemediationAction } from "./model.ts";

function now() { return new Date().toISOString(); }
function parse<T>(value: string) { return JSON.parse(value) as T; }

function nodeFromRow(row: typeof consistencyEngineNodes.$inferSelect): NodeRecord {
  return {
    canonicalId: row.id,
    tenantId: row.organizationId,
    type: row.nodeType as NodeRecord["type"],
    authoritative: row.authoritative,
    sourceVersion: row.sourceVersionJson ? parse(row.sourceVersionJson) : null,
    effectiveStateHash: row.effectiveStateHash,
    validityState: row.validityState as NodeRecord["validityState"],
    policyClass: row.policyClass as NodeRecord["policyClass"],
    securityEpoch: row.securityEpoch,
    provenance: parse(row.provenanceJson),
    requiredAuthorities: parse(row.requiredAuthoritiesJson),
    dependencyCoverage: row.dependencyCoverage as NodeRecord["dependencyCoverage"],
    lastVerifiedAt: row.lastVerifiedAt,
  };
}

function edgeFromRow(row: typeof consistencyEngineEdges.$inferSelect): EdgeContract {
  return parse(row.contractJson);
}

export class D1ConsistencyStore implements ConsistencyStore {
  async getNode(nodeId: string) {
    const db = await getDb();
    const [row] = await db.select().from(consistencyEngineNodes).where(eq(consistencyEngineNodes.id, nodeId)).limit(1);
    return row ? nodeFromRow(row) : null;
  }

  async putNode(node: NodeRecord) {
    const db = await getDb();
    const timestamp = now();
    const values = {
      id: node.canonicalId,
      organizationId: node.tenantId,
      nodeType: node.type,
      authoritative: node.authoritative,
      sourceVersionJson: node.sourceVersion ? JSON.stringify(node.sourceVersion) : null,
      effectiveStateHash: node.effectiveStateHash,
      validityState: node.validityState,
      policyClass: node.policyClass,
      securityEpoch: node.securityEpoch,
      provenanceJson: JSON.stringify(node.provenance),
      requiredAuthoritiesJson: JSON.stringify(node.requiredAuthorities),
      dependencyCoverage: node.dependencyCoverage,
      lastVerifiedAt: node.lastVerifiedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.insert(consistencyEngineNodes).values(values).onConflictDoUpdate({
      target: consistencyEngineNodes.id,
      set: {
        sourceVersionJson: values.sourceVersionJson,
        effectiveStateHash: values.effectiveStateHash,
        validityState: values.validityState,
        policyClass: values.policyClass,
        securityEpoch: values.securityEpoch,
        provenanceJson: values.provenanceJson,
        requiredAuthoritiesJson: values.requiredAuthoritiesJson,
        dependencyCoverage: values.dependencyCoverage,
        lastVerifiedAt: values.lastVerifiedAt,
        updatedAt: timestamp,
      },
    });
  }

  async putEdge(edge: EdgeContract) {
    const db = await getDb();
    const timestamp = now();
    await db.insert(consistencyEngineEdges).values({
      id: edge.edgeId,
      organizationId: edge.tenantId,
      sourceNodeId: edge.source,
      destinationNodeId: edge.destination,
      dependencyType: edge.dependencyType,
      contractJson: JSON.stringify(edge),
      edgeVersion: edge.edgeVersion,
      evidenceType: edge.evidenceType,
      confidence: edge.confidence,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).onConflictDoUpdate({ target: consistencyEngineEdges.id, set: { contractJson: JSON.stringify(edge), edgeVersion: edge.edgeVersion, evidenceType: edge.evidenceType, confidence: edge.confidence, updatedAt: timestamp } });
  }

  async listNodes(tenantId: string) {
    const db = await getDb();
    return (await db.select().from(consistencyEngineNodes).where(eq(consistencyEngineNodes.organizationId, tenantId)).orderBy(asc(consistencyEngineNodes.id))).map(nodeFromRow);
  }

  async listEdges(tenantId: string) {
    const db = await getDb();
    return (await db.select().from(consistencyEngineEdges).where(eq(consistencyEngineEdges.organizationId, tenantId)).orderBy(asc(consistencyEngineEdges.id))).map(edgeFromRow);
  }

  async outgoingEdges(tenantId: string, nodeId: string) {
    const db = await getDb();
    return (await db.select().from(consistencyEngineEdges).where(and(eq(consistencyEngineEdges.organizationId, tenantId), eq(consistencyEngineEdges.sourceNodeId, nodeId))).orderBy(asc(consistencyEngineEdges.id))).map(edgeFromRow);
  }

  async appendEvent(event: NormalizedEvent) {
    const db = await getDb();
    const [byId] = await db.select({ id: consistencyEngineEvents.id }).from(consistencyEngineEvents).where(eq(consistencyEngineEvents.id, event.eventId)).limit(1);
    if (byId) return "duplicate_event_id" as const;
    const [byKey] = await db.select({ id: consistencyEngineEvents.id }).from(consistencyEngineEvents).where(and(eq(consistencyEngineEvents.organizationId, event.tenantId), eq(consistencyEngineEvents.idempotencyKey, event.idempotencyKey))).limit(1);
    if (byKey) return "duplicate_idempotency_key" as const;
    try {
      await db.insert(consistencyEngineEvents).values({
        id: event.eventId,
        organizationId: event.tenantId,
        authority: event.authority,
        objectId: event.objectId,
        mutationType: event.mutationType,
        sourceSequence: event.afterVersion.sequence,
        idempotencyKey: event.idempotencyKey,
        logicalTimestamp: event.logicalTimestamp,
        eventJson: JSON.stringify(event),
        receivedAt: now(),
      });
      return "appended" as const;
    } catch (error) {
      if (/unique/i.test(error instanceof Error ? error.message : String(error))) return "duplicate_idempotency_key" as const;
      throw error;
    }
  }

  async listEvents(tenantId: string) {
    const db = await getDb();
    const rows = await db.select().from(consistencyEngineEvents).where(eq(consistencyEngineEvents.organizationId, tenantId)).orderBy(asc(consistencyEngineEvents.logicalTimestamp), asc(consistencyEngineEvents.id));
    return rows.map((row) => parse<NormalizedEvent>(row.eventJson));
  }

  async hasCausalParent(tenantId: string, eventId: string) {
    const db = await getDb();
    const [row] = await db.select({ id: consistencyEngineEvents.id }).from(consistencyEngineEvents).where(and(eq(consistencyEngineEvents.organizationId, tenantId), eq(consistencyEngineEvents.id, eventId))).limit(1);
    return Boolean(row);
  }

  async putAction(action: RemediationAction) {
    const db = await getDb();
    const node = await this.getNode(action.nodeId);
    if (!node) throw new Error("Cannot persist an action for an unknown node.");
    const timestamp = now();
    await db.insert(consistencyEngineActions).values({
      id: action.actionId,
      organizationId: node.tenantId,
      eventId: action.eventId,
      nodeId: action.nodeId,
      idempotencyKey: action.idempotencyKey,
      status: action.status,
      actionJson: JSON.stringify(action),
      createdAt: timestamp,
      updatedAt: timestamp,
    }).onConflictDoUpdate({ target: consistencyEngineActions.id, set: { status: action.status, actionJson: JSON.stringify(action), updatedAt: timestamp } });
  }

  async getActionByIdempotencyKey(key: string) {
    const db = await getDb();
    const [row] = await db.select().from(consistencyEngineActions).where(eq(consistencyEngineActions.idempotencyKey, key)).limit(1);
    return row ? parse<RemediationAction>(row.actionJson) : null;
  }

  async listActionsForEvent(eventId: string) {
    const db = await getDb();
    const rows = await db.select().from(consistencyEngineActions).where(eq(consistencyEngineActions.eventId, eventId)).orderBy(asc(consistencyEngineActions.id));
    return rows.map((row) => parse<RemediationAction>(row.actionJson));
  }

  async putProof(proof: ProofObject) {
    const db = await getDb();
    await db.insert(consistencyEngineProofs).values({
      id: proof.proofId,
      organizationId: proof.tenantId,
      eventId: proof.eventId,
      artifactId: proof.artifactId,
      policyVersion: proof.policyVersion,
      securityEpoch: proof.securityEpoch,
      result: proof.result,
      proofHash: proof.proofHash,
      proofJson: JSON.stringify(proof),
      verifiedAt: proof.verifiedAt,
    }).onConflictDoUpdate({ target: consistencyEngineProofs.id, set: { result: proof.result, proofHash: proof.proofHash, proofJson: JSON.stringify(proof), verifiedAt: proof.verifiedAt } });
  }

  async latestProof(tenantId: string, artifactId: string) {
    const db = await getDb();
    const [row] = await db.select().from(consistencyEngineProofs).where(and(eq(consistencyEngineProofs.organizationId, tenantId), eq(consistencyEngineProofs.artifactId, artifactId))).orderBy(desc(consistencyEngineProofs.verifiedAt)).limit(1);
    return row ? parse<ProofObject>(row.proofJson) : null;
  }

  async getSecurityEpoch(tenantId: string) {
    const db = await getDb();
    const [row] = await db.select({ currentEpoch: consistencyEngineSecurityEpochs.currentEpoch }).from(consistencyEngineSecurityEpochs).where(eq(consistencyEngineSecurityEpochs.organizationId, tenantId)).limit(1);
    return row?.currentEpoch ?? 0;
  }

  async advanceSecurityEpoch(tenantId: string) {
    const db = await getDb();
    const timestamp = now();
    await db.insert(consistencyEngineSecurityEpochs).values({ organizationId: tenantId, currentEpoch: 0, createdAt: timestamp, updatedAt: timestamp }).onConflictDoNothing();
    await db.update(consistencyEngineSecurityEpochs).set({ currentEpoch: sql`${consistencyEngineSecurityEpochs.currentEpoch} + 1`, updatedAt: timestamp }).where(eq(consistencyEngineSecurityEpochs.organizationId, tenantId));
    return this.getSecurityEpoch(tenantId);
  }
}
