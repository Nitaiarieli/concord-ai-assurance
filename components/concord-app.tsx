"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import type { AssuranceCase } from "@/lib/concord";
import { cases, integrations, readinessReport } from "@/lib/concord";

type IconName = "arrow" | "check" | "clock" | "code" | "layers" | "play" | "pulse" | "shield" | "terminal";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    code: <><path d="m8 9-3 3 3 3"/><path d="m16 9 3 3-3 3"/><path d="m14 5-4 14"/></>,
    layers: <><path d="m12 3-9 5 9 5 9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    play: <path d="m8 5 11 7-11 7z"/>,
    pulse: <path d="M3 12h4l2-6 4 12 2-6h6"/>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    terminal: <><path d="m5 7 4 4-4 4"/><path d="M11 17h8"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function ConcordMark({ compact = false }: { compact?: boolean }) {
  return <span className="brand-mark" aria-label="Concord"><span className="brand-glyph" aria-hidden="true"><i/><i/><i/></span>{!compact && <span>Concord</span>}</span>;
}

function StatusPill({ status }: { status: AssuranceCase["status"] }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}><i />{status}</span>;
}

function ReadinessPanel() {
  return (
    <section className="readiness-wrap" id="readiness" aria-labelledby="readiness-title">
      <div className="section-kicker dark-kicker"><span>01</span> Independent assessment</div>
      <div className="readiness-grid">
        <div><p className="eyebrow">Launch decision / 20 Aug 2026</p><h2 id="readiness-title">Ready to prove.<br/>Not ready to promise.</h2><p className="lead muted-light">The product definition is unusually disciplined. The implementation evidence is not yet strong enough for a production safety claim.</p></div>
        <div className="score-orbit" aria-label={`Production readiness ${readinessReport.score} percent`}><svg viewBox="0 0 160 160" role="img"><circle className="score-track" cx="80" cy="80" r="66"/><circle className="score-value" cx="80" cy="80" r="66" pathLength="100" strokeDasharray={`${readinessReport.score} 100`}/></svg><div><strong>{readinessReport.score}</strong><span>% ready</span></div></div>
      </div>
      <div className="verdict-bar"><div><span className="dot-amber"/>Current verdict</div><strong>Design-partner staging only</strong><p>Confidence: medium · Evidence-backed, assumption-sensitive</p></div>
      <div className="dimension-grid">{readinessReport.dimensions.map((dimension) => <article key={dimension.label}><div className="dimension-head"><span>{dimension.label}</span><strong>{dimension.score}</strong></div><div className="mini-meter"><i style={{ width: `${dimension.score}%` }}/></div><p>{dimension.note}</p></article>)}</div>
    </section>
  );
}

