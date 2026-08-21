"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AssuranceCase } from "@/lib/concord";
import { cases, integrations, readinessReport } from "@/lib/concord";

type IconName = "arrow" | "check" | "clock" | "code" | "layers" | "play" | "pulse" | "shield" | "terminal";
type ApplicationName = "SharePoint" | "Entra" | "Pinecone" | "Redis" | "Slack" | "Confluence";
type SystemObjectId = "source" | "vector" | "cache" | "memory" | "verification" | "evidence";
type CinematicScene = "hero" | "problem" | "lineage" | "repair" | "renewal" | "integrations" | "verification" | "gates" | "stable";

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

const cinematicScenes: Record<CinematicScene, { paths: string[]; nodes: [number, number][] }> = {
  hero: { paths: ["M-30 420 C120 330 205 440 350 330 S610 222 760 315 S930 220 1040 152", "M130 480 C222 396 270 390 348 330 M348 330 C404 250 458 240 520 188"], nodes: [[130,420],[350,330],[520,188],[760,315],[940,210]] },
  problem: { paths: ["M-20 330 C150 288 238 304 420 260", "M578 258 C735 210 874 250 1040 170"], nodes: [[120,305],[318,282],[690,230],[888,238]] },
  lineage: { paths: ["M-30 130 C180 112 238 280 420 260 S640 108 1030 145", "M420 260 C330 352 244 374 80 430", "M420 260 C570 350 710 412 970 430", "M420 260 C510 188 610 170 760 205"], nodes: [[112,122],[420,260],[80,430],[760,205],[970,430]] },
  repair: { paths: ["M-30 392 C210 340 304 392 470 270 S760 190 1030 112", "M190 410 C284 314 342 310 470 270"], nodes: [[190,356],[470,270],[690,205],[902,140]] },
  renewal: { paths: ["M-20 450 C170 430 240 342 382 372 S628 296 760 330 S920 220 1030 250", "M382 372 C360 268 312 214 232 150 M760 330 C786 224 840 168 920 120"], nodes: [[232,150],[382,372],[760,330],[920,120]] },
  integrations: { paths: ["M500 260 C330 80 142 92 42 242 C120 458 328 455 500 260 C678 72 872 92 958 242 C888 442 684 464 500 260"], nodes: [[42,242],[210,118],[500,260],[790,118],[958,242],[780,408],[220,410]] },
  verification: { paths: ["M-20 372 C172 320 258 352 420 286 S720 238 1020 142", "M420 286 C510 360 630 398 842 410"], nodes: [[124,340],[420,286],[650,232],[842,410],[930,170]] },
  gates: { paths: ["M60 424 L250 340 L438 280 L628 206 L940 112"], nodes: [[60,424],[250,340],[438,280],[628,206],[940,112]] },
  stable: { paths: ["M-30 352 C168 280 284 342 450 270 S760 232 1030 178", "M450 270 C516 188 590 164 684 142"], nodes: [[120,310],[450,270],[684,142],[900,205]] },
};

function CinematicEnvironment({ scene }: { scene: CinematicScene }) {
  const spec = cinematicScenes[scene];
  return <div className={`cinematic-environment cinema-${scene}`} aria-hidden="true">
    <span className="cinema-light"/><span className="cinema-land cinema-land-a"/><span className="cinema-land cinema-land-b"/>
    <svg className="cinema-network" viewBox="0 0 1000 520" preserveAspectRatio="none">
      {spec.paths.map((path, index) => <path className={`cinema-route cinema-route-${index + 1}`} d={path} key={path}/>) }
      {spec.nodes.map(([cx, cy], index) => <circle className={`cinema-node cinema-node-${index + 1}`} cx={cx} cy={cy} r="4" key={`${cx}-${cy}`}/>) }
    </svg>
    <span className="cinema-growth cinema-growth-a"/><span className="cinema-growth cinema-growth-b"/><span className="cinema-growth cinema-growth-c"/>
    <i className="cinema-particle particle-a"/><i className="cinema-particle particle-b"/><i className="cinema-particle particle-c"/><i className="cinema-particle particle-d"/>
  </div>;
}

