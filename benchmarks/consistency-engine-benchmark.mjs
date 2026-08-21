import { performance } from "node:perf_hooks";
import { deterministicHash } from "../lib/consistency-engine/canonical.ts";
import { DeterministicConsistencyEngine } from "../lib/consistency-engine/engine.ts";
import { prototypePolicy } from "../lib/consistency-engine/fixtures.ts";
import { MemoryConsistencyStore } from "../lib/consistency-engine/memory-store.ts";
import { recomputeAffectedFromScratch } from "../lib/consistency-engine/oracle.ts";
import { evaluateServeGuard } from "../lib/consistency-engine/serve-guard.ts";
import { SimulatedDocumentSourceConnector, SimulatedRetrievalBoundary } from "../lib/consistency-engine/simulated-connectors.ts";

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
}

function node(id, authoritative = false) {
  return {
    canonicalId: id,
    tenantId: "benchmark-tenant",
    type: authoritative ? "authoritative_document" : "ai_artifact",
    authoritative,
    sourceVersion: authoritative ? { authority: "docs", sequence: 1, opaque: "v1" } : null,
    effectiveStateHash: "initial",
    validityState: "VERIFIED_CURRENT",
    policyClass: "strict",
    securityEpoch: 1,
    provenance: authoritative ? [] : [{ authority: "docs", objectId: "source:0", sourceVersion: { authority: "docs", sequence: 1, opaque: "v1" }, evidenceType: "observed" }],
    requiredAuthorities: ["docs"],
    dependencyCoverage: "complete",
    lastVerifiedAt: "2026-08-21T00:00:00.000Z",
  };
}

function edge(index, source, destination) {
  return {
    edgeId: `edge:${String(index).padStart(5, "0")}`,
    tenantId: "benchmark-tenant",
    source,
    destination,
    dependencyType: "derivation",
    propagationPredicate: { kind: "always" },
    deltaTransform: { kind: "identity" },
    verificationContract: { mode: "retrieval_and_authorization", boundaryId: "benchmark-boundary", requireConsumedVersions: true },
    criticality: "normal",
    evidenceType: "observed",
    confidence: 1,
    edgeVersion: 1,
    behaviorOnUnknown: "propagate",
    monotonic: true,
  };
}

function benchmarkGraph(nodeCount = 2_000, affectedPathLength = 32) {
  const nodes = [node("source:0", true)];
  const edges = [];
  let prior = "source:0";
  for (let index = 1; index <= affectedPathLength; index += 1) {
    const id = `affected:${index}`;
    nodes.push(node(id));
    edges.push(edge(index, prior, id));
    prior = id;
  }
  let disconnectedPrior = null;
  for (let index = affectedPathLength + 1; index < nodeCount; index += 1) {
    const id = `unaffected:${index}`;
    nodes.push(node(id));
    if (disconnectedPrior) edges.push(edge(index, disconnectedPrior, id));
    disconnectedPrior = id;
  }
  return { nodes, edges, terminalArtifact: `affected:${affectedPathLength}` };
}

const graph = benchmarkGraph();
const store = new MemoryConsistencyStore(graph);
const boundary = new SimulatedRetrievalBoundary();
const engine = new DeterministicConsistencyEngine(store, boundary, prototypePolicy, () => "2026-08-21T12:00:00.000Z");
const connector = new SimulatedDocumentSourceConnector();
const incrementalLatencies = [];
const oracleLatencies = [];
const simulatedFullRebuildLatencies = [];
let falsePruned = 0;
let requiredByOracle = 0;
let totalAffected = 0;
let totalPredicateEvaluations = 0;
let totalOverPropagation = 0;
let totalExternalCalls = 0;

for (let iteration = 0; iteration < 60; iteration += 1) {
  const event = await connector.normalize({
    eventId: `benchmark-event-${iteration}`,
    tenantId: "benchmark-tenant",
    authority: "docs",
    objectId: "source:0",
    mutationType: "CONTENT_UPDATED",
    beforeSequence: iteration + 1,
    afterSequence: iteration + 2,
    payload: { revision: iteration + 2 },
    logicalTimestamp: iteration + 2,
    metadata: { changedFields: "body" },
  });
  const oracleStart = performance.now();
  const oracle = await recomputeAffectedFromScratch(graph.nodes, graph.edges, event, prototypePolicy);
  oracleLatencies.push(performance.now() - oracleStart);
  const rebuildStart = performance.now();
  for (const item of graph.nodes) await deterministicHash({ nodeId: item.canonicalId, sourceVersion: event.afterVersion, payloadHash: event.payloadHash });
  simulatedFullRebuildLatencies.push(performance.now() - rebuildStart);
  const incrementalStart = performance.now();
  const result = await engine.process(event);
  incrementalLatencies.push(performance.now() - incrementalStart);
  const actual = new Set(result.affectedNodes);
  falsePruned += oracle.affectedNodes.filter((nodeId) => !actual.has(nodeId)).length;
  requiredByOracle += oracle.affectedNodes.length;
  totalAffected += result.affectedNodes.length;
  totalPredicateEvaluations += result.predicateEvaluations;
  totalOverPropagation += result.overPropagationCount;
  totalExternalCalls += result.externalCalls;
}