function ProductConsole() {
  const [selectedId, setSelectedId] = useState(cases[0].id);
  const [activeView, setActiveView] = useState<"cases" | "coverage">("cases");
  const [simOpen, setSimOpen] = useState(false);
  const [simResult, setSimResult] = useState<null | { affectedArtifacts: number; expectedCoverage: number; approvalRequired: boolean; exceptions: string[] }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => cases.find((item) => item.id === selectedId) ?? cases[0], [selectedId]);

  async function runSimulation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/simulations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceId: form.get("sourceId"), principalType: form.get("principalType"), vectorRecords: Number(form.get("vectorRecords")), cacheKeys: Number(form.get("cacheKeys")), proofEndpoint: form.get("proofEndpoint") === "on" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Simulation failed.");
      setSimResult(data.plan);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Simulation failed."); }
    finally { setBusy(false); }
  }

  return (
    <section className="product-section" id="product" aria-labelledby="product-title">
      <div className="product-copy"><div className="section-kicker"><span>02</span> Product experience</div><div><p className="eyebrow">The assurance control room</p><h2 id="product-title">Every claim earns its evidence.</h2></div><p className="lead">The interface never turns a successful API response into a green check. It shows what changed, what Concord could reach, what was repaired, and how the final behavior was proved.</p></div>
      <div className="console-shell">
        <aside className="console-sidebar"><ConcordMark compact/><nav aria-label="Product demo navigation"><button className={activeView === "cases" ? "nav-active" : ""} type="button" onClick={() => setActiveView("cases")} aria-label="Assurance cases"><Icon name="pulse"/></button><button className={activeView === "coverage" ? "nav-active" : ""} type="button" onClick={() => setActiveView("coverage")} aria-label="Coverage ledger"><Icon name="layers"/></button><button type="button" onClick={() => setSimOpen(true)} aria-label="Open simulation"><Icon name="terminal"/></button></nav><span className="avatar" aria-label="Demo workspace">DA</span></aside>
        <div className="console-main">
          <header className="console-topbar"><div><span className="demo-badge">Demo data</span><strong>{activeView === "cases" ? "Assurance cases" : "Coverage ledger"}</strong></div><button className="button button-dark button-small" type="button" onClick={() => { setSimOpen(true); setSimResult(null); }}><Icon name="play" size={16}/>Run simulation</button></header>
          {activeView === "cases" ? <div className="console-content">
            <div className="case-list" role="list" aria-label="Assurance cases"><div className="case-list-head"><span>Case</span><span>Exposure</span></div>{cases.map((item) => <button key={item.id} type="button" className={`case-row ${selectedId === item.id ? "case-selected" : ""}`} onClick={() => setSelectedId(item.id)}><div><StatusPill status={item.status}/><strong>{item.id}</strong><p>{item.event} · {item.principal}</p></div><span><Icon name="clock" size={14}/>{item.exposure}</span></button>)}</div>
            <article className="case-detail" aria-live="polite"><div className="case-detail-head"><div><span className="micro-label">{selected.id} · {selected.updated}</span><h3>{selected.source}</h3></div><div className="coverage-number"><strong>{selected.coverage}%</strong><span>registered coverage</span></div></div><div className="proof-callout"><Icon name="shield"/><div><strong>{selected.proofLevel} proof level</strong><p>{selected.risk}</p></div></div><div className="proof-rail">{selected.proof.map((step, index) => <div className={`proof-step proof-${step.state}`} key={step.label}><span>{step.state === "complete" ? <Icon name="check" size={15}/> : index + 1}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div></div>)}</div><footer className="detail-footer"><span>Artifacts <strong>{selected.artifacts}</strong></span><button type="button" onClick={() => setSimOpen(true)}>Open replay <Icon name="arrow" size={16}/></button></footer></article>
          </div> : <div className="ledger-content"><div className="ledger-hero"><div><span className="micro-label">Registered guarantee boundary</span><h3>Four pilot adapters.<br/>Zero hidden coverage.</h3></div><strong>92<span>%</span></strong></div><div className="ledger-grid">{integrations.slice(0, 4).map((item, index) => <article key={item.name}><span>0{index + 1}</span><h4>{item.name}</h4><p>{item.role}</p><small>{item.state}</small></article>)}</div><p className="ledger-note"><Icon name="shield" size={18}/>Anything outside a registered adapter is visibly excluded from Concord&apos;s assurance claim.</p></div>}
        </div>
      </div>
      {simOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSimOpen(false); }}><section className="simulation-modal" role="dialog" aria-modal="true" aria-labelledby="simulation-title"><div className="modal-head"><div><span className="demo-badge">Safe planning mode</span><h3 id="simulation-title">Simulate a revocation</h3></div><button className="modal-close" type="button" onClick={() => setSimOpen(false)} aria-label="Close simulation">×</button></div><p>This endpoint produces a deterministic action plan. It has no credentials, persistence, or external write capability.</p><form onSubmit={runSimulation}><label>Registered source object<input name="sourceId" defaultValue="sharepoint://strategy/fy27" required maxLength={120}/></label><div className="form-grid"><label>Principal type<select name="principalType" defaultValue="group"><option value="group">Group</option><option value="user">User</option></select></label><label>Vector records<input name="vectorRecords" type="number" defaultValue="128" min="0" max="10000"/></label><label>Cache keys<input name="cacheKeys" type="number" defaultValue="16" min="0" max="1000"/></label></div><label className="check-label"><input name="proofEndpoint" type="checkbox" defaultChecked/><span><Icon name="check" size={15}/></span>Identity-aware retrieval probe is registered</label><button className="button button-amber" type="submit" disabled={busy}>{busy ? "Calculating…" : "Generate safe plan"}<Icon name="arrow" size={17}/></button></form>{error && <p className="form-error" role="alert">{error}</p>}{simResult && <div className="simulation-result" aria-live="polite"><div><span>Affected artifacts</span><strong>{simResult.affectedArtifacts}</strong></div><div><span>Expected coverage</span><strong>{simResult.expectedCoverage}%</strong></div><div><span>Approval</span><strong>{simResult.approvalRequired ? "Required" : "Not required"}</strong></div><p><Icon name="shield" size={16}/>Plan only · 0 external writes {simResult.exceptions.length ? `· ${simResult.exceptions.length} exception` : "· behavioral proof available"}</p></div>}</section></div>}
    </section>
  );
}

