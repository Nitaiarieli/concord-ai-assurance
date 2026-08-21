export const validityStates = [
  "VERIFIED_CURRENT",
  "BOUNDED_STALE",
  "PENDING",
  "INVALID",
  "BLOCKED_SECURITY",
  "VERIFICATION_FAILED",
  "UNKNOWN",
] as const;

export type ValidityState = (typeof validityStates)[number];
export type EvidenceType = "observed" | "declared" | "inferred";
export type UnknownBehavior = "propagate" | "block" | "allow_bounded_stale";
export type PropagationDecision = "PROPAGATE" | "PRUNE" | "UNKNOWN";
export type SecurityClassification = "normal" | "sensitive" | "security_revocation" | "security_deletion";
export type Criticality = "low" | "normal" | "high" | "security";

export type SourceVersion = {
  authority: string;
  sequence: number;
  opaque: string;
};

export type ProvenanceAtom = {
  authority: string;
  objectId: string;
  sourceVersion: SourceVersion;
  evidenceType: EvidenceType;
  edgeId?: string;
};

export type NodeRecord = {
  canonicalId: string;
  tenantId: string;
  type: "authoritative_document" | "authoritative_work_item" | "permission_object" | "chunk" | "vector" | "retrieval_view" | "ai_artifact";
  authoritative: boolean;
  sourceVersion: SourceVersion | null;
  effectiveStateHash: string;
  validityState: ValidityState;
  policyClass: "hard_security" | "strict" | "bounded_staleness";
  securityEpoch: number;
  provenance: ProvenanceAtom[];
  requiredAuthorities: string[];
  dependencyCoverage: "complete" | "partial" | "unknown";
  lastVerifiedAt: string | null;
};

export type PredicateSpec =
  | { kind: "always" }
  | { kind: "security_only" }
  | { kind: "mutation_in"; mutationTypes: MutationType[] }
  | { kind: "metadata_field_intersection"; fields: string[] }
  | { kind: "effective_hash_change" }
  | { kind: "connector_declared"; declarationId: string };

export type TransformSpec =
  | { kind: "identity" }
  | { kind: "project_metadata"; fields: string[] }
  | { kind: "permission_epoch" }
  | { kind: "invalidate_only" };

export type VerificationContract = {
  mode: "destination_readback" | "retrieval" | "authorization" | "retrieval_and_authorization";
  boundaryId: string;
  requireConsumedVersions: boolean;
};

export type EdgeContract = {
  edgeId: string;
  tenantId: string;
  source: string;
  destination: string;
  dependencyType: "derivation" | "authorization" | "indexing" | "cache" | "retrieval" | "declared_semantic";
  propagationPredicate: PredicateSpec;
  deltaTransform: TransformSpec;
  verificationContract: VerificationContract;
  criticality: Criticality;
  evidenceType: EvidenceType;
  confidence: number | null;
  edgeVersion: number;
  behaviorOnUnknown: UnknownBehavior;
  monotonic: boolean;
};

export const mutationTypes = [
  "CONTENT_CREATED",
  "CONTENT_UPDATED",
  "CONTENT_DELETED",
  "ACCESS_GRANTED",
  "ACCESS_REVOKED",
  "ROLE_CHANGED",
  "GROUP_MEMBERSHIP_CHANGED",
  "USER_DEACTIVATED",
  "SCHEMA_CHANGED",
] as const;

export type MutationType = (typeof mutationTypes)[number];

export type NormalizedEvent = {
  eventId: string;
  tenantId: string;
  authority: string;
  objectId: string;
  mutationType: MutationType;
  beforeVersion: SourceVersion | null;
  afterVersion: SourceVersion;
  logicalTimestamp: number;
  causalParents: string[];
  idempotencyKey: string;
  payloadHash: string;
  securityClassification: SecurityClassification;
  metadata: Record<string, string | number | boolean | null>;
};

export type CostVector = {
  computeUnits: number;
  networkCalls: number;
  verificationCalls: number;
  estimatedMinorUnits: number;
};

export type Policy = {
  policyVersion: string;
  allowedFreshnessClasses: Array<"current" | "bounded_stale">;
  boundedStalenessMs: number;
  inferredDependencyThreshold: number;
  maxDeferredCostMinor: number;
  maxFanout: number;
  maxSccIterations: number;
};

export type RemediationAction = {
  actionId: string;
  eventId: string;
  idempotencyKey: string;
  nodeId: string;
  kind: "BLOCK" | "INVALIDATE" | "REBUILD" | "REAUTHORIZE" | "VERIFY" | "FULL_SCC_RECOMPUTE";
  dependsOn: string[];
  mandatory: boolean;
  cost: CostVector;
  status: "planned" | "executed" | "verified" | "failed";
};

export type ImpactRecord = {
  nodeId: string;
  incomingEdgeId: string | null;
  decision: PropagationDecision;
  reason: string;
  transformedDeltaHash: string;
  effectiveStateHash: string;
  distance: number;
};

export type ProofObject = {
  proofId: string;
  tenantId: string;
  eventId: string;
  artifactId: string;
  policyVersion: string;
  securityEpoch: number;
  authoritativeVersions: SourceVersion[];
  actionReceipts: string[];
  verificationContract: VerificationContract;
  retrievalObserved: boolean;
  authorizationObserved: boolean;
  consumedVersionsObserved: boolean;
  result: "verified" | "failed";
  verifiedAt: string;
  proofHash: string;
};

export type EventClassification = "new" | "duplicate" | "stale" | "concurrent" | "out_of_order";

export type ProcessResult = {
  eventId: string;
  classification: EventClassification;
  affectedNodes: string[];
  blockedNodes: string[];
  impacts: ImpactRecord[];
  actions: RemediationAction[];
  proofs: ProofObject[];
  overPropagationCount: number;
  prunedCount: number;
  predicateEvaluations: number;
  sccIterations: number;
  externalCalls: number;
};

export interface ConsistencyStore {
  getNode(nodeId: string): Promise<NodeRecord | null>;
  putNode(node: NodeRecord): Promise<void>;
  listNodes(tenantId: string): Promise<NodeRecord[]>;
  listEdges(tenantId: string): Promise<EdgeContract[]>;
  outgoingEdges(tenantId: string, nodeId: string): Promise<EdgeContract[]>;
  appendEvent(event: NormalizedEvent): Promise<"appended" | "duplicate_event_id" | "duplicate_idempotency_key">;
  listEvents(tenantId: string): Promise<NormalizedEvent[]>;
  hasCausalParent(tenantId: string, eventId: string): Promise<boolean>;
  putAction(action: RemediationAction): Promise<void>;
  getActionByIdempotencyKey(key: string): Promise<RemediationAction | null>;
  listActionsForEvent(eventId: string): Promise<RemediationAction[]>;
  putProof(proof: ProofObject): Promise<void>;
  latestProof(tenantId: string, artifactId: string): Promise<ProofObject | null>;
  getSecurityEpoch(tenantId: string): Promise<number>;
  advanceSecurityEpoch(tenantId: string): Promise<number>;
}

export interface DestinationBoundary {
  execute(action: RemediationAction, event: NormalizedEvent, node: NodeRecord): Promise<{ receipt: string; externalCalls: number }>;
  verify(contract: VerificationContract, event: NormalizedEvent, node: NodeRecord): Promise<{
    retrievalObserved: boolean;
    authorizationObserved: boolean;
    consumedVersionsObserved: boolean;
    externalCalls: number;
  }>;
}
