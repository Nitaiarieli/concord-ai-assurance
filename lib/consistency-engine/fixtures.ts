import type { EdgeContract, NodeRecord, Policy } from "./model.ts";

export const prototypePolicy: Policy = {
  policyVersion: "policy-v1",
  allowedFreshnessClasses: ["current", "bounded_stale"],
  boundedStalenessMs: 300_000,
  inferredDependencyThreshold: 0.8,
  maxDeferredCostMinor: 50,
  maxFanout: 1_000,
  maxSccIterations: 32,
};

function node(input: Partial<NodeRecord> & Pick<NodeRecord, "canonicalId" | "tenantId" | "type">): NodeRecord {
  const authoritative = input.authoritative ?? false;
  return {
    authoritative: false,
    sourceVersion: null,
    effectiveStateHash: "initial",
    validityState: "VERIFIED_CURRENT",
    policyClass: "strict",
    securityEpoch: 1,
    provenance: authoritative ? [] : [
      { authority: "docs", objectId: "doc:strategy", sourceVersion: { authority: "docs", sequence: 1, opaque: "v1" }, evidenceType: "observed" },
      { authority: "work", objectId: "work:access-policy", sourceVersion: { authority: "work", sequence: 1, opaque: "v1" }, evidenceType: "observed" },
    ],
    requiredAuthorities: ["docs", "work"],
    dependencyCoverage: "complete",
    lastVerifiedAt: "2026-08-21T00:00:00.000Z",
    ...input,
  };
}

function edge(input: Partial<EdgeContract> & Pick<EdgeContract, "edgeId" | "tenantId" | "source" | "destination" | "dependencyType">): EdgeContract {
  return {
    propagationPredicate: { kind: "always" },
    deltaTransform: { kind: "identity" },
    verificationContract: { mode: "retrieval_and_authorization", boundaryId: "simulated-retrieval", requireConsumedVersions: true },
    criticality: "normal",
    evidenceType: "observed",
    confidence: 1,
    edgeVersion: 1,
    behaviorOnUnknown: "propagate",
    monotonic: true,
    ...input,
  };
}

export function createPrototypeGraph(tenantId = "tenant-prototype") {
  const nodes: NodeRecord[] = [
    node({ canonicalId: "doc:strategy", tenantId, type: "authoritative_document", authoritative: true, sourceVersion: { authority: "docs", sequence: 1, opaque: "v1" }, requiredAuthorities: ["docs"] }),
    node({ canonicalId: "work:access-policy", tenantId, type: "authoritative_work_item", authoritative: true, sourceVersion: { authority: "work", sequence: 1, opaque: "v1" }, requiredAuthorities: ["work"] }),
    node({ canonicalId: "permission:strategy", tenantId, type: "permission_object", policyClass: "hard_security" }),
    node({ canonicalId: "chunk:strategy:1", tenantId, type: "chunk" }),
    node({ canonicalId: "vector:strategy:1", tenantId, type: "vector" }),
    node({ canonicalId: "retrieval:strategy", tenantId, type: "retrieval_view", policyClass: "hard_security" }),
    node({ canonicalId: "artifact:strategy-answer", tenantId, type: "ai_artifact", policyClass: "hard_security" }),
  ];
  const edges: EdgeContract[] = [
    edge({ edgeId: "e-doc-chunk", tenantId, source: "doc:strategy", destination: "chunk:strategy:1", dependencyType: "derivation", propagationPredicate: { kind: "metadata_field_intersection", fields: ["body", "title"] } }),
    edge({ edgeId: "e-chunk-vector", tenantId, source: "chunk:strategy:1", destination: "vector:strategy:1", dependencyType: "indexing" }),
    edge({ edgeId: "e-vector-retrieval", tenantId, source: "vector:strategy:1", destination: "retrieval:strategy", dependencyType: "retrieval" }),
    edge({ edgeId: "e-retrieval-artifact", tenantId, source: "retrieval:strategy", destination: "artifact:strategy-answer", dependencyType: "retrieval" }),
    edge({ edgeId: "e-work-permission", tenantId, source: "work:access-policy", destination: "permission:strategy", dependencyType: "authorization", propagationPredicate: { kind: "security_only" }, deltaTransform: { kind: "permission_epoch" }, criticality: "security" }),
    edge({ edgeId: "e-permission-retrieval", tenantId, source: "permission:strategy", destination: "retrieval:strategy", dependencyType: "authorization", deltaTransform: { kind: "permission_epoch" }, criticality: "security" }),
  ];
  return { nodes, edges };
}

export function addInferredDependency(graph: ReturnType<typeof createPrototypeGraph>, confidence = 0.4) {
  graph.edges.push(edge({
    edgeId: "e-inferred-doc-artifact",
    tenantId: graph.nodes[0].tenantId,
    source: "doc:strategy",
    destination: "artifact:strategy-answer",
    dependencyType: "declared_semantic",
    evidenceType: "inferred",
    confidence,
    behaviorOnUnknown: "propagate",
  }));
  return graph;
}
