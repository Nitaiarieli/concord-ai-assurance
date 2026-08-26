import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DeterministicConsistencyEngine } from "../lib/consistency-engine/engine.ts";
import { addInferredDependency, createPrototypeGraph, prototypePolicy } from "../lib/consistency-engine/fixtures.ts";
import { MemoryConsistencyStore } from "../lib/consistency-engine/memory-store.ts";
import { recomputeAffectedFromScratch } from "../lib/consistency-engine/oracle.ts";
import { evaluateServeGuard } from "../lib/consistency-engine/serve-guard.ts";
import { SimulatedDocumentSourceConnector, SimulatedRetrievalBoundary, SimulatedWorkPermissionConnector } from "../lib/consistency-engine/simulated-connectors.ts";
import { assertValidityTransition } from "../lib/consistency-engine/state-machine.ts";

const clock = () => "2026-08-21T12:00:00.000Z";

async function documentEvent(overrides = {}) {
  return new SimulatedDocumentSourceConnector().normalize({
    eventId: "evt-doc-2",
    tenantId: "tenant-prototype",
    authority: "docs",
    objectId: "doc:strategy",
    mutationType: "CONTENT_UPDATED",
    beforeSequence: 1,
    afterSequence: 2,
    payload: { title: "Strategy", body: "Version two" },
    metadata: { changedFields: "body" },
    ...overrides,
  });
}

async function revocationEvent(overrides = {}) {
  return new SimulatedWorkPermissionConnector().normalize({
    eventId: "evt-revoke-2",
    tenantId: "tenant-prototype",
    authority: "work",
    objectId: "work:access-policy",
    mutationType: "ACCESS_REVOKED",
    beforeSequence: 1,
    afterSequence: 2,
    payload: { principal: "user:alex", authorized: false },
    securityClassification: "security_revocation",
    ...overrides,
  });
}

function setup(graph = createPrototypeGraph(), boundary = new SimulatedRetrievalBoundary(), policy = prototypePolicy) {
  const store = new MemoryConsistencyStore(graph);
  const engine = new DeterministicConsistencyEngine(store, boundary, policy, clock);
  return { store, boundary, engine, graph };
}

test("the persistent schema is tenant-scoped and enforces event and action idempotency", async () => {
  const schema = await readFile(new URL("../drizzle/0003_complex_titania.sql", import.meta.url), "utf8");
  const tables = [
    "consistency_engine_nodes",
    "consistency_engine_security_epochs",
    "consistency_engine_edges",
    "consistency_engine_events",
    "consistency_engine_actions",
    "consistency_engine_proofs",
  ];
  for (const table of tables) {
    const definition = schema.match(new RegExp(`CREATE TABLE \\u0060${table}\\u0060 \\(([\\s\\S]*?)\\n\\);`));
    assert.ok(definition, `${table} migration missing`);
    assert.match(definition[1], /`organization_id` text (PRIMARY KEY )?NOT NULL/);
  }
  assert.match(schema, /consistency_engine_events_org_idempotency_uidx/);
  assert.match(schema, /consistency_engine_actions_org_idempotency_uidx/);
  assert.match(schema, /consistency_engine_proofs_hash_uidx/);
});

test("VERIFIED_CURRENT is impossible without successful consumption-boundary verification", () => {
  assert.throws(() => assertValidityTransition("INVALID", "VERIFIED_CURRENT"), /requires successful/i);
  assert.doesNotThrow(() => assertValidityTransition("INVALID", "VERIFIED_CURRENT", true));
  assert.throws(() => assertValidityTransition("BLOCKED_SECURITY", "BOUNDED_STALE", true), /Forbidden|cannot be weakened/i);
});

test("duplicate delivery is idempotent and leaves the final store unchanged", async () => {
  const { store, engine } = setup();
  const event = await documentEvent();
  const first = await engine.process(event);
  const before = store.snapshot();
  const second = await engine.process(event);
  assert.equal(first.classification, "new");
  assert.equal(second.classification, "duplicate");
  assert.deepEqual(store.snapshot(), before);
});

test("delayed and out-of-order events are detected; an older update cannot resurrect a deletion", async () => {
  const { store, engine } = setup();
  const deletion = await documentEvent({ eventId: "evt-delete-3", mutationType: "CONTENT_DELETED", beforeSequence: 1, afterSequence: 3, payload: { deleted: true } });
  await engine.process(deletion);
  const afterDeletion = (await store.getNode("doc:strategy")).sourceVersion;
  const olderUpdate = await documentEvent({ eventId: "evt-old-2", beforeSequence: 1, afterSequence: 2, payload: { body: "old" } });
  const result = await engine.process(olderUpdate);
  assert.equal(result.classification, "stale");
  assert.deepEqual((await store.getNode("doc:strategy")).sourceVersion, afterDeletion);

  const missingParent = await documentEvent({ eventId: "evt-gap-5", beforeSequence: 3, afterSequence: 5, causalParents: ["evt-missing-4"] });
  assert.equal((await engine.process(missingParent)).classification, "out_of_order");
});

