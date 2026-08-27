import assert from "node:assert/strict";
import test from "node:test";

async function fetchFromWorker(path = "/", init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders production metadata", async () => {
  const response = await fetchFromWorker("/", { headers: { accept: "text/html" } });

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>Concord — AI State Assurance<\/title>/);
  assert.doesNotMatch(html, /Starter Project|codex-preview/);
});

test("renders the bounded launch verdict and product positioning", async () => {
  const response = await fetchFromWorker("/", { headers: { accept: "text/html" } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /The source changed/i);
  assert.match(html, /Concord finds what must change with it/i);
  assert.match(html, /Bounded consistency for registered artifacts/i);
  assert.match(html, /An old answer can survive a new truth/i);
  assert.match(html, /Watch assurance move through the system/i);
  assert.match(html, /Ready for controlled design-partner staging/i);
  assert.match(html, /Demonstration data/i);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /Prove one downstream loop\. Then expand/i);
});

test("renders the compressed five-chapter landing story with progressive disclosure", async () => {
  const response = await fetchFromWorker("/", { headers: { accept: "text/html" } });
  const html = await response.text();
  assert.equal(response.status, 200);

  const chapterOrder = [
    'id="top"',
    'id="problem"',
    'id="how-it-works"',
    'id="proof"',
    'id="contact"',
  ].map((marker) => html.indexOf(marker));

  assert.ok(chapterOrder.every((index) => index >= 0));
  assert.deepEqual([...chapterOrder].sort((a, b) => a - b), chapterOrder);
  assert.match(html, /Open the assurance control surface/i);
  assert.match(html, /Inspect adapter coverage/i);
  assert.match(html, /Review operating boundaries/i);
  assert.match(html, /One event\. Five controlled transformations/i);
  assert.match(html, /Registered assurance objects/i);
  assert.match(html, /aria-haspopup="dialog"/i);
  assert.match(html, /Previous.*Run trace.*Next/is);
  assert.match(html, /Verified.*Repairing.*Unresolved.*Unsupported.*Accepted risk/is);
  assert.match(html, /Talk to Ralph Team/i);
  assert.doesNotMatch(html, /Less rebuilding/i);
  assert.doesNotMatch(html, /forest|desert|terrain/i);
});

for (const [path, expected] of [
  ["/pricing", /Connect your first.*application for free/is],
  ["/value", /Every financial number starts with a product event/i],
  ["/intelligence", /Crunchbase access/i],
  ["/coverage", /BookStack and Zulip|One closed loop/i],
  ["/consistency-engine", /Never call an AI artifact current without proof/i],
]) {
  test(`renders commercial route ${path}`, async () => {
    const response = await fetchFromWorker(path, { headers: { accept: "text/html" } });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, expected);
  });
}

test("public pricing never exposes draft monetary rates", async () => {
  const response = await fetchFromWorker("/api/pricing/public");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.firstApplicationFeeMinor, 0);
  assert.equal(body.approvedRates, null);
  assert.equal(body.status, "awaiting_founder_approval");
});

test("tenant-scoped mutation routes reject unauthenticated requests before database access", async () => {
  for (const [path, method] of [["/api/applications", "POST"], ["/api/analytics", "POST"], ["/api/deployment-agent", "POST"], ["/api/integration-deployments", "POST"]]) {
    const response = await fetchFromWorker(path, {
      method,
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 401);
  }
});

test("runtime ingestion routes reject requests without a deployment credential before database access", async () => {
  for (const path of ["/api/runtime/v1/heartbeat", "/api/runtime/v1/events"]) {
    const response = await fetchFromWorker(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 401);
  }
});

test("simulation API returns a safe, non-destructive plan", async () => {
  const response = await fetchFromWorker("/api/simulations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceId: "sharepoint://strategy/fy27",
      principalType: "group",
      vectorRecords: 128,
      cacheKeys: 16,
      proofEndpoint: true,
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.plan.writesPerformed, false);
  assert.equal(body.plan.affectedArtifacts, 144);
  assert.equal(body.plan.expectedCoverage, 100);
});

test("simulation API rejects unbounded record counts", async () => {
  const response = await fetchFromWorker("/api/simulations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceId: "sharepoint://strategy/fy27",
      principalType: "user",
      vectorRecords: 10001,
      cacheKeys: 0,
      proofEndpoint: false,
    }),
  });
  assert.equal(response.status, 400);
});

test("consistency-engine demo exposes conditional guarantees and never hides a missing dependency", async () => {
  const success = await fetchFromWorker("/api/consistency-engine/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario: "content_update" }),
  });
  const successBody = await success.json();
  assert.equal(success.status, 200);
  assert.equal(successBody.serveGuard.decision, "ALLOW");
  assert.ok(successBody.result.affectedNodes.includes("artifact:strategy-answer"));

  const unknown = await fetchFromWorker("/api/consistency-engine/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenario: "unknown_dependency" }),
  });
  const unknownBody = await unknown.json();
  assert.equal(unknown.status, 200);
  assert.notEqual(unknownBody.serveGuard.decision, "ALLOW");
  assert.match(unknownBody.guarantee, /missing edge is not discoverable/i);
});
