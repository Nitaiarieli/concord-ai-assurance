import { BookStackConnector } from "./bookstack-connector.ts";
import type { ArtifactRegistration, NormalizedSourceObject } from "./connectors.ts";
import { DeterministicConsistencyEngine } from "./engine.ts";
import { prototypePolicy } from "./fixtures.ts";
import { DeterministicLocalIndexDestination } from "./local-index-destination.ts";
import { MemoryConsistencyStore } from "./memory-store.ts";
import { MockBookStackEnvironment } from "./mock-bookstack.ts";
import type { EdgeContract, NodeRecord } from "./model.ts";
import { evaluateServeGuard } from "./serve-guard.ts";

export const bookStackBoundaryScenarios = ["bookstack_content_update", "bookstack_permission_revocation"] as const;
export type BookStackBoundaryScenario = (typeof bookStackBoundaryScenarios)[number];

const tenantId = "tenant-bookstack-poc";

function node(source: NormalizedSourceObject, input: Partial<NodeRecord> & Pick<NodeRecord, "canonicalId" | "type">): NodeRecord {
  const authoritative = input.authoritative ?? false;
  const { canonicalId, type, ...overrides } = input;
  return {
    canonicalId,
    tenantId,
    type,
    authoritative,
    sourceVersion: authoritative ? source.sourceVersion : null,
    effectiveStateHash: source.effectiveStateHash,
    validityState: "VERIFIED_CURRENT",
    policyClass: "hard_security",
    securityEpoch: 1,
    provenance: authoritative ? [] : [{ authority: source.authority, objectId: source.canonicalId, sourceVersion: source.sourceVersion, evidenceType: "observed" }],
    requiredAuthorities: [source.authority],
    dependencyCoverage: "complete",
    lastVerifiedAt: "2026-08-21T10:00:00.000Z",
    ...overrides,
  };
}

function edge(source: NormalizedSourceObject, input: Partial<EdgeContract> & Pick<EdgeContract, "edgeId" | "source" | "destination" | "dependencyType">): EdgeContract {
  return {
    tenantId,
    propagationPredicate: { kind: "always" },
    deltaTransform: { kind: "identity" },
    verificationContract: { mode: "retrieval_and_authorization", boundaryId: "local-index:bookstack-poc", requireConsumedVersions: true },
    criticality: "high",
    evidenceType: "observed",
    confidence: 1,
    edgeVersion: 1,
    behaviorOnUnknown: "propagate",
    monotonic: true,
    ...input,
  };
}

export function createBookStackMvpGraph(source: NormalizedSourceObject) {
  const nodes: NodeRecord[] = [
    node(source, { canonicalId: source.canonicalId, type: "authoritative_document", authoritative: true }),
    node(source, { canonicalId: "permission:bookstack:page:42", type: "permission_object" }),
    node(source, { canonicalId: "chunk:bookstack:page:42:1", type: "chunk" }),
    node(source, { canonicalId: "local-index:bookstack:page:42", type: "vector" }),
    node(source, { canonicalId: "retrieval:bookstack:page:42", type: "retrieval_view" }),
    node(source, { canonicalId: "artifact:bookstack:page:42", type: "ai_artifact" }),
  ];
  const edges: EdgeContract[] = [
    edge(source, { edgeId: "bookstack-page-to-chunk", source: source.canonicalId, destination: "chunk:bookstack:page:42:1", dependencyType: "derivation", propagationPredicate: { kind: "metadata_field_intersection", fields: ["title", "body"] } }),
    edge(source, { edgeId: "bookstack-page-to-permission", source: source.canonicalId, destination: "permission:bookstack:page:42", dependencyType: "authorization", propagationPredicate: { kind: "security_only" }, deltaTransform: { kind: "permission_epoch" }, criticality: "security" }),
    edge(source, { edgeId: "bookstack-chunk-to-index", source: "chunk:bookstack:page:42:1", destination: "local-index:bookstack:page:42", dependencyType: "indexing" }),
    edge(source, { edgeId: "bookstack-index-to-retrieval", source: "local-index:bookstack:page:42", destination: "retrieval:bookstack:page:42", dependencyType: "retrieval" }),
    edge(source, { edgeId: "bookstack-permission-to-retrieval", source: "permission:bookstack:page:42", destination: "retrieval:bookstack:page:42", dependencyType: "authorization", deltaTransform: { kind: "permission_epoch" }, criticality: "security" }),
    edge(source, { edgeId: "bookstack-retrieval-to-artifact", source: "retrieval:bookstack:page:42", destination: "artifact:bookstack:page:42", dependencyType: "retrieval" }),
  ];
  return { nodes, edges };
}