test("same-sequence conflicting content is classified as concurrent and handled conservatively", async () => {
  const { engine } = setup();
  const concurrent = await documentEvent({ eventId: "evt-concurrent", beforeSequence: 1, afterSequence: 1, afterOpaque: "v1-conflict", payload: { body: "different same-version value" } });
  const result = await engine.process(concurrent);
  assert.equal(result.classification, "concurrent");
  assert.ok(result.affectedNodes.length > 0);
});

test("permission revocation advances the security barrier before any destination work and fails closed", async () => {
  const graph = createPrototypeGraph();
  const store = new MemoryConsistencyStore(graph);
  const delegate = new SimulatedRetrievalBoundary();
  let guardDecisionDuringExecution = null;
  const boundary = {
    async execute(action, event, node) {
      guardDecisionDuringExecution ??= await evaluateServeGuard(store, prototypePolicy, {
        tenantId: event.tenantId,
        artifactId: "artifact:strategy-answer",
        policyVersion: prototypePolicy.policyVersion,
        securityEpoch: 1,
        requiredVersions: [event.afterVersion],
        requestedFreshness: "current",
      });
      return delegate.execute(action, event, node);
    },
    verify: (...args) => delegate.verify(...args),
  };
  const engine = new DeterministicConsistencyEngine(store, boundary, prototypePolicy, clock);
  const result = await engine.process(await revocationEvent());
  assert.equal(guardDecisionDuringExecution.decision, "BLOCK");
  assert.ok(result.blockedNodes.includes("artifact:strategy-answer"));
  assert.equal((await store.getNode("artifact:strategy-answer")).validityState, "VERIFIED_CURRENT");
  assert.ok((await store.getNode("artifact:strategy-answer")).securityEpoch > 1);
});

test("crash before execution leaves invalid state and deterministic recovery completes the persisted plan", async () => {
  const boundary = new SimulatedRetrievalBoundary();
  boundary.faultMode = "crash_before_execution";
  const { store, engine } = setup(createPrototypeGraph(), boundary);
  const event = await documentEvent();
  await assert.rejects(engine.process(event), /Injected crash before execution/);
  assert.equal((await store.getNode("chunk:strategy:1")).validityState, "INVALID");
  const recovery = await engine.recover(event);
  assert.ok(recovery.proofs.every((proof) => proof.result === "verified"));
  assert.equal((await store.getNode("artifact:strategy-answer")).validityState, "VERIFIED_CURRENT");
});

test("crash after destination execution but before commit is safe because actions are idempotent", async () => {
  const boundary = new SimulatedRetrievalBoundary();
  boundary.faultMode = "crash_after_execution_before_receipt";
  const { engine } = setup(createPrototypeGraph(), boundary);
  const event = await documentEvent();
  await assert.rejects(engine.process(event), /after idempotent execution/);
  const recovered = await engine.recover(event);
  assert.ok(recovered.proofs.length > 0);
  assert.ok(boundary.executionAttempts >= 2);
});

test("verification failure cannot certify freshness", async () => {
  const boundary = new SimulatedRetrievalBoundary();
  boundary.faultMode = "verification_failure";
  const { store, engine } = setup(createPrototypeGraph(), boundary);
  const result = await engine.process(await documentEvent());
  assert.equal(result.proofs[0].result, "failed");
  assert.equal((await store.getNode(result.proofs[0].artifactId)).validityState, "VERIFICATION_FAILED");
});

test("a missing dependency is reported as a guarantee gap and Serve Guard does not invent a proof", async () => {
  const graph = createPrototypeGraph();
  graph.edges = graph.edges.filter((edge) => edge.edgeId !== "e-retrieval-artifact");
  graph.nodes.find((node) => node.canonicalId === "retrieval:strategy").dependencyCoverage = "partial";
  const { store, engine } = setup(graph);
  const event = await documentEvent();
  const result = await engine.process(event);
  assert.equal(result.affectedNodes.includes("artifact:strategy-answer"), false);
  const guard = await evaluateServeGuard(store, prototypePolicy, {
    tenantId: event.tenantId,
    artifactId: "artifact:strategy-answer",
    policyVersion: prototypePolicy.policyVersion,
    securityEpoch: 1,
    requiredVersions: [event.afterVersion],
    requestedFreshness: "current",
  });
  assert.notEqual(guard.decision, "ALLOW");
});