function HeroAssuranceField() {
  const [focus, setFocus] = useState<"source" | "control" | "outcome">("control");
  const details = {
    source: { eyebrow: "01 · Authority changes", title: "A permission is revoked.", body: "The event is captured from the registered source of truth with object, identity, and policy context." },
    control: { eyebrow: "02 · Concord reconciles", title: "Only registered impact is repaired.", body: "Lineage identifies the affected derivatives so Concord can apply a bounded, policy-specific action." },
    outcome: { eyebrow: "03 · Behavior is verified", title: "The affected identity gets zero protected results.", body: "Destination read-back and an identity-aware retrieval probe produce evidence—not just a successful API response." },
  };
  return <div className={`hero-assurance-field hero-focus-${focus}`} aria-label="Interactive Concord assurance flow">
    <div className="hero-material hero-material-one" aria-hidden="true"/><div className="hero-material hero-material-two" aria-hidden="true"/>
    <div className="hero-system-line hero-line-one" aria-hidden="true"><i/></div><div className="hero-system-line hero-line-two" aria-hidden="true"><i/></div>
    <button className="hero-system-object hero-object-source" type="button" aria-pressed={focus === "source"} onClick={() => setFocus("source")}>
      <span className="hero-object-icon"><ApplicationIcon name="SharePoint"/></span><span><small>Authority</small><strong>Access revoked</strong></span><i aria-hidden="true"/>
    </button>
    <button className="hero-system-object hero-object-control" type="button" aria-pressed={focus === "control"} onClick={() => setFocus("control")}>
      <span className="brand-glyph" aria-hidden="true"><i/><i/><i/></span><span><small>Assurance plane</small><strong>Concord</strong></span>
    </button>
    <button className="hero-system-object hero-object-outcome" type="button" aria-pressed={focus === "outcome"} onClick={() => setFocus("outcome")}>
      <span className="hero-object-icon hero-proof-icon"><Icon name="shield" size={24}/></span><span><small>Behavioral proof</small><strong>0 protected results</strong></span><i aria-hidden="true"/>
    </button>
    <div className="hero-field-detail" aria-live="polite"><span>{details[focus].eyebrow}</span><strong>{details[focus].title}</strong><p>{details[focus].body}</p></div>
    <p className="hero-field-hint">Select a system object to inspect the control path.</p>
  </div>;
}

