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
  assert.match(html, /Trust the state/);
  assert.match(html, /Design-partner staging only/i);
  assert.match(html, /Demo data/i);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /Connect your first app free/i);
});

for (const [path, expected] of [
  ["/pricing", /Connect your first.*application for free/is],
  ["/value", /Every financial number starts with a product event/i],
  ["/intelligence", /Crunchbase access/i],
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
  for (const [path, method] of [["/api/applications", "POST"], ["/api/analytics", "POST"]]) {
    const response = await fetchFromWorker(path, {
      method,
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
