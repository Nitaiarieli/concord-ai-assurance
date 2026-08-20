"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { AssuranceCase } from "@/lib/concord";
import { cases, integrations, readinessReport } from "@/lib/concord";

type IconName = "arrow" | "check" | "clock" | "code" | "layers" | "play" | "pulse" | "shield" | "terminal";
type ApplicationName = "SharePoint" | "Entra" | "Pinecone" | "Redis" | "Slack" | "Confluence";

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

function ApplicationIcon({ name }: { name: ApplicationName }) {
  const marks: Record<ApplicationName, React.ReactNode> = {
    SharePoint: <><circle cx="20" cy="16" r="8" fill="#18A28B"/><circle cx="11" cy="16" r="7" fill="#087E6B"/><path d="M19 10h8.5A2.5 2.5 0 0 1 30 12.5v10a2.5 2.5 0 0 1-2.5 2.5H19z" fill="#0F6F61"/><path d="M6 10h11v14H6z" fill="#075B50"/><path d="M14.2 14.1c-.8-.5-1.7-.7-2.5-.7-1.1 0-1.7.4-1.7 1s.5.8 1.9 1.2c2 .5 3 1.4 3 3 0 1.9-1.5 3-3.8 3-1.2 0-2.5-.3-3.4-.9l.8-1.8c.8.5 1.8.8 2.7.8 1.1 0 1.7-.4 1.7-1s-.5-.8-1.9-1.2c-2-.5-3-1.5-3-3 0-1.8 1.5-3 3.7-3 1.1 0 2.2.3 3.1.8z" fill="white"/></>,
    Entra: <><defs><linearGradient id="entra-a" x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse"><stop stopColor="#7B5CFA"/><stop offset=".52" stopColor="#2F7DE1"/><stop offset="1" stopColor="#20B8C8"/></linearGradient></defs><path d="M16 3 27.7 9.8v12.4L16 29 4.3 22.2V9.8z" fill="url(#entra-a)"/><path d="m10.1 19.8 5.9-10 5.9 10-5.9-3.1z" fill="white" fillOpacity=".92"/></>,
    Pinecone: <><circle cx="16" cy="16" r="4" fill="#121A17"/><g stroke="#18B89A" strokeWidth="2.4" strokeLinecap="round"><path d="M16 3v7M16 22v7M3 16h7M22 16h7M6.8 6.8l5 5M20.2 20.2l5 5M25.2 6.8l-5 5M11.8 20.2l-5 5"/></g><circle cx="16" cy="16" r="2" fill="#18B89A"/></>,
    Redis: <><path d="m5 20 11 5 11-5-11-5z" fill="#A51F17"/><path d="m5 15 11 5 11-5-11-5z" fill="#D82C20"/><path d="m5 10 11 5 11-5-11-5z" fill="#F04438"/><path d="m11.5 9.8 4.5-2 4.5 2-4.5 2z" fill="white"/><circle cx="22.8" cy="11" r="1.2" fill="#FFE18B"/></>,
    Slack: <><rect x="13" y="3" width="6" height="12" rx="3" fill="#36C5F0"/><rect x="17" y="13" width="12" height="6" rx="3" fill="#2EB67D"/><rect x="13" y="17" width="6" height="12" rx="3" fill="#ECB22E"/><rect x="3" y="13" width="12" height="6" rx="3" fill="#E01E5A"/><circle cx="10" cy="10" r="3" fill="#36C5F0"/><circle cx="22" cy="10" r="3" fill="#2EB67D"/><circle cx="22" cy="22" r="3" fill="#ECB22E"/><circle cx="10" cy="22" r="3" fill="#E01E5A"/></>,
    Confluence: <><path d="M7.2 19.7c-.7 1.1-1.5 2.4-2.5 3.8-.4.6-.2 1.4.4 1.8l4.1 2.5c.6.4 1.4.2 1.8-.4 2.8-4.3 5.1-3.6 10.1-1.2l2.1 1c.7.3 1.4 0 1.7-.7l2-4.4c.3-.7 0-1.5-.7-1.8-1.4-.7-2.8-1.4-4.2-2-6.4-3-10.7-4.8-14.8 1.4z" fill="#1868DB"/><path d="M24.8 12.3c.7-1.1 1.5-2.4 2.5-3.8.4-.6.2-1.4-.4-1.8l-4.1-2.5c-.6-.4-1.4-.2-1.8.4-2.8 4.3-5.1 3.6-10.1 1.2l-2.1-1c-.7-.3-1.4 0-1.7.7l-2 4.4c-.3.7 0 1.5.7 1.8 1.4.7 2.8 1.4 4.2 2 6.4 3 10.7 4.8 14.8-1.4z" fill="#2684FF"/></>,
  };
  return <svg className="application-icon" aria-hidden="true" viewBox="0 0 32 32">{marks[name]}</svg>;
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
      <div className="section-kicker dark-kicker"><span>06</span> Independent assessment</div>
      <div className="readiness-grid">
        <div><p className="eyebrow">Launch decision / 20 Aug 2026</p><h2 id="readiness-title">Ready to prove.<br/>Not ready to promise.</h2><p className="lead muted-light">The product boundaries are clearly defined. The implementation evidence is not yet strong enough to support a production safety claim.</p></div>
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
      <div className="product-copy"><div className="section-kicker"><span>03</span> Product experience</div><div><p className="eyebrow">The assurance control room</p><h2 id="product-title">Every claim earns its evidence.</h2></div><p className="lead">Concord does not treat a successful API response as proof. It shows what changed, what was in scope, what was repaired, and whether the final user experience was actually corrected.</p></div>
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
  const applications: { name: ApplicationName; role: string; className: string; state: "live" | "planned" }[] = [
    { name: "SharePoint", role: "Authority", className: "chip-sp", state: "live" },
    { name: "Entra", role: "Identity", className: "chip-en", state: "live" },
    { name: "Pinecone", role: "Derivative", className: "chip-pc", state: "live" },
    { name: "Redis", role: "Cache", className: "chip-rd", state: "live" },
    { name: "Slack", role: "Workflow", className: "chip-sl", state: "live" },
    { name: "Confluence", role: "Planned", className: "chip-cf", state: "planned" },
  ];
  return <section className="integration-section" id="integrations" aria-labelledby="integrations-title"><div className="integration-copy"><div className="section-kicker"><span>05</span> Integration architecture</div><p className="eyebrow">Your enterprise graph, continuously assured</p><h2 id="integrations-title">One assurance layer.<br/>Every system stays in sync.</h2><p className="lead">Concord gives each application an explicit role—source of truth, identity authority, derivative system, cache, or workflow—then traces every change across the complete boundary.</p></div><div className="integration-orbit" aria-label="Concord assurance boundary and connected enterprise applications"><div className="orbit-field-label"><span/>Registered assurance boundary</div><div className="orbit-ring orbit-one"/><div className="orbit-ring orbit-two"/><div className="orbit-ring orbit-three"/><div className="orbit-center"><span className="brand-glyph" aria-hidden="true"><i/><i/><i/></span><strong>Concord</strong><small>Assurance plane</small><em>Continuously verified</em></div>{applications.map((application) => <div className={`orbit-chip ${application.className} ${application.state === "planned" ? "orbit-chip-planned" : ""}`} key={application.name}><span className="orbit-app-mark"><ApplicationIcon name={application.name}/></span><span>{application.name}<small>{application.role}</small></span><i className="orbit-status" aria-label={application.state === "live" ? "Connected" : "Planned"}/></div>)}</div><div className="contract-strip">{[["Authority", "Observe the source truth", "SharePoint + Entra"], ["Control", "Coordinate every change", "Concord workflow"], ["Derivative", "Quarantine and repair", "Pinecone + Redis"], ["Proof", "Verify the final experience", "Identity-aware probe"]].map(([title, detail, example], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p><small>{example}</small></article>)}</div></section>;
}

function LaunchGates() {
  const icons: IconName[] = ["code", "pulse", "shield", "layers"];
  return <section className="gates-section" id="architecture" aria-labelledby="gates-title"><div className="gates-copy"><div className="section-kicker dark-kicker"><span>07</span> Production path</div><p className="eyebrow">The next honest milestone</p><h2 id="gates-title">Four gates between a compelling demo and a safety claim.</h2><p>These gates are part of the product, not a footnote. Each one produces evidence for the next launch decision.</p></div><div className="gate-stack">{readinessReport.gates.map((gate, index) => <article key={gate}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{gate}</h3><p>{["Real authority event → complete registered lineage.", "Retry storm → one safe final state.", "Revoked identity → zero protected results.", "Failure → contained tenant and recoverable service."][index]}</p></div><Icon name={icons[index]}/></article>)}</div></section>;
}

function ProblemLandscape() {
  return <section className="rift-problem" id="problem" aria-labelledby="problem-title">
    <div className="rift-problem-copy reveal-on-scroll">
      <p className="terrain-kicker"><span>01</span> The hidden failure</p>
      <h2 id="problem-title">Permissions change.<br/><em>AI copies do not.</em></h2>
      <p>Enterprise AI creates indexes, embeddings, caches, summaries, and agent memory from trusted systems. When the source changes, those copies can keep serving information that is no longer valid.</p>
    </div>
    <div className="rift-stage" aria-label="A source permission changes while derived AI data remains stale">
      <div className="rift-rock rift-rock-left"><span>Source system</span><strong>Access revoked</strong><small>SharePoint · 09:42:16</small></div>
      <div className="rift-depth" aria-hidden="true"/>
      <div className="rift-rock rift-rock-right"><span>AI systems</span><strong>Still retrievable</strong><small>Vector · Cache · Agent memory</small></div>
      <div className="rift-warning"><span>!</span>Control gap</div>
    </div>
    <div className="problem-consequence reveal-on-scroll">
      <span>Without Concord</span>
      <p>Teams discover the mismatch through an incident, an audit, or a user who sees something they should not.</p>
    </div>
  </section>;
}

function PropagationJourney() {
  const chapters = [
    { number: "01", label: "Observe", title: "Catch the authority change.", body: "Concord listens to the system that owns the truth—such as SharePoint, Jira, Confluence, or Slack—and identifies the exact object, identity, and policy that changed.", meta: "Source event · identity context" },
    { number: "02", label: "Reconcile", title: "Repair only what became invalid.", body: "Registered lineage shows which indexes, vectors, cache keys, summaries, and agent states depend on that source. Concord quarantines and repairs the affected state instead of rebuilding everything.", meta: "Targeted repair · reversible action" },
    { number: "03", label: "Prove", title: "Test the outcome as the affected user.", body: "A destination read-back confirms the data changed. An identity-aware retrieval test confirms the revoked user can no longer retrieve it. The complete evidence chain is preserved.", meta: "Behavioral proof · audit evidence" },
  ];
  return <section className="propagation-story" id="how-it-works" aria-labelledby="journey-title">
    <header className="journey-heading reveal-on-scroll">
      <p className="terrain-kicker"><span>02</span> How Concord works</p>
      <h2 id="journey-title">One change.<br/><em>Every affected system.</em></h2>
      <p>Concord closes the gap between the system that owns the truth and every AI system that depends on it.</p>
    </header>
    <div className="journey-layout">
      <div className="journey-terrain" aria-hidden="true">
        <div className="journey-source"><span>Authority</span><strong>SharePoint</strong><i/></div>
        <div className="journey-current"><i/><b>Concord</b></div>
        <div className="journey-derivatives"><span>Vector</span><span>Cache</span><span>Agent</span><span>Search</span></div>
        <div className="journey-proof"><b>✓</b><span>Revoked identity</span><strong>0 results</strong></div>
      </div>
      <div className="journey-chapters">{chapters.map((chapter) => <article className="journey-chapter reveal-on-scroll" key={chapter.number}><div><span>{chapter.number}</span><small>{chapter.label}</small></div><h3>{chapter.title}</h3><p>{chapter.body}</p><footer>{chapter.meta}</footer></article>)}</div>
    </div>
  </section>;
}

function CustomerValue() {
  return <section className="outcome-landscape" id="outcomes" aria-labelledby="outcome-title">
    <div className="outcome-horizon" aria-hidden="true"/>
    <div className="outcome-intro reveal-on-scroll"><p className="terrain-kicker"><span>04</span> Customer value</p><h2 id="outcome-title">Less rebuilding.<br/><em>More certainty.</em></h2><p>For security, AI-platform, governance, and FinOps teams that need to operate enterprise AI without losing control of access, retention, or evidence.</p></div>
    <div className="outcome-grid">
      <article className="reveal-on-scroll"><span>01</span><h3>Reduce stale exposure</h3><p>Find invalid AI-derived data when the authority changes—not after someone reports it.</p><small>Security · Governance</small></article>
      <article className="reveal-on-scroll"><span>02</span><h3>Repair with precision</h3><p>Replace full re-indexing and broad synchronization with targeted, measurable repair.</p><small>AI Platform · FinOps</small></article>
      <article className="reveal-on-scroll"><span>03</span><h3>Prove the final state</h3><p>Give auditors and application owners a trace from source event to user-level retrieval outcome.</p><small>Compliance · Application owners</small></article>
    </div>
    <div className="outcome-actions reveal-on-scroll"><a className="button button-amber" href="/value">Explore Value &amp; FinOps <Icon name="arrow" size={18}/></a><a href="/pricing">See the pricing model →</a><span>Customer-connected metrics only. No invented savings.</span></div>
  </section>;
}

export default function ConcordApp() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const updateScroll = () => {
      if (frame || reduced) return;
      frame = window.requestAnimationFrame(() => {
        root.style.setProperty("--terrain-scroll", String(Math.min(window.scrollY, 1200)));
        frame = 0;
      });
    };
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    }), { threshold: .14 });
    document.querySelectorAll(".reveal-on-scroll").forEach((element) => observer.observe(element));
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScroll);
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <main className="immersive-home">
    <section className="hero terrain-hero" id="top">
      <nav className="site-nav" aria-label="Primary navigation"><a href="#top" aria-label="Concord home"><ConcordMark/></a><div className="nav-links"><a href="#how-it-works">How it works</a><a href="#product">Product</a><a href="/pricing">Pricing</a><a href="/value">Value</a></div><a className="nav-cta" href="/workspace">Open workspace <Icon name="arrow" size={16}/></a></nav>
      <div className="terrain-sky" aria-hidden="true"/><div className="terrain-sun" aria-hidden="true"/>
      <div className="terrain-world" aria-hidden="true"><Image className="terrain-image" src="/concord-hero.png" alt="" fill priority unoptimized sizes="100vw"/><div className="terrain-shade"/><div className="terrain-flow"><i/></div></div>
      <div className="hero-grid immersive-hero-grid"><div className="hero-copy"><div className="hero-chip"><span/>Enterprise AI assurance</div><h1>When access changes,<br/><em>your AI should change</em><br/>with it.</h1><p>Concord helps security and AI-platform teams find, repair, and prove stale permissions and content across enterprise AI systems.</p><div className="hero-actions"><a className="button button-amber" href="/workspace">Connect your first application free <Icon name="arrow" size={18}/></a><a className="text-link" href="#how-it-works"><Icon name="play" size={16}/>See how it works</a></div></div><div className="hero-proof-path" aria-label="A permission change is repaired and verified across AI systems"><div><span>Source change</span><strong>Access revoked</strong><small>SharePoint</small></div><i/><div className="proof-path-core"><span className="brand-glyph"><i/><i/><i/></span><strong>Concord</strong><small>Trace · repair · prove</small></div><i/><div><span>Verified outcome</span><strong>0 protected results</strong><small>Vector · Cache · Agent</small></div></div></div>
      <div className="hero-bottom"><p>Independent assurance for enterprise AI</p><div><span>Source truth</span><span>Registered lineage</span><span>Identity-aware proof</span></div></div><a className="scroll-cue" href="#problem" aria-label="Scroll to understand the problem"><span>Scroll</span><i/></a>
    </section>
    <ProblemLandscape/>
    <PropagationJourney/>
    <ProductConsole/>
    <CustomerValue/>
    <EnterpriseBoundary/>
    <ReadinessPanel/>
    <LaunchGates/>
    <section className="final-cta terrain-final"><div><ConcordMark/><p>Start with one real control loop. Expand when the evidence is clear.</p></div><h2>Keep AI aligned<br/>with <em>the truth.</em></h2><a className="button button-amber" href="/workspace">Connect your first application free <Icon name="arrow" size={18}/></a></section>
    <footer className="site-footer"><span>Concord · Enterprise AI Assurance</span><p>Product simulation · No external systems are modified</p><a href="#top">Back to top ↑</a></footer>
  </main>;
}