test("a low-confidence inferred dependency over-propagates and never prunes a hard invariant", async () => {
  const { engine } = setup(addInferredDependency(createPrototypeGraph(), 0.2));
  const result = await engine.process(await documentEvent());
  assert.ok(result.overPropagationCount >= 1);
  assert.ok(result.affectedNodes.includes("artifact:strategy-answer"));
});

test("monotonic dependency cycles use bounded fixed-point handling", async () => {
  const graph = createPrototypeGraph();
  graph.edges.push({ ...graph.edges[1], edgeId: "e-vector-chunk-cycle", source: "vector:strategy:1", destination: "chunk:strategy:1", monotonic: true });
  const { engine } = setup(graph);
  const result = await engine.process(await documentEvent());
  assert.equal(result.sccIterations, 1);
  assert.ok(result.affectedNodes.includes("vector:strategy:1"));
});

test("non-monotonic cycles require full SCC recomputation instead of an unproved local fixed point", async () => {
  const graph = createPrototypeGraph();
  graph.edges.push({ ...graph.edges[1], edgeId: "e-vector-chunk-nonmonotonic", source: "vector:strategy:1", destination: "chunk:strategy:1", monotonic: false });
  const { engine } = setup(graph);
  const result = await engine.process(await documentEvent());
  assert.ok(result.actions.some((action) => action.kind === "FULL_SCC_RECOMPUTE"));
});

test("fan-out limits change planning strategy but never remove required remediation", async () => {
  const graph = createPrototypeGraph();
  const source = graph.nodes[0];
  graph.nodes = [source];
  graph.edges = [];
  for (let index = 0; index < 40; index += 1) {
    const id = `artifact:fanout:${index}`;
    graph.nodes.push({ ...createPrototypeGraph().nodes.at(-1), canonicalId: id });
    graph.edges.push({ ...createPrototypeGraph().edges[0], edgeId: `e-fanout-${index}`, source: source.canonicalId, destination: id, propagationPredicate: { kind: "always" } });
  }
  const policy = { ...prototypePolicy, maxFanout: 10 };
  const { engine } = setup(graph, new SimulatedRetrievalBoundary(), policy);
  const result = await engine.process(await documentEvent());
  assert.equal(result.affectedNodes.length, 40);
  assert.ok(result.actions.every((action) => action.kind === "FULL_SCC_RECOMPUTE"));
});

test("complete event-log replay converges to the same node validity and versions", async () => {
  const events = [
    await documentEvent(),
    await documentEvent({ eventId: "evt-doc-3", beforeSequence: 2, afterSequence: 3, payload: { body: "Version three" } }),
  ];
  const first = setup();
  for (const event of events) await first.engine.process(event);
  const second = setup();
  for (const event of events) await second.engine.process(event);
  const select = (snapshot) => snapshot.nodes.map(({ canonicalId, sourceVersion, validityState, securityEpoch }) => ({ canonicalId, sourceVersion, validityState, securityEpoch }));
  assert.deepEqual(select(first.store.snapshot()), select(second.store.snapshot()));
});

test("deterministic generated cases match the from-scratch reference oracle with zero false pruning", async () => {
  let state = 0x5eed1234;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  for (let scenario = 0; scenario < 40; scenario += 1) {
    const graph = createPrototypeGraph(`tenant-${scenario}`);
    for (const edge of graph.edges) {
      if (edge.source === "doc:strategy") edge.propagationPredicate = random() < 0.5 ? { kind: "always" } : { kind: "metadata_field_intersection", fields: ["body"] };
      if (random() < 0.15) { edge.evidenceType = "inferred"; edge.confidence = 0.4; }
    }
    for (const node of graph.nodes) node.tenantId = `tenant-${scenario}`;
    for (const edge of graph.edges) edge.tenantId = `tenant-${scenario}`;
    const event = await documentEvent({ tenantId: `tenant-${scenario}`, eventId: `evt-${scenario}`, metadata: { changedFields: random() < 0.8 ? "body" : "owner" } });
    const oracle = await recomputeAffectedFromScratch(graph.nodes, graph.edges, event, prototypePolicy);
    const { engine } = setup(graph);
    const result = await engine.process(event);
    const falsePruned = oracle.affectedNodes.filter((nodeId) => !result.affectedNodes.includes(nodeId));
    assert.deepEqual(falsePruned, [], `scenario ${scenario} false-pruned ${falsePruned.join(",")}`);
  }
});
