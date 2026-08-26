import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BookStackConnector, inspectBookStackWebhook } from "../lib/consistency-engine/bookstack-connector.ts";
import { createBookStackMvpGraph, runBookStackBoundaryDemo } from "../lib/consistency-engine/bookstack-e2e.ts";
import { DeterministicConsistencyEngine } from "../lib/consistency-engine/engine.ts";
import { prototypePolicy } from "../lib/consistency-engine/fixtures.ts";
import { DeterministicLocalIndexDestination } from "../lib/consistency-engine/local-index-destination.ts";
import { MemoryConsistencyStore } from "../lib/consistency-engine/memory-store.ts";
import { MockBookStackEnvironment } from "../lib/consistency-engine/mock-bookstack.ts";
import { evaluateServeGuard } from "../lib/consistency-engine/serve-guard.ts";
import { SimulatedDocumentSourceConnector, SimulatedRetrievalBoundary } from "../lib/consistency-engine/simulated-connectors.ts";
import { createPrototypeGraph } from "../lib/consistency-engine/fixtures.ts";
import { validateConnectorDeploymentInput } from "../lib/integration-platform.ts";

test("integration persistence stores endpoint, scope, identity, destination, and secret references without raw credentials", async () => {
  const migration = await readFile(new URL("../drizzle/0004_stiff_supreme_intelligence.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE `integration_configurations`/);
  assert.match(migration, /`credential_reference` text NOT NULL/);
  assert.match(migration, /CREATE TABLE `ai_destination_configurations`/);
  assert.doesNotMatch(migration, /token_secret|raw_credential|credential_value/);

  const input = validateConnectorDeploymentInput({
    connectorKey: "bookstack",
    displayName: "Knowledge POC",
    externalInstanceKey: "bookstack.staging.acme.internal",
    environment: "staging",
    deploymentMode: "customer_cloud",
    apiEndpoint: "https://bookstack.example.com",
    destinationType: "local_index",
    verificationIdentityRef: "bookstack-user:17",
  });
  assert.equal(input.destinationType, "local_index");
  assert.equal(input.authenticationMethod, "api_token");
  assert.throws(() => validateConnectorDeploymentInput({ ...input, token: "must-not-enter-control-plane" }), /prohibited customer-data field/i);
});

test("BookStack content update runs from authenticated API reads through local-index retrieval proof", async () => {
  const demo = await runBookStackBoundaryDemo("bookstack_content_update");
  assert.equal(demo.integration.apiProbe, "passed");
  assert.ok(demo.integration.authenticatedApiRequests >= 5);
  assert.equal(demo.integration.retrievalBefore, 0);
  assert.equal(demo.integration.retrievalAfter, 1);
  assert.equal(demo.integration.expectedRetrievalAfter, 1);
  assert.ok(demo.result.actions.length > 0);
  assert.ok(demo.result.proofs.every((proof) => proof.result === "verified"));
  assert.equal(demo.serveGuard.decision, "ALLOW");
});

test("BookStack permission revocation fails closed first, repairs, then proves the affected identity gets no result", async () => {
  const demo = await runBookStackBoundaryDemo("bookstack_permission_revocation");
  assert.equal(demo.integration.retrievalBefore, 1);
  assert.equal(demo.integration.retrievalAfter, 0);
  assert.equal(demo.integration.expectedRetrievalAfter, 0);
  assert.ok(demo.result.blockedNodes.includes("artifact:bookstack:page:42"));
  assert.ok(demo.result.actions.every((action) => action.mandatory));
  assert.ok(demo.result.proofs.every((proof) => proof.result === "verified"));
  assert.equal(demo.artifact.validityState, "VERIFIED_CURRENT");
  assert.ok(demo.artifact.securityEpoch > 1);
});

test("the mocked BookStack lifecycle is deterministic and reproducible", async () => {
  const first = await runBookStackBoundaryDemo("bookstack_content_update");
  const second = await runBookStackBoundaryDemo("bookstack_content_update");
  assert.deepEqual(first, second);
});

test("BookStack connector keeps credentials behind a reference and rejects credentials embedded in URLs", async () => {
  const mock = new MockBookStackEnvironment();
  assert.throws(() => new BookStackConnector({
    tenantId: "tenant",
    connectionId: "bad",
    apiEndpoint: "https://user:secret@bookstack.example.com",
    credentialReference: "vault://bookstack",
  }, mock), /must not be embedded/i);

  const connector = new BookStackConnector({
    tenantId: "tenant",
    connectionId: "safe",
    apiEndpoint: mock.endpoint,
    credentialReference: mock.credentialReference,
  }, mock, mock, mock.fetch);
  const page = await connector.readObject("42", [mock.verificationPrincipalRef]);
  const serialized = JSON.stringify(page);
  assert.doesNotMatch(serialized, /mock-token-secret|mock-token-id/);
  assert.ok(mock.requests.every((request) => request.authorizationPresent));
});

test("BookStack webhooks are observations that require API reconciliation before correctness decisions", () => {
  const observation = inspectBookStackWebhook({
    event: "page_update",
    triggered_at: "2026-08-21T10:05:00.000Z",
    webhook_id: 1002,
    related_item: { id: 42, type: "page", name: "Incident Response" },
  });
  assert.deepEqual(observation, {
    eventId: "1002",
    eventName: "page_update",
    pageId: "42",
    occurredAt: "2026-08-21T10:05:00.000Z",
    requiresApiReconciliation: true,
  });
});

test("an incomplete authorization snapshot produces security_unknown and remains blocked without proof", async () => {
  const mock = new MockBookStackEnvironment();
  const connector = new BookStackConnector({
    tenantId: "tenant-bookstack-poc",
    connectionId: "bookstack-poc",
    apiEndpoint: mock.endpoint,
    credentialReference: mock.credentialReference,
  }, mock, undefined, mock.fetch);
  const source = await connector.readObject("42", [mock.verificationPrincipalRef]);
  assert.equal(source.authorization.completeForEvaluatedPrincipals, false);
  const graph = createBookStackMvpGraph(source);
  const store = new MemoryConsistencyStore(graph);
  const destination = new DeterministicLocalIndexDestination();
  await destination.registerArtifact({
    artifactId: "artifact:bookstack:page:42",
    artifactType: "local_index_record",
    destinationId: "local-index-poc",
    sourceObjectIds: [source.canonicalId],
    lineageNodeIds: graph.nodes.filter((node) => !node.authoritative).map((node) => node.canonicalId),
    verificationPrincipalRef: mock.verificationPrincipalRef,
    verificationQuery: "incident",
  });
  await destination.seed(source);
  const event = await connector.normalizeChange({
    eventId: "bookstack:audit:unknown-permission",
    pageId: "42",
    mutationType: "ROLE_CHANGED",
    beforeSequence: 1,
    afterSequence: 2,
    logicalTimestamp: 1004,
    payloadHash: source.effectiveStateHash,
    changedFields: null,
    affectedPrincipalRefs: [mock.verificationPrincipalRef],
    securityClassification: "security_unknown",
  });
  await destination.stageSourceObject({ ...source, sourceVersion: event.afterVersion });
  const engine = new DeterministicConsistencyEngine(store, destination, prototypePolicy, () => "2026-08-21T10:07:00.000Z");
  const result = await engine.process(event);
  assert.ok(result.proofs.some((proof) => proof.result === "failed"));
  assert.equal((await store.getNode("artifact:bookstack:page:42")).validityState, "BLOCKED_SECURITY");
  const guard = await evaluateServeGuard(store, prototypePolicy, {
    tenantId: "tenant-bookstack-poc",
    artifactId: "artifact:bookstack:page:42",
    policyVersion: prototypePolicy.policyVersion,
    securityEpoch: await store.getSecurityEpoch("tenant-bookstack-poc"),
    requiredVersions: [event.afterVersion],
    requestedFreshness: "current",
  });
  assert.equal(guard.decision, "BLOCK");
});

test("a zero cost budget cannot remove correctness-required remediation", async () => {
  const graph = createPrototypeGraph();
  const store = new MemoryConsistencyStore(graph);
  const engine = new DeterministicConsistencyEngine(store, new SimulatedRetrievalBoundary(), { ...prototypePolicy, maxDeferredCostMinor: 0 }, () => "2026-08-21T12:00:00.000Z");
  const event = await new SimulatedDocumentSourceConnector().normalize({
    eventId: "cost-policy-zero",
    tenantId: "tenant-prototype",
    authority: "docs",
    objectId: "doc:strategy",
    mutationType: "CONTENT_UPDATED",
    beforeSequence: 1,
    afterSequence: 2,
    payload: { body: "required update" },
    metadata: { changedFields: "body" },
  });
  const result = await engine.process(event);
  assert.ok(result.actions.length > 0);
  assert.ok(result.actions.filter((action) => action.mandatory).every((action) => action.status === "verified"));
});
