import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertMinimizedOperationalPayload,
  connectorCatalog,
  createRuntimeEnrollmentToken,
  hashRuntimeToken,
  normalizeCanonicalChangeEvent,
  validateConnectorDeploymentInput,
  validateRuntimeHeartbeat,
} from "../lib/integration-platform.ts";

test("the first reusable source contracts are BookStack and Zulip while Linear stays explicitly planned", () => {
  assert.deepEqual(
    connectorCatalog.filter((connector) => connector.readiness === "enrollment_open").map((connector) => connector.key),
    ["bookstack", "zulip"],
  );
  assert.equal(connectorCatalog.find((connector) => connector.key === "linear")?.readiness, "planned");
  assert.throws(() => validateConnectorDeploymentInput({
    connectorKey: "linear",
    displayName: "Linear production",
    externalInstanceKey: "linear-main",
    environment: "production",
    deploymentMode: "customer_cloud",
  }), /enrollment is not open/i);
});

test("operational payloads reject customer content, embeddings, and credentials at any depth", () => {
  for (const payload of [
    { content: "customer data" },
    { derivative: { embeddings: [0.1, 0.2] } },
    { nested: [{ credential: "secret" }] },
  ]) {
    assert.throws(() => assertMinimizedOperationalPayload(payload), /prohibited customer-data field/i);
  }
});

test("canonical events normalize bounded operational metadata without carrying source content", () => {
  const event = normalizeCanonicalChangeEvent({
    eventId: "evt-123",
    sourceObjectType: "bookstack-page",
    sourceObjectId: "page-42",
    changeType: "ACCESS_REVOKED",
    eventTimestamp: "2026-08-21T08:00:00.000Z",
    correlationId: "corr-123",
    affectedIdentities: ["identity://alex"],
    permissionDelta: { removedRole: "viewer" },
    evidenceReferences: ["customer-evidence://evt-123"],
  });
  assert.equal(event.changeType, "ACCESS_REVOKED");
  assert.equal(event.sourceObjectId, "page-42");
  assert.deepEqual(event.affectedIdentities, ["identity://alex"]);
  assert.equal("content" in event, false);
});

test("runtime heartbeats accept bounded queue telemetry and reject malformed or unbounded counts", () => {
  assert.equal(validateRuntimeHeartbeat({ health: "healthy", runtimeVersion: "1.0.0", queueDepth: 7 }).queueDepth, 7);
  for (const queueDepth of [-1, 1.25, "not-a-number", 1_000_001]) {
    assert.throws(
      () => validateRuntimeHeartbeat({ health: "healthy", runtimeVersion: "1.0.0", queueDepth }),
      /queueDepth must be an integer/i,
    );
  }
});

test("runtime enrollment tokens are high-entropy, one-time values whose stable hash can be stored instead", async () => {
  const first = createRuntimeEnrollmentToken();
  const second = createRuntimeEnrollmentToken();
  assert.match(first, /^cnr_[a-f0-9]{48}$/);
  assert.notEqual(first, second);
  assert.equal((await hashRuntimeToken(first)).length, 64);
  assert.equal(await hashRuntimeToken(first), await hashRuntimeToken(first));
  assert.notEqual(await hashRuntimeToken(first), await hashRuntimeToken(second));
});

test("integration control-plane persistence is tenant-scoped and idempotent", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  for (const table of ["connectorDeployments", "connectorRuntimeCredentials", "canonicalChangeEvents", "lineageRegistrations", "reconciliationRuns"]) {
    const start = schema.indexOf(`export const ${table}`);
    assert.notEqual(start, -1, `${table} must exist`);
    const next = schema.indexOf("export const ", start + 14);
    assert.match(schema.slice(start, next === -1 ? undefined : next), /organizationId:/, `${table} must be tenant-scoped`);
  }
  assert.match(schema, /canonical_change_events_deployment_source_uidx/);
  assert.match(schema, /reconciliation_runs_org_idempotency_uidx/);
  assert.match(schema, /connector_runtime_credentials_hash_uidx/);
});