const securityStore = new MemoryConsistencyStore(graph);
const securityDelegate = new SimulatedRetrievalBoundary();
let blockingLatencyMs = null;
let securityStart = 0;
const securityBoundary = {
  async execute(action, event, targetNode) {
    if (blockingLatencyMs === null) {
      const guard = await evaluateServeGuard(securityStore, prototypePolicy, {
        tenantId: event.tenantId,
        artifactId: graph.terminalArtifact,
        policyVersion: prototypePolicy.policyVersion,
        securityEpoch: 1,
        requiredVersions: [event.afterVersion],
        requestedFreshness: "current",
      });
      if (guard.decision !== "BLOCK") throw new Error("Security benchmark did not fail closed.");
      blockingLatencyMs = performance.now() - securityStart;
    }
    return securityDelegate.execute(action, event, targetNode);
  },
  verify: (...args) => securityDelegate.verify(...args),
};
const securityEngine = new DeterministicConsistencyEngine(securityStore, securityBoundary, prototypePolicy, () => "2026-08-21T12:00:00.000Z");
const securityEvent = await connector.normalize({
  eventId: "benchmark-security-event",
  tenantId: "benchmark-tenant",
  authority: "docs",
  objectId: "source:0",
  mutationType: "ACCESS_REVOKED",
  beforeSequence: 1,
  afterSequence: 2,
  payload: { principal: "benchmark-user", allowed: false },
  securityClassification: "security_revocation",
});
securityStart = performance.now();
await securityEngine.process(securityEvent);

const snapshot = store.snapshot();
const provenanceBytes = Buffer.byteLength(JSON.stringify({
  nodes: snapshot.nodes.map((item) => ({ id: item.canonicalId, provenance: item.provenance, requiredAuthorities: item.requiredAuthorities })),
  edges: graph.edges,
}));
const proofBytes = Buffer.byteLength(JSON.stringify(snapshot.proofs));
const eventLogBytes = Buffer.byteLength(JSON.stringify(snapshot.events));
const p50 = quantile(incrementalLatencies, 0.50);
const oracleP50 = quantile(oracleLatencies, 0.50);
const rebuildP50 = quantile(simulatedFullRebuildLatencies, 0.50);

const report = {
  benchmarkVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: { runtime: process.version, storage: "deterministic in-memory adapter", externalSystems: "simulated" },
  graph: { nodes: graph.nodes.length, edges: graph.edges.length, affectedPathLength: 32, samples: incrementalLatencies.length },
  propagationLatencyMs: {
    p50: Number(p50.toFixed(3)),
    p95: Number(quantile(incrementalLatencies, 0.95).toFixed(3)),
    p99: Number(quantile(incrementalLatencies, 0.99).toFixed(3)),
  },
  permissionRevocationBlockingLatencyMs: Number(blockingLatencyMs.toFixed(3)),
  meanAffectedNodes: Number((totalAffected / incrementalLatencies.length).toFixed(2)),
  meanAffectedEdges: Number((totalPredicateEvaluations / incrementalLatencies.length).toFixed(2)),
  falsePruningRate: requiredByOracle === 0 ? 0 : falsePruned / requiredByOracle,
  conservativeOverPropagation: totalOverPropagation,
  recomputationAvoided: {
    meanNodes: graph.nodes.length - totalAffected / incrementalLatencies.length,
    percent: Number(((1 - (totalAffected / incrementalLatencies.length) / graph.nodes.length) * 100).toFixed(2)),
  },
  verificationCost: { meanExternalCalls: Number((totalExternalCalls / incrementalLatencies.length).toFixed(2)), totalExternalCalls },
  storageOverheadBytes: { provenanceGraph: provenanceBytes, proofs: proofBytes, eventLog: eventLogBytes, total: provenanceBytes + proofBytes + eventLogBytes },
  referenceOracleLatencyMs: { p50: Number(oracleP50.toFixed(3)), p95: Number(quantile(oracleLatencies, 0.95).toFixed(3)), p99: Number(quantile(oracleLatencies, 0.99).toFixed(3)) },
  simulatedFullRebuildLatencyMs: { p50: Number(rebuildP50.toFixed(3)), p95: Number(quantile(simulatedFullRebuildLatencies, 0.95).toFixed(3)), p99: Number(quantile(simulatedFullRebuildLatencies, 0.99).toFixed(3)) },
  relativePerformance: {
    incrementalVsImpactOracleMedian: Number((oracleP50 / p50).toFixed(2)),
    incrementalVsSimulatedFullRebuildMedian: Number((rebuildP50 / p50).toFixed(2)),
  },
  interpretation: "Prototype microbenchmark only. It excludes real network, connector, storage, queueing, and destination-service latency.",
};

console.log(JSON.stringify(report, null, 2));
