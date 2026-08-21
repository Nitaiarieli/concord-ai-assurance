import { DeterministicConsistencyEngine } from "./engine.ts";
import { createPrototypeGraph, prototypePolicy } from "./fixtures.ts";
import { MemoryConsistencyStore } from "./memory-store.ts";
import { evaluateServeGuard } from "./serve-guard.ts";
import { SimulatedDocumentSourceConnector, SimulatedRetrievalBoundary, SimulatedWorkPermissionConnector } from "./simulated-connectors.ts";

export const demoScenarios = ["content_update", "permission_revocation", "unknown_dependency", "verification_failure"] as const;
export type DemoScenario = (typeof demoScenarios)[number];

export async function runConsistencyDemo(scenario: DemoScenario) {
  const graph = createPrototypeGraph();
  if (scenario === "unknown_dependency") {
    graph.edges = graph.edges.filter((edge) => edge.edgeId !== "e-retrieval-artifact");
    graph.nodes.find((node) => node.canonicalId === "retrieval:strategy")!.dependencyCoverage = "partial";
  }
  const store = new MemoryConsistencyStore(graph);
  const boundary = new SimulatedRetrievalBoundary();
  if (scenario === "verification_failure") boundary.faultMode = "verification_failure";
  const engine = new DeterministicConsistencyEngine(store, boundary, prototypePolicy, () => "2026-08-21T12:00:00.000Z");
  const security = scenario === "permission_revocation";
  const event = security
    ? await new SimulatedWorkPermissionConnector().normalize({
      eventId: "demo-revocation-v2", tenantId: "tenant-prototype", authority: "work", objectId: "work:access-policy",
      mutationType: "ACCESS_REVOKED", beforeSequence: 1, afterSequence: 2,
      payload: { principal: "user:alex", allowed: false }, securityClassification: "security_revocation",
    })
    : await new SimulatedDocumentSourceConnector().normalize({
      eventId: `demo-${scenario}-v2`, tenantId: "tenant-prototype", authority: "docs", objectId: "doc:strategy",
      mutationType: "CONTENT_UPDATED", beforeSequence: 1, afterSequence: 2,
      payload: { title: "Strategy", body: "Updated authoritative content" }, metadata: { changedFields: "body" },
    });
  const result = await engine.process(event);
  const currentVersions = (await store.listNodes(event.tenantId))
    .filter((node) => node.authoritative && node.sourceVersion)
    .map((node) => node.sourceVersion!);
  const artifact = await store.getNode("artifact:strategy-answer");
  const guard = await evaluateServeGuard(store, prototypePolicy, {
    tenantId: event.tenantId,
    artifactId: "artifact:strategy-answer",
    policyVersion: prototypePolicy.policyVersion,
    securityEpoch: await store.getSecurityEpoch(event.tenantId),
    requiredVersions: currentVersions,
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
    guarantee: scenario === "unknown_dependency"
      ? "The missing edge is not discoverable by traversal. Serve Guard refuses freshness because the required proof is absent."
      : "The result is conditional on delivered events, conservative connector contracts, and mandatory Serve Guard mediation.",
  };
}