function ReadinessPanel() {
  return (
    <section className="readiness-wrap cinematic-host" id="readiness" aria-labelledby="readiness-title" data-motion-section="verification">
      <CinematicEnvironment scene="verification"/>
      <div className="section-kicker dark-kicker"><span>006/</span> Evidence and readiness</div>
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
    <section className="product-section cinematic-host" id="product" aria-labelledby="product-title" data-motion-section="repair">
      <CinematicEnvironment scene="repair"/>
      <div className="product-copy"><div className="section-kicker"><span>005/</span> Product control surface</div><div><p className="eyebrow">The assurance control room</p><h2 id="product-title">Every claim earns its evidence.</h2></div><p className="lead">Concord does not treat a successful API response as proof. It shows what changed, what was in scope, what was repaired, and whether the final user experience was actually corrected.</p></div>
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
  const applications: { name: ApplicationName; role: string; className: string; state: "contract" | "target" }[] = [
    { name: "SharePoint", role: "Knowledge target", className: "chip-sp", state: "target" },
    { name: "Entra", role: "Identity target", className: "chip-en", state: "target" },
    { name: "Pinecone", role: "MVP contract", className: "chip-pc", state: "contract" },
    { name: "Redis", role: "MVP contract", className: "chip-rd", state: "contract" },
    { name: "Slack", role: "Messaging target", className: "chip-sl", state: "target" },
    { name: "Confluence", role: "Knowledge target", className: "chip-cf", state: "target" },
  ];
  return <section className="integration-section cinematic-host" id="integrations" aria-labelledby="integrations-title" data-motion-section="integrations"><CinematicEnvironment scene="integrations"/><div className="integration-copy"><div className="section-kicker"><span>004/</span> Integration architecture</div><p className="eyebrow">A universal connector contract</p><h2 id="integrations-title">One assurance layer.<br/>Each system has a role.</h2><p className="lead">BookStack and Zulip are the first proof environments. The reusable contract then expands across applications, identity systems, AI transformations, destinations, and retrieval interfaces without changing Concord&apos;s core loop.</p><a className="integration-coverage-link" href="/coverage">Explore the enterprise coverage plan →</a></div><div className="integration-orbit" aria-label="Reference enterprise ecosystem for the Concord connector platform"><div className="orbit-field-label"><span/>Reference ecosystem · coverage varies</div><div className="orbit-ring orbit-one"/><div className="orbit-ring orbit-two"/><div className="orbit-ring orbit-three"/><div className="orbit-center"><span className="brand-glyph" aria-hidden="true"><i/><i/><i/></span><strong>Concord</strong><small>Reusable contract</small><em>Coverage is explicit</em></div>{applications.map((application) => <div className={`orbit-chip ${application.className} ${application.state === "target" ? "orbit-chip-planned" : ""}`} key={application.name}><span className="orbit-app-mark"><ApplicationIcon name={application.name}/></span><span>{application.name}<small>{application.role}</small></span><i className="orbit-status" aria-label={application.state === "contract" ? "MVP contract" : "Target category"}/></div>)}</div><div className="contract-strip">{[["Authority", "Observe the source truth", "BookStack + Zulip"], ["Control", "Normalize every change", "Canonical events"], ["Derivative", "Quarantine and repair", "Pinecone + Redis"], ["Proof", "Verify the final experience", "Identity-aware probe"]].map(([title, detail, example], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p><small>{example}</small></article>)}</div></section>;
}

function AdapterRegistry() {
  return <section className="adapter-registry cinematic-host" id="adapter-registry" aria-labelledby="adapter-registry-title" data-motion-section="gates">
    <CinematicEnvironment scene="gates"/>
    <div className="adapter-registry-heading">
      <div className="section-kicker dark-kicker"><span>007/</span> Adapter registry</div>
      <p className="eyebrow">Coverage is explicit</p>
      <h2 id="adapter-registry-title">Supported, planned,<br/><em>or outside the claim.</em></h2>
      <p>Every adapter publishes its operational role and current coverage state. Anything unregistered remains visible as unsupported instead of being silently treated as protected.</p>
    </div>
    <div className="adapter-list" role="list" aria-label="Concord adapter registry">
      {integrations.map((integration, index) => <article role="listitem" key={integration.name}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <h3>{integration.name}</h3>
        <p>{integration.role}</p>
        <small><i className={integration.state.includes("contract") ? "adapter-live" : "adapter-planned"}/>{integration.state}</small>
        <b>{integration.state.includes("contract") ? "Registered contract" : "Planned"}</b>
      </article>)}
    </div>
  </section>;
}

function LaunchGates() {
  const icons: IconName[] = ["code", "pulse", "shield", "layers"];
  return <section className="gates-section" id="architecture" aria-labelledby="gates-title"><div className="gates-copy"><div className="section-kicker dark-kicker"><span>008/</span> Production path</div><p className="eyebrow">The next honest milestone</p><h2 id="gates-title">Four gates between a compelling demo and a safety claim.</h2><p>These gates are part of the product, not a footnote. Each one produces evidence for the next launch decision.</p></div><div className="gate-stack">{readinessReport.gates.map((gate, index) => <article key={gate}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{gate}</h3><p>{["Real authority event → complete registered lineage.", "Retry storm → one safe final state.", "Revoked identity → zero protected results.", "Failure → contained tenant and recoverable service."][index]}</p></div><Icon name={icons[index]}/></article>)}</div></section>;
}

function ProblemLandscape() {
  return <section className="rift-problem cinematic-host" id="problem" aria-labelledby="problem-title" data-motion-section="problem">
    <CinematicEnvironment scene="problem"/>
    <div className="rift-problem-copy reveal-on-scroll">
      <p className="terrain-kicker"><span>001/</span> The hidden failure</p>
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
  const [activeStage, setActiveStage] = useState(0);
  const [selectedObject, setSelectedObject] = useState<SystemObjectId>("source");
  const [activeDetail, setActiveDetail] = useState<"risk" | "action" | "proof">("risk");
  const chapters = [
    { number: "01", label: "Detect", title: "Capture the change at the authority.", body: "A permission, identity, retention rule, or source object changes in a registered enterprise system. Concord records the event with exact object, identity, policy, and adapter context.", meta: "Authority event · Policy evaluation", stage: "Validity-changing event captured" },
    { number: "02", label: "Trace", title: "Resolve every registered dependency.", body: "Cross-vendor lineage maps the source object to affected chunks, embeddings, vector records, cache keys, summaries, and agent memory across supported destinations.", meta: "Registered lineage · Impact preview", stage: "Affected derivatives identified" },
    { number: "03", label: "Repair", title: "Apply the smallest safe remediation.", body: "Concord calculates an idempotent, policy-specific action: quarantine, update, delete, invalidate, recompute, change access, or invoke a controlled callback.", meta: "Targeted action · Idempotent execution", stage: "Bounded repair in progress" },
    { number: "04", label: "Verify", title: "Read back the destination. Test real retrieval.", body: "Concord confirms the destination state, then tests the retrieval path as the affected identity. A successful write or API response alone is never presented as proof.", meta: "Destination read-back · Identity-aware probe", stage: "Outcome behavior verified" },
    { number: "05", label: "Prove", title: "Preserve the evidence—and the exceptions.", body: "The final record separates verified, repairing, unresolved, unsupported, and accepted-risk states while preserving exposure time, actions, exceptions, and supporting evidence.", meta: "Coverage state · Exposure · Evidence", stage: "Evidence package preserved" },
  ];
  const stageVisuals: { from: { eyebrow: string; title: string; detail: string; icon: React.ReactNode }; to: { eyebrow: string; title: string; detail: string; icon: React.ReactNode } }[] = [
    { from: { eyebrow: "Authoritative source", title: "Access revoked", detail: "SharePoint · 09:42:16", icon: <ApplicationIcon name="SharePoint"/> }, to: { eyebrow: "Captured event", title: "Change registered", detail: "Object · Identity · Policy", icon: <Icon name="pulse" size={24}/> } },
    { from: { eyebrow: "Registered lineage", title: "Source mapped", detail: "Object → chunks → records", icon: <Icon name="layers" size={24}/> }, to: { eyebrow: "Impact set", title: "144 artifacts found", detail: "Vectors · Cache · Memory", icon: <Icon name="pulse" size={24}/> } },
    { from: { eyebrow: "Affected state", title: "144 artifacts selected", detail: "Policy-specific scope", icon: <Icon name="layers" size={24}/> }, to: { eyebrow: "Targeted repair", title: "Remediation applied", detail: "128 vectors · 16 cache keys", icon: <Icon name="check" size={24}/> } },
    { from: { eyebrow: "Destination read-back", title: "144 states confirmed", detail: "Write response is not enough", icon: <Icon name="code" size={24}/> }, to: { eyebrow: "Identity-aware probe", title: "0 protected results", detail: "Real retrieval path tested", icon: <Icon name="shield" size={24}/> } },
    { from: { eyebrow: "Verified outcome", title: "Exposure measured", detail: "8m 42s invalid-state window", icon: <Icon name="shield" size={24}/> }, to: { eyebrow: "Evidence record", title: "Case CR-0841", detail: "Coverage · Actions · Exceptions", icon: <Icon name="check" size={24}/> } },
  ];
  const objects: Record<SystemObjectId, { eyebrow: string; title: string; summary: string; risk: string; dependency: string; action: string; proof: string; value: string }> = {
    source: { eyebrow: "Authoritative source", title: "SharePoint access state", summary: "The registered enterprise system that owns the current truth for this object and identity.", risk: "A permission or source object can change after AI derivatives have already been created.", dependency: "Concord resolves only lineage registered through supported adapters and customer-controlled identifiers.", action: "Observe the event, preserve its context, and calculate downstream impact. The authority itself remains customer-controlled.", proof: "The source event and current authority state are preserved as calculation evidence.", value: "Earlier detection shortens the period in which downstream AI state may remain invalid." },
    vector: { eyebrow: "Registered derivative", title: "Vector records", summary: "Embeddings and vector records derived from the affected source object.", risk: "A semantically searchable copy can remain retrievable after the source permission or content changes.", dependency: "Object-to-chunk and chunk-to-vector mappings connect the source to affected records.", action: "Quarantine, delete, update, or recompute only the registered records selected by policy.", proof: "Destination read-back confirms record state before the behavioral retrieval test runs.", value: "Targeted repair can avoid broad re-indexing and reduce manual platform work." },
    cache: { eyebrow: "Registered derivative", title: "Cache state", summary: "Cached responses or keys that can preserve a result after its upstream authority has changed.", risk: "A valid-looking response may outlive the permission, retention rule, or source data that created it.", dependency: "Registered cache keys and namespaces link the cached result to the source and affected identities.", action: "Invalidate or update the affected keys with an idempotent operation.", proof: "A destination read confirms invalidation before the affected identity is tested.", value: "Precise invalidation reduces stale exposure without clearing unrelated customer state." },
    memory: { eyebrow: "Registered derivative", title: "Agent memory", summary: "Persistent AI or agent state derived from enterprise knowledge and prior interactions.", risk: "An agent may continue using remembered content after that content is no longer valid for a user or workflow.", dependency: "Registered memory references and callback contracts connect the state to its source lineage.", action: "Update, delete, recompute, adjust access control, or invoke a controlled callback according to policy.", proof: "The destination state and subsequent agent retrieval behavior are both recorded.", value: "Teams gain a repeatable path to reconcile persistent AI state across vendor boundaries." },
    verification: { eyebrow: "Verification checkpoint", title: "Identity-aware proof", summary: "A final test of what the affected identity can actually retrieve after remediation.", risk: "A successful write or API response can still leave the real user experience unchanged.", dependency: "The probe uses the affected identity and a registered destination retrieval path.", action: "Read back the destination, run the behavioral probe, and classify the outcome.", proof: "The result is marked verified, repairing, unresolved, or unsupported with timestamped evidence.", value: "Security and application owners can evaluate the real outcome instead of trusting process completion." },
    evidence: { eyebrow: "Evidence record", title: "Bounded assurance report", summary: "The traceable record connecting source event, impact, action, verification, exposure, and exceptions.", risk: "Without a shared evidence chain, teams must reconstruct incidents and audits manually.", dependency: "Each record references the registered adapter, policy, calculation inputs, destination response, and probe result.", action: "Preserve the result and unresolved exception; no unsupported outcome is silently upgraded to verified.", proof: "Coverage, timestamps, identities, actions, and supporting artifacts remain inspectable.", value: "A clear assurance record improves auditability and operational confidence without making universal consistency claims." },
  };
  const selected = objects[selectedObject];
  const stageObjectGroups: Record<SystemObjectId, number[]> = {
    source: [0, 1],
    vector: [1, 2],
    cache: [1, 2],
    memory: [1, 2],
    verification: [3],
    evidence: [4],
  };
  const detailContent = {
    risk: { label: "Why it matters", body: selected.risk },
    action: { label: "Concord action", body: selected.action },
    proof: { label: "Required evidence", body: selected.proof },
  };

  useEffect(() => {
    const stageNodes = document.querySelectorAll<HTMLElement>(".workflow-chapter[data-stage]");
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveStage(Number((visible.target as HTMLElement).dataset.stage ?? 0));
    }, { rootMargin: "-30% 0px -48%", threshold: [0, .2, .5, .8] });
    stageNodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const objectButton = (id: SystemObjectId, label: string, sublabel: string, icon: React.ReactNode) => <button id={`workflow-object-${id}`} className={`workflow-object ${selectedObject === id ? "object-selected" : ""} ${stageObjectGroups[id].includes(activeStage) ? "object-stage-active" : ""}`} type="button" role="tab" aria-selected={selectedObject === id} aria-controls="workflow-inspector-panel" onClick={() => { setSelectedObject(id); setActiveDetail("risk"); }}><span className="workflow-object-icon">{icon}</span><span><small>{sublabel}</small><strong>{label}</strong></span></button>;
  const setWorkflowStage = (index: number) => setActiveStage(index);
  const activeVisual = stageVisuals[activeStage];
  return <section className="propagation-story cinematic-host" id="how-it-works" aria-labelledby="journey-title" data-motion-section="lineage">
    <CinematicEnvironment scene="lineage"/>
    <header className="journey-heading reveal-on-scroll">
      <p className="terrain-kicker"><span>002/</span> How Concord works</p>
      <h2 id="journey-title">A living control path<br/><em>from change to proof.</em></h2>
      <p>Scroll through the workflow. Select any system object to inspect its risk, dependency, permitted action, verification method, and business value.</p>
    </header>
    <div className="workflow-layout">
      <div className={`workflow-sticky workflow-stage-${activeStage}`}>
        <div className="workflow-scene" aria-label="Interactive Concord dependency and reconciliation system">
          <div className="workflow-light" aria-hidden="true"/><div className="workflow-ground" aria-hidden="true"/>
          <header className="workflow-stage-header">
            <div className="workflow-stage-readout" aria-live="polite"><span>Guided example · Demo data</span><strong>{chapters[activeStage].stage}</strong></div>
            <nav className="workflow-stage-nav" aria-label="Assurance workflow stages">{chapters.map((chapter, index) => <button key={chapter.number} type="button" aria-current={activeStage === index ? "step" : undefined} onClick={() => setWorkflowStage(index)}><span>{chapter.number}</span><small>{chapter.label}</small></button>)}</nav>
          </header>

          <div className="workflow-map" key={activeStage} aria-live="polite">
            <article className="workflow-map-node workflow-map-from"><span className="workflow-map-icon">{activeVisual.from.icon}</span><div><small>{activeVisual.from.eyebrow}</small><strong>{activeVisual.from.title}</strong><p>{activeVisual.from.detail}</p></div></article>
            <span className="workflow-route workflow-route-in" aria-hidden="true"><i/></span>
            <div className="workflow-core" aria-label="Concord assurance plane"><span className="brand-glyph" aria-hidden="true"><i/><i/><i/></span><strong>Concord</strong><small>Assurance plane</small><i aria-hidden="true"/></div>
            <span className="workflow-route workflow-route-out" aria-hidden="true"><i/></span>
            <article className="workflow-map-node workflow-map-to"><span className="workflow-map-icon">{activeVisual.to.icon}</span><div><small>{activeVisual.to.eyebrow}</small><strong>{activeVisual.to.title}</strong><p>{activeVisual.to.detail}</p></div></article>
          </div>

          <section className="workflow-explorer" aria-labelledby="workflow-explorer-title">
            <div className="workflow-explorer-heading"><div><span>Registered assurance objects</span><h3 id="workflow-explorer-title">Explore the control contract</h3></div><p>Select one object to inspect what can fail, what Concord can do, and what evidence is required.</p></div>
            <div className="workflow-object-tabs" role="tablist" aria-label="Registered assurance objects">
              {objectButton("source", "Source", "Authority", <ApplicationIcon name="SharePoint"/>)}
              {objectButton("vector", "Vectors", "Derivative", <ApplicationIcon name="Pinecone"/>)}
              {objectButton("cache", "Cache", "Derivative", <ApplicationIcon name="Redis"/>)}
              {objectButton("memory", "Memory", "Derivative", <Icon name="layers" size={22}/>)}
              {objectButton("verification", "Probe", "Verification", <Icon name="shield" size={22}/>)}
              {objectButton("evidence", "Evidence", "Record", <Icon name="check" size={22}/>)}
            </div>

            <aside id="workflow-inspector-panel" className="workflow-object-panel" role="tabpanel" aria-labelledby={`workflow-object-${selectedObject}`} aria-live="polite">
              <div className="workflow-object-summary"><span>{selected.eyebrow}</span><h3>{selected.title}</h3><p>{selected.summary}</p></div>
              <div className="workflow-object-detail">
                <div className="workflow-detail-tabs" role="tablist" aria-label="Object detail categories">{(["risk", "action", "proof"] as const).map((detail) => <button id={`workflow-detail-tab-${detail}`} key={detail} type="button" role="tab" aria-selected={activeDetail === detail} aria-controls="workflow-detail-panel" onClick={() => setActiveDetail(detail)}>{detail === "risk" ? "Risk" : detail === "action" ? "Action" : "Proof"}</button>)}</div>
                <div id="workflow-detail-panel" className="workflow-detail-panel" role="tabpanel" aria-labelledby={`workflow-detail-tab-${activeDetail}`}><span>{detailContent[activeDetail].label}</span><p>{detailContent[activeDetail].body}</p></div>
                <details className="workflow-more"><summary>Registered boundary and business value</summary><div><p><strong>Boundary</strong>{selected.dependency}</p><p><strong>Why it matters</strong>{selected.value}</p></div></details>
              </div>
            </aside>
          </section>
        </div>
      </div>
      <div className="journey-chapters">{chapters.map((chapter, index) => <article className={`journey-chapter workflow-chapter reveal-on-scroll ${activeStage === index ? "chapter-active" : ""}`} data-stage={index} key={chapter.number} onMouseEnter={() => setWorkflowStage(index)}><button className="workflow-chapter-selector" type="button" aria-pressed={activeStage === index} onFocus={() => setWorkflowStage(index)} onClick={() => setWorkflowStage(index)}><span>{chapter.number}</span><small>{chapter.label}</small><i aria-hidden="true"/></button><h3>{chapter.title}</h3><p>{chapter.body}</p><footer>{chapter.meta}</footer></article>)}</div>
    </div>
  </section>;
}

function EnterpriseProof() {
  const proofCase = cases[0];
  const proofApps: { name: ApplicationName; role: string; state: "Registered" | "Planned" }[] = [
    { name: "SharePoint", role: "Authority", state: "Registered" },
    { name: "Entra", role: "Identity", state: "Registered" },
    { name: "Pinecone", role: "Vector state", state: "Registered" },
    { name: "Redis", role: "Cache state", state: "Registered" },
    { name: "Slack", role: "Workflow", state: "Planned" },
    { name: "Confluence", role: "Knowledge", state: "Planned" },
  ];
  const proofPath = [
    ["What changed", "Entra access revoked"],
    ["What was affected", "144 registered artifacts"],
    ["What was repaired", "128 vectors · 16 cache keys"],
    ["What was read back", "144 destinations invalidated"],
    ["What was proven", "0 protected results"],
  ];

  return <section className="enterprise-proof cinematic-host" id="proof" aria-labelledby="enterprise-proof-title" data-motion-section="verification">
    <CinematicEnvironment scene="verification"/>
    <header className="enterprise-proof-heading reveal-on-scroll">
      <p className="terrain-kicker"><span>003/</span> Enterprise value and proof</p>
      <div><h2 id="enterprise-proof-title">One change.<br/><em>One defensible record.</em></h2><p>Security, AI-platform, governance, application, and FinOps teams see the same bounded story: what changed, what Concord repaired, what the destination returned, and what the affected identity could actually retrieve.</p></div>
    </header>

    <article className="assurance-record reveal-on-scroll" aria-label="Demonstration assurance record">
      <header><div><span className="micro-label">Guided proof · Demo data</span><h3>{proofCase.id} · {proofCase.source}</h3></div><StatusPill status={proofCase.status}/></header>
      <div className="assurance-record-path">{proofPath.map(([label, value], index) => <div key={label}><span>{String(index + 1).padStart(2, "0")}</span><small>{label}</small><strong>{value}</strong><i aria-hidden="true"/></div>)}</div>
      <footer><div><span>Invalid-state exposure</span><strong>{proofCase.exposure}</strong></div><div><span>Registered coverage</span><strong>{proofCase.coverage}%</strong></div><div><span>Proof level</span><strong>{proofCase.proofLevel}</strong></div><p><Icon name="shield" size={18}/>{proofCase.risk}</p></footer>
    </article>

    <div className="enterprise-outcomes reveal-on-scroll" aria-label="Enterprise outcomes">
      <article><span>01</span><div><h3>Reduce stale exposure</h3><p>Detect invalid AI-derived state when the authority changes—not after an incident or audit.</p></div><small>Security · Governance</small></article>
      <article><span>02</span><div><h3>Repair only what changed</h3><p>Replace broad rebuilds with registered, policy-specific remediation and measurable execution.</p></div><small>AI Platform · FinOps</small></article>
      <article><span>03</span><div><h3>Prove the real outcome</h3><p>Give application owners and auditors a trace from source event to user-level retrieval behavior.</p></div><small>Application owners · Compliance</small></article>
    </div>

    <div className="proof-coverage-rail reveal-on-scroll">
      <div><span className="micro-label">Registered assurance boundary</span><p>Coverage is explicit. Planned and unsupported systems never inherit a verified state.</p></div>
      <div className="proof-apps" role="list" aria-label="Supported and planned integrations">{proofApps.map((app) => <article role="listitem" key={app.name}><span><ApplicationIcon name={app.name}/></span><div><strong>{app.name}</strong><small>{app.role}</small></div><b className={app.state === "Registered" ? "proof-app-live" : "proof-app-planned"}>{app.state}</b></article>)}</div>
    </div>

    <div className="proof-disclosures" aria-label="Detailed Concord product evidence">
      <details id="proof-control">
        <summary><span>01</span><div><strong>Open the assurance control surface</strong><small>Cases, coverage ledger, replay, and safe simulation</small></div><i aria-hidden="true">+</i></summary>
        <div className="proof-disclosure-content"><ProductConsole/></div>
      </details>
      <details>
        <summary><span>02</span><div><strong>Inspect coverage and adapter roles</strong><small>Authorities, derivatives, proof endpoints, registered and planned states</small></div><i aria-hidden="true">+</i></summary>
        <div className="proof-disclosure-content"><EnterpriseBoundary/><AdapterRegistry/></div>
      </details>
      <details>
        <summary><span>03</span><div><strong>Review readiness and operating boundaries</strong><small>Design-partner staging only · evidence gaps remain visible</small></div><i aria-hidden="true">+</i></summary>
        <div className="proof-disclosure-content"><ReadinessPanel/><LaunchGates/></div>
      </details>
    </div>

    <nav className="enterprise-proof-links" aria-label="Explore Concord commercial evidence"><a href="/value">Value &amp; FinOps <Icon name="arrow" size={17}/></a><a href="/pricing">Pricing model <Icon name="arrow" size={17}/></a><a href="/intelligence">Market intelligence <Icon name="arrow" size={17}/></a></nav>
    <div className="proof-commercial-note"><div><span>Start with one registered control loop</span><p>The first eligible production application has a $0 application fee. Expand only after the evidence is clear.</p></div><a href="/workspace">Connect your first application free <Icon name="arrow" size={17}/></a></div>
    <p className="proof-boundary"><Icon name="shield" size={17}/>Bounded consistency for registered artifacts and supported adapters. Accepted risk is never presented as verified safety.</p>
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
    <section className="hero terrain-hero cinematic-host" id="top" data-motion-section="hero">
      <CinematicEnvironment scene="hero"/>
      <div className="hero-guides" aria-hidden="true"/>
      <div className="hero-signal" aria-hidden="true"><span>LIVE / SOURCE TRUTH</span><i/><span>32.0853° N</span></div>
      <div className="hero-orbit" aria-hidden="true"><span>CONCORD</span><b>∞</b></div>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#top" aria-label="Concord home"><ConcordMark/></a>
        <div className="nav-links"><a href="#problem">The risk</a><a href="#how-it-works">How it works</a><a href="#proof">Proof</a><a href="/coverage">Coverage</a><a href="/pricing">Pricing</a></div>
        <div className="nav-actions"><button className="nav-contact" type="button" data-contact-trigger>Contact</button><a className="nav-cta" href="/workspace">Open workspace <Icon name="arrow" size={16}/></a></div>
      </nav>
      <div className="hero-center merged-hero-center">
        <p className="hero-chapter"><span>000/</span> Independent assurance for security and AI-platform teams</p>
        <h1><span>Keep AI-derived state</span><span>aligned with the truth.</span></h1>
        <p className="hero-promise">Keep enterprise AI aligned with the truth. When access or authoritative information changes, Concord finds every registered AI-derived artifact affected, repairs the invalid state, verifies the real retrieval outcome, and preserves the evidence.</p>
        <div className="hero-actions"><a href="#how-it-works">See the control loop <i>↗</i></a><a href="#proof">Inspect the proof <i>↓</i></a></div>
        <div className="hero-assurance-dock"><HeroAssuranceField/></div>
        <p className="hero-boundary-note"><Icon name="shield" size={16}/>Bounded consistency for registered artifacts and supported adapters.</p>
      </div>
      <div className="hero-values" aria-label="Concord assurance principles"><span>Source truth</span><span>Registered lineage</span><span>Behavioral proof</span></div>
      <a className="explore-link" href="#problem" aria-label="Scroll to understand the problem"><span>Explore</span><b>001</b><i>↓</i></a>
    </section>
    <ProblemLandscape/>
    <PropagationJourney/>
    <EnterpriseProof/>
    <section className="final-cta terrain-final cinematic-host" id="contact" data-motion-section="stable">
      <CinematicEnvironment scene="stable"/>
      <div className="final-cta-brand"><ConcordMark/><p>004/ Start with one real control loop. Expand when the evidence is clear.</p></div>
      <h2>Carry one change<br/>all the way to <em>proof.</em></h2>
      <button className="button button-amber final-contact-action" type="button" data-contact-trigger>Contact the Ralph Team <Icon name="arrow" size={18}/></button>
    </section>
    <footer className="site-footer"><span>Concord · Enterprise AI Assurance</span><p>Product simulation · No external systems are modified</p><a href="#top">Back to top ↑</a></footer>
  </main>;
}