function EnterpriseBoundary() {
  return <section className="integration-section" id="integrations" aria-labelledby="integrations-title"><div className="integration-copy"><div className="section-kicker"><span>03</span> Integration architecture</div><p className="eyebrow">Built for the enterprise graph</p><h2 id="integrations-title">One boundary.<br/>Every system knows its role.</h2><p className="lead">Standard enterprise tools plug in through explicit contracts: source events, identity context, derivative actions, proof probes, and workflow notifications.</p></div><div className="integration-orbit" aria-label="Enterprise integration model"><div className="orbit-ring orbit-one"/><div className="orbit-ring orbit-two"/><div className="orbit-ring orbit-three"/><div className="orbit-center"><span className="brand-glyph" aria-hidden="true"><i/><i/><i/></span><strong>Concord</strong><small>Assurance plane</small></div><div className="orbit-chip chip-sp"><b>SP</b><span>SharePoint<small>Authority</small></span></div><div className="orbit-chip chip-en"><b>EN</b><span>Entra<small>Identity</small></span></div><div className="orbit-chip chip-pc"><b>PC</b><span>Pinecone<small>Derivative</small></span></div><div className="orbit-chip chip-rd"><b>RD</b><span>Redis<small>Cache</small></span></div><div className="orbit-chip chip-sl"><b>SL</b><span>Slack<small>Workflow</small></span></div><div className="orbit-chip chip-cf"><b>CF</b><span>Confluence<small>Planned</small></span></div></div><div className="contract-strip">{[["Authority", "Observe the source truth", "SharePoint + Entra"], ["Control", "Plan and coordinate safely", "Concord workflow"], ["Derivative", "Quarantine and repair", "Pinecone + Redis"], ["Proof", "Read back and retrieve", "Customer API"]].map(([title, detail, example], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p><small>{example}</small></article>)}</div></section>;
}

function LaunchGates() {
  const icons: IconName[] = ["code", "pulse", "shield", "layers"];
  return <section className="gates-section" id="architecture" aria-labelledby="gates-title"><div className="gates-copy"><div className="section-kicker dark-kicker"><span>04</span> Production path</div><p className="eyebrow">The next honest milestone</p><h2 id="gates-title">Four gates between a compelling demo and a safety claim.</h2><p>These gates are part of the product, not a footnote. Each produces evidence that the next decision can inspect.</p></div><div className="gate-stack">{readinessReport.gates.map((gate, index) => <article key={gate}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{gate}</h3><p>{["Real authority event → complete registered lineage.", "Retry storm → one safe final state.", "Revoked identity → zero protected results.", "Failure → contained tenant and recoverable service."][index]}</p></div><Icon name={icons[index]}/></article>)}</div></section>;
}

export default function ConcordApp() {
  return <main><section className="hero" id="top"><nav className="site-nav" aria-label="Primary navigation"><a href="#top" aria-label="Concord home"><ConcordMark/></a><div className="nav-links"><a href="#product">Product</a><a href="/pricing">Pricing</a><a href="/value">Value</a><a href="/intelligence">Radar</a></div><a className="nav-cta" href="/workspace">Open workspace <Icon name="arrow" size={16}/></a></nav><div className="hero-glow hero-glow-left"/><div className="hero-glow hero-glow-right"/><div className="hero-grid"><div className="hero-copy"><div className="hero-chip"><span/>Design-partner release · bounded assurance</div><h1>Trust the state<br/><em>after the source</em><br/>changes.</h1><p>Concord is the independent assurance plane for AI-derived data—tracing registered artifacts, repairing invalid state, and proving what a revoked identity can retrieve.</p><div className="hero-actions"><a className="button button-amber" href="/workspace">Connect your first app free <Icon name="arrow" size={18}/></a><a className="text-link" href="#readiness"><Icon name="play" size={16}/>See the launch verdict</a></div></div><div className="hero-visual" aria-label="Concord connects source authority to derived AI systems"><Image src="/concord-hero.png" alt="Abstract forest and illuminated desert joined by data paths" fill priority sizes="(max-width: 1100px) 92vw, 50vw"/><div className="hero-visual-shade"/><div className="hero-system system-source"><span>Source truth</span><strong>SharePoint</strong><small>Permission revoked</small></div><div className="hero-system system-control"><span className="brand-glyph"><i/><i/><i/></span><strong>Concord</strong><small>Observe · reconcile · prove</small></div><div className="hero-system system-state"><span>Derived state</span><strong>Pinecone + Redis</strong><small>144 artifacts verified</small></div><div className="signal-path signal-a"/><div className="signal-path signal-b"/></div></div><div className="hero-bottom"><p>Independent by design</p><div><span>Registered lineage</span><span>Reversible action</span><span>Behavioral proof</span></div></div></section><ReadinessPanel/><ProductConsole/><EnterpriseBoundary/><LaunchGates/><section className="final-cta"><div><ConcordMark/><p>AI state changes. Evidence should keep up.</p></div><h2>Build the first<br/><em>provable</em> control loop.</h2><a className="button button-amber" href="/workspace">Start with one application <Icon name="arrow" size={18}/></a></section><footer className="site-footer"><span>Concord · AI Assurance</span><p>Product simulation · No external systems are modified</p><a href="#top">Back to top ↑</a></footer></main>;
}