export async function runBookStackBoundaryDemo(scenario: BookStackBoundaryScenario) {
  const mock = new MockBookStackEnvironment();
  const connector = new BookStackConnector({
    tenantId,
    connectionId: "bookstack-poc",
    apiEndpoint: mock.endpoint,
    credentialReference: mock.credentialReference,
  }, mock, mock, mock.fetch);
  const probe = await connector.probe();
  const initialSource = await connector.readObject("42", [mock.verificationPrincipalRef]);
  const graph = createBookStackMvpGraph(initialSource);
  const store = new MemoryConsistencyStore(graph);
  const destination = new DeterministicLocalIndexDestination();
  const verificationQuery = scenario === "bookstack_content_update" ? "rotation" : "incident";
  const registration: ArtifactRegistration = {
    artifactId: "artifact:bookstack:page:42",
    artifactType: "local_index_record",
    destinationId: "local-index-poc",
    sourceObjectIds: [initialSource.canonicalId],
    lineageNodeIds: graph.nodes.filter((item) => !item.authoritative).map((item) => item.canonicalId),
    verificationPrincipalRef: mock.verificationPrincipalRef,
    verificationQuery,
  };
  await destination.registerArtifact(registration);
  await destination.seed(initialSource);
  const retrievalBefore = await destination.retrieve(mock.verificationPrincipalRef, verificationQuery);

  if (scenario === "bookstack_content_update") mock.updateContent();
  else mock.revokeVerificationPrincipal();
  const observedSource = await connector.readObject("42", [mock.verificationPrincipalRef]);
  const event = await connector.normalizeChange({
    eventId: scenario === "bookstack_content_update" ? "bookstack:audit:1002" : "bookstack:audit:1003",
    pageId: "42",
    mutationType: scenario === "bookstack_content_update" ? "CONTENT_UPDATED" : "ACCESS_REVOKED",
    beforeSequence: 1,
    afterSequence: 2,
    logicalTimestamp: scenario === "bookstack_content_update" ? 1002 : 1003,
    payloadHash: observedSource.effectiveStateHash,
    changedFields: scenario === "bookstack_content_update" ? ["body"] : ["permissions"],
    affectedPrincipalRefs: scenario === "bookstack_content_update" ? [] : [mock.verificationPrincipalRef],
    securityClassification: scenario === "bookstack_content_update" ? "normal" : "security_revocation",
  });
  const stagedSource: NormalizedSourceObject = { ...observedSource, sourceVersion: event.afterVersion };
  await destination.stageSourceObject(stagedSource);
  const engine = new DeterministicConsistencyEngine(store, destination, prototypePolicy, () => "2026-08-21T10:06:00.000Z");
  const result = await engine.process(event);
  const retrievalAfter = await destination.retrieve(mock.verificationPrincipalRef, verificationQuery);
  const artifact = await store.getNode(registration.artifactId);
  const guard = await evaluateServeGuard(store, prototypePolicy, {
    tenantId,
    artifactId: registration.artifactId,
    policyVersion: prototypePolicy.policyVersion,
    securityEpoch: await store.getSecurityEpoch(tenantId),
    requiredVersions: [event.afterVersion],
    requestedFreshness: "current",
  });
  return {
    scenario,
    event: { eventId: event.eventId, mutationType: event.mutationType, sourceVersion: event.afterVersion, securityClassification: event.securityClassification },
    result: {
      classification: result.classification,
      affectedNodes: result.affectedNodes,
      blockedNodes: result.blockedNodes,
      prunedCount: result.prunedCount,
      overPropagationCount: result.overPropagationCount,
      actions: result.actions.map((action) => ({ nodeId: action.nodeId, kind: action.kind, mandatory: action.mandatory, status: action.status })),
      proofs: result.proofs.map((proof) => ({ artifactId: proof.artifactId, result: proof.result, proofHash: proof.proofHash.slice(0, 16) })),
    },
    artifact: artifact ? { validityState: artifact.validityState, securityEpoch: artifact.securityEpoch, dependencyCoverage: artifact.dependencyCoverage } : null,
    serveGuard: guard,
    guarantee: "Mocked BookStack input and a real deterministic local-index retrieval were exercised. The remaining guarantee boundary is the live BookStack environment and test identity.",
    integration: {
      connector: "BookStack",
      destination: "Deterministic local index",
      sourceObject: initialSource.canonicalId,
      apiProbe: probe.reachable ? "passed" : "failed",
      authenticatedApiRequests: mock.requests.filter((request) => request.authorizationPresent).length,
      retrievalBefore: retrievalBefore.length,
      retrievalAfter: retrievalAfter.length,
      expectedRetrievalAfter: scenario === "bookstack_content_update" ? 1 : 0,
      indexSnapshot: destination.snapshot(),
      lifecycle: ["API probe", "Page + permission read", "Event normalization", "Impact traversal", "Repair", "Identity retrieval", "Proof", "Serve Guard"],
    },
  };
}
