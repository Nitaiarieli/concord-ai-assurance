"use client";

import { useState } from "react";

type DemoResult = {
  scenario: string;
  event: { eventId: string; mutationType: string; sourceVersion: { sequence: number; opaque: string }; securityClassification: string };
  result: { classification: string; affectedNodes: string[]; blockedNodes: string[]; prunedCount: number; overPropagationCount: number; actions: Array<{ nodeId: string; kind: string; mandatory: boolean; status: string }>; proofs: Array<{ artifactId: string; result: string; proofHash: string }> };
  artifact: { validityState: string; securityEpoch: number; dependencyCoverage: string } | null;
  serveGuard: { decision: string; reason: string };
  guarantee: string;
};

const scenarios = [
  ["content_update", "Content update", "Trace a known document change through chunk, vector, retrieval, and AI artifact."],
  ["permission_revocation", "Permission revocation", "Advance the security epoch before repair and test authorization at retrieval."],
  ["unknown_dependency", "Missing dependency", "Remove one edge and show why the system cannot claim global completeness."],
  ["verification_failure", "Verification failure", "Complete remediation but fail the consumption-boundary observation."],
] as const;

export function ConsistencyEngineLab() {
  const [scenario, setScenario] = useState<(typeof scenarios)[number][0]>("permission_revocation");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/consistency-engine/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario }) });
      const body = await response.json() as DemoResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Scenario failed.");
      setResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Scenario failed.");
    } finally { setBusy(false); }
  }

  return <div className="engine-lab">
    <section className="engine-hero">
      <div><p className="commercial-eyebrow">Deterministic consistency research prototype</p><h1>Never call an AI artifact current without proof.</h1><p>Concord models source-to-consumption dependencies, propagates known impact, blocks hard-invariant unknowns, repairs safely, and verifies the actual retrieval result. The guarantee is conditional—and the interface says exactly where it can fail.</p></div>
      <aside><span>Research verdict</span><strong>Conditionally valid</strong><p>Sound inside a registered, mediated boundary with delivered events and conservative dependency contracts.</p></aside>
    </section>

    <section className="engine-contract" aria-label="Consistency engine contract">
      {[['01','Observe','Normalize authoritative versions and causal metadata.'],['02','Invalidate','Use three-valued predicates; UNKNOWN never prunes a hard invariant.'],['03','Repair','Choose a safely sufficient plan, not an unproved global minimum.'],['04','Prove','Verify retrieval, authorization, and consumed versions.']].map(([number,title,body]) => <article key={title}><span>{number}</span><h2>{title}</h2><p>{body}</p></article>)}
    </section>

    <section className="engine-simulator">
      <header><div><p className="commercial-eyebrow">Executable proof-of-concept</p><h2>Run a bounded deterministic scenario.</h2></div><p>Simulated connectors only. No external credentials, customer data, LLM decision, or production write is involved.</p></header>
      <div className="engine-scenario-grid">{scenarios.map(([id,title,body]) => <button type="button" key={id} className={scenario === id ? "active" : ""} onClick={() => { setScenario(id); setResult(null); }}><strong>{title}</strong><span>{body}</span></button>)}</div>
      <button className="button button-amber" type="button" onClick={run} disabled={busy}>{busy ? "Processing deterministic graph…" : "Run scenario →"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <div className="engine-result" aria-live="polite">
        <div className="engine-result-summary"><article><span>Event</span><strong>{result.event.mutationType.replaceAll('_',' ')}</strong><small>Source v{result.event.sourceVersion.sequence}</small></article><article><span>Affected</span><strong>{result.result.affectedNodes.length}</strong><small>{result.result.prunedCount} proven pruned</small></article><article><span>Artifact state</span><strong>{result.artifact?.validityState.replaceAll('_',' ') ?? 'UNKNOWN'}</strong><small>Security epoch {result.artifact?.securityEpoch ?? '—'}</small></article><article><span>Serve Guard</span><strong>{result.serveGuard.decision.replaceAll('_',' ')}</strong><small>{result.result.proofs.filter((proof) => proof.result === 'verified').length} verified proofs</small></article></div>
        <div className="engine-result-detail"><div><span>Deterministic action plan</span>{result.result.actions.map((action) => <p key={`${action.nodeId}:${action.kind}`}><b>{action.kind.replaceAll('_',' ')}</b> {action.nodeId}<em>{action.status}</em></p>)}</div><aside><span>Why the guard decided</span><p>{result.serveGuard.reason}</p><strong>{result.guarantee}</strong></aside></div>
      </div>}
    </section>

    <section className="engine-assumptions"><div><p className="commercial-eyebrow">Correctness boundary</p><h2>What is proven—and what is not.</h2></div><div>{[['Conditional soundness','Requires complete-enough dependencies, delivered events, conservative predicates, and mediated consumption.'],['No false freshness','VERIFIED_CURRENT is unreachable without successful boundary verification.'],['Security safety','A tenant epoch advances before asynchronous repair; older requests fail closed.'],['Not universal semantics','Missing edges and arbitrary semantic impact remain unresolved research problems.']].map(([title,body]) => <article key={title}><strong>{title}</strong><p>{body}</p></article>)}</div></section>

    <section className="engine-architecture">
      <header><div><p className="commercial-eyebrow">Deployment architecture</p><h2>Customer-side execution. Concord-side proof.</h2></div><p>The connector runtime stays close to customer systems. Concord coordinates versions, policies, impact, and evidence without requiring source content or credentials in its control plane.</p></header>
      <div className="engine-architecture-map" aria-label="Concord deployment architecture">
        <div className="engine-architecture-column"><span>Authoritative sources</span><b>Document source</b><b>Work + permissions</b><small>Replaceable connectors</small></div>
        <i aria-hidden="true">→</i>
        <div className="engine-architecture-column engine-runtime"><span>Customer runtime</span><b>Normalize events</b><b>Collect lineage</b><b>Execute repairs</b><small>Customer content and secrets remain here</small></div>
        <i aria-hidden="true">⇄</i>
        <div className="engine-architecture-column engine-control"><span>Concord control plane</span><b>Event log + security epoch</b><b>Graph + provenance</b><b>Impact, policy + SCC planner</b><b>Proof store</b><small>D1-backed tenant-scoped metadata</small></div>
        <i aria-hidden="true">→</i>
        <div className="engine-architecture-column"><span>Consumption boundary</span><b>Retrieval / vector index</b><b>Serve Guard</b><b>LLM or agent</b><small>Allow, block, or authority fallback</small></div>
      </div>
      <footer><strong>Fail-closed path</strong><p>An authoritative revocation advances the tenant security epoch first. Serve Guard blocks older proofs immediately; remediation and consumption-boundary verification follow asynchronously.</p></footer>
    </section>

    <section className="engine-benchmark"><p className="commercial-eyebrow">Reproducible microbenchmark</p><h2>2,000 nodes. 32 affected. Zero false pruning under the stated model.</h2><div><article><strong>7.519 ms</strong><span>p50 end-to-end simulated propagation</span></article><article><strong>98.4%</strong><span>nodes not recomputed</span></article><article><strong>5.203 ms</strong><span>revocation blocking observation</span></article><article><strong>8.87×</strong><span>vs simulated full rebuild median</span></article></div><p>These are in-memory simulated results, not production performance claims. Real connector, storage, network, and retrieval latency remain unmeasured.</p></section>
  </div>;
}
