"use client";

import { FormEvent, useMemo, useState } from "react";

type AgentEvent = {
  id: string;
  skill: string;
  cycle: number;
  status: string;
  sourceCount: number;
  output: Record<string, unknown>;
};

type AgentFinding = {
  id: string;
  severity: string;
  component: string;
  risk: string;
  remediation: string;
  owner: string;
  validationMethod: string;
  status: string;
};

type ScoredOption = {
  id: string;
  name: string;
  shortName: string;
  score: number;
  eligible: boolean;
  contraindications: string[];
};

type Recommendation = {
  decisionType: string;
  primary: ScoredOption & { description: string; dataBoundary: string };
  alternative: ScoredOption;
  options: ScoredOption[];
  confidence: string;
  hypothesisResult: string;
  sensitivity: { stable: boolean; scenarios: Array<{ label: string; winner: string | null; score: number | null }> };
  unknowns: string[];
  componentPlacement: Array<{ component: string; location: string; data: string }>;
  customerOnlyData: string[];
  allowedControlPlaneData: string[];
};

type Audit = {
  outcome: string;
  blockingFindings: number;
  complianceStatement: string;
};

type Dossier = {
  title: string;
  generatedAt: string;
  sections: Array<{ number: number; title: string; content: string }>;
};

type AgentRun = {
  id: string;
  status: string;
  currentStage: string;
  researchAsOf: string;
  revisionCount: number;
  hypothesis: string;
  recommendation: Recommendation | null;
  audit: Audit | null;
  dossier: Dossier | null;
  events: AgentEvent[];
  evidence: Array<{ id: string; classification: string; claim: string; sourceTitle: string; sourceUrl: string; accessedAt: string; confidence: string }>;
  findings: AgentFinding[];
};

type Snapshot = {
  connectedApplicationContext: Array<{ provider: string; displayName: string }>;
  latestRun: AgentRun | null;
  runs: Array<{ id: string; status: string; currentStage: string; researchAsOf: string; createdAt: string; completedAt: string | null }>;
};

const stages = [
  { key: "deployment_research", index: "01", title: "Deployment research", note: "Primary-source patterns, isolated from recommendation" },
  { key: "product_analysis", index: "02", title: "Concord analysis", note: "Components, data classes, and connector contracts" },
  { key: "deployment_recommendation", index: "03", title: "Decision engine", note: "Weighted scoring and sensitivity analysis" },
  { key: "security_compliance_audit", index: "04", title: "Independent audit", note: "Adversarial approval gate and revision loop" },
];

const integrationOptions = ["SharePoint", "Microsoft Entra", "Pinecone", "Redis", "Slack", "Jira", "Confluence", "Monday.com", "Linear", "Microsoft Teams", "Google Workspace"];

function csv(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function DeploymentAgentConsole({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [run, setRun] = useState<AgentRun | null>(initialSnapshot.latestRun);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const connected = useMemo(() => [...new Set(initialSnapshot.connectedApplicationContext.map((item) => item.provider))], [initialSnapshot.connectedApplicationContext]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/deployment-agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { run?: AgentRun; error?: string };
    if (!response.ok || !payload.run) throw new Error(payload.error ?? "The architecture agent could not continue.");
    return payload.run;
  }

  async function completeRun(current: AgentRun) {
    let next = current;
    for (let step = 0; step < 7 && next.status !== "completed"; step += 1) {
      await wait(260);
      next = await post({ action: "advance", runId: next.id });
      setRun(next);
    }
    if (next.status !== "completed") throw new Error("The run stopped before finalization. Resume it to continue from the saved state.");
    setMessage("Decision dossier complete. The recommendation passed through the independent audit gate.");
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const priorityIntegrations = integrationOptions.filter((integration) => data.getAll("integrations").includes(integration));
    try {
      const created = await post({
        action: "start",
        requestKey: crypto.randomUUID(),
        intake: {
          targetCustomers: data.get("targetCustomers"),
          industries: csv(data.get("industries")),
          jurisdictions: csv(data.get("jurisdictions")),
          requiredClouds: csv(data.get("requiredClouds")),
          requireOnPrem: data.get("requireOnPrem") === "on",
          airGapped: data.get("airGapped") === "on",
          priorityIntegrations,
          prohibitedDataEgress: data.getAll("prohibitedDataEgress"),
          availabilityTarget: data.get("availabilityTarget"),
          rtoHours: data.get("rtoHours"),
          rpoHours: data.get("rpoHours"),
          supportExpectation: data.get("supportExpectation"),
          commercialModel: "Connected application instances plus organization-level unique protected users; first application fee is $0",
          notes: data.get("notes"),
        },
      });
      setRun(created);
      await completeRun(created);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The architecture agent could not start.");
    } finally { setBusy(false); }
  }

  async function resume() {
    if (!run) return;
    setBusy(true); setMessage("");
    try { await completeRun(run); } catch (error) { setMessage(error instanceof Error ? error.message : "The run could not resume."); }
    finally { setBusy(false); }
  }

  const completedSkills = new Set(run?.events.map((event) => event.skill) ?? []);
  const recommendation = run?.recommendation;

  return <>
    <section className="deployment-agent-hero">
      <div>
        <span className="commercial-eyebrow">Concord architecture agent · governed decision system</span>
        <h1>Architecture decisions that <em>survive their own audit.</em></h1>
        <p>Four isolated skills research the market, map Concord’s real data flows, score every viable deployment model, and challenge the answer before a decision dossier can be released.</p>
        <div className="agent-hero-actions"><a href="#run-agent" className="button button-amber">Start a decision run ↓</a>{run?.dossier && <a className="agent-text-link" href={`/api/deployment-agent?runId=${run.id}&format=markdown`}>Download latest dossier ↗</a>}</div>
      </div>
      <aside>
        <span>Current hypothesis</span>
        <p>A limited Concord control plane plus customer-hosted execution and data plane.</p>
        <dl><div><dt>Research as of</dt><dd>{run?.researchAsOf ?? "2026-08-21"}</dd></div><div><dt>Guarantee</dt><dd>Registered artifacts only</dd></div><div><dt>Audit gate</dt><dd>Independent</dd></div></dl>
      </aside>
    </section>

    <section className="agent-boundary-strip" aria-label="Agent operating rules">
      <article><span>01</span><strong>No recommendation during research</strong></article>
      <article><span>02</span><strong>Deterministic weighted scoring</strong></article>
      <article><span>03</span><strong>Facts and assumptions stay separate</strong></article>
      <article><span>04</span><strong>Critical findings block release</strong></article>
    </section>

    <section className="agent-run-shell" id="run-agent">
      <form className="agent-intake" onSubmit={start}>
        <header><span>Research intake</span><h2>Set the decision boundary.</h2><p>Unknown requirements remain unknown. The agent will not invent targets or turn a framework mapping into a compliance claim.</p></header>
        <label>Target customers<textarea name="targetCustomers" defaultValue="Enterprise AI platform, security, and data teams" rows={2}/></label>
        <div className="agent-form-pair"><label>Industries<input name="industries" defaultValue="Enterprise software, Cybersecurity"/></label><label>Jurisdictions<input name="jurisdictions" defaultValue="United States, European Union, Israel"/></label></div>
        <label>Required clouds<input name="requiredClouds" defaultValue="AWS, Azure, Google Cloud"/></label>
        <fieldset><legend>Priority connector contracts</legend><div className="agent-check-grid">{integrationOptions.map((item) => <label key={item}><input type="checkbox" name="integrations" value={item} defaultChecked={["SharePoint", "Microsoft Entra", "Pinecone", "Redis"].includes(item) || connected.includes(item.toLowerCase().replaceAll(" ", "_"))}/><span>{item}</span></label>)}</div></fieldset>
        <fieldset><legend>Data that must remain customer-controlled</legend><div className="agent-check-list">{["Organizational content", "Credentials and API tokens", "Embeddings and AI-derived payloads", "ACLs and identity payloads", "Full evidence payloads"].map((item, index) => <label key={item}><input type="checkbox" name="prohibitedDataEgress" value={item} defaultChecked={index < 3}/><span>{item}</span></label>)}</div></fieldset>
        <div className="agent-form-pair agent-toggle-pair"><label><input type="checkbox" name="requireOnPrem"/><span>On-premises-capable data plane required</span></label><label><input type="checkbox" name="airGapped"/><span>Disconnected / air-gapped runtime required</span></label></div>
        <div className="agent-form-trio"><label>Availability target<input name="availabilityTarget" placeholder="Unknown"/></label><label>RTO, hours<input name="rtoHours" inputMode="decimal" placeholder="Unknown"/></label><label>RPO, hours<input name="rpoHours" inputMode="decimal" placeholder="Unknown"/></label></div>
        <label>Support expectation<input name="supportExpectation" defaultValue="Enterprise business-hours support during the design-partner pilot"/></label>
        <label>Open constraints<textarea name="notes" rows={3} defaultValue="Validate exact availability, recovery, residency, and procurement requirements with design partners before general availability."/></label>
        <button className="button button-dark agent-run-button" type="submit" disabled={busy}>{busy ? "Agent running…" : "Run architecture decision →"}</button>
        {run && run.status !== "completed" && !busy && <button className="agent-resume" type="button" onClick={resume}>Resume saved run</button>}
        {message && <p className="agent-message" role="status">{message}</p>}
      </form>

      <div className="agent-orchestrator" aria-live="polite">
        <header><div><span>Orchestrator</span><h2>{run ? run.status === "completed" ? "Decision released" : `Running: ${run.currentStage}` : "Ready for intake"}</h2></div><b className={run?.status === "completed" ? "complete" : busy ? "active" : ""}>{run?.status ?? "idle"}</b></header>
        <div className="agent-skill-rail">{stages.map((stage) => {
          const complete = completedSkills.has(stage.key);
          const active = busy && !complete && ((stage.key === "deployment_research" || stage.key === "product_analysis") ? run?.currentStage === "research" : run?.currentStage.includes(stage.key.split("_")[0]) || (stage.key === "security_compliance_audit" && run?.currentStage === "audit"));
          const event = run?.events.find((item) => item.skill === stage.key);
          return <article key={stage.key} className={complete ? "complete" : active ? "active" : ""}><span>{stage.index}</span><div><strong>{stage.title}</strong><small>{stage.note}</small></div><b>{complete ? "Passed" : active ? "Running" : "Waiting"}</b>{event && event.sourceCount > 0 && <i>{event.sourceCount} sources</i>}</article>;
        })}</div>
        <div className="agent-gate"><span>Independent release gate</span><strong>{run?.audit?.outcome ?? "No dossier is released before audit"}</strong><p>Any unresolved Critical or High finding returns the decision to the recommendation skill. Up to three revision cycles are allowed.</p></div>
      </div>
    </section>

    {recommendation && <section className="agent-decision">
      <header><div><span className="commercial-eyebrow">Executive decision</span><h2>{recommendation.primary.name}</h2></div><div className="agent-verdict"><span>{recommendation.decisionType}</span><strong>{recommendation.primary.score.toFixed(2)} / 5</strong><small>{recommendation.confidence} confidence · {recommendation.sensitivity.stable ? "stable under ±20% tests" : "weight-sensitive"}</small></div></header>
      <div className="agent-decision-grid"><article><span>Why this wins</span><p>{recommendation.primary.description}</p><strong>{recommendation.hypothesisResult}</strong></article><article><span>Regulated alternative</span><h3>{recommendation.alternative.name}</h3><p>Use when the customer requires full-stack control, accepts greater operational ownership, or prohibits any managed control-plane dependency.</p></article><article><span>Audit outcome</span><h3>{run?.audit?.outcome}</h3><p>{run?.audit?.complianceStatement}</p></article></div>
    </section>}

    {recommendation && <section className="agent-matrix">
      <div className="agent-section-title"><span>Weighted comparison</span><h2>One answer, with every rejected path still visible.</h2><p>Scores use the fixed 25/20/15/15/10/5/5/5 model from the specification. Mandatory boundary conflicts make an option ineligible before ranking.</p></div>
      <div className="agent-score-table" role="table" aria-label="Deployment model scores"><div className="agent-score-head" role="row"><span>Deployment model</span><span>Eligibility</span><span>Score</span><span>Decision note</span></div>{recommendation.options.map((option) => <div className={option.id === recommendation.primary.id ? "winner" : ""} role="row" key={option.id}><strong>{option.name}</strong><span>{option.eligible ? "Eligible" : "Excluded"}</span><b>{option.score.toFixed(2)}</b><small>{option.id === recommendation.primary.id ? "Primary architecture" : option.contraindications[0] ?? "Ranked below primary"}</small></div>)}</div>
    </section>}

    {recommendation && <section className="agent-deployment-map">
      <div className="agent-section-title"><span>Resulting deployment</span><h2>A small managed brain. A customer-controlled execution boundary.</h2><p>The architecture keeps content, credentials, repairs, and retrieval verification local while Concord manages versioned policy, fleet posture, and minimized proof metadata.</p></div>
      <div className="agent-architecture-diagram" role="img" aria-label="Hybrid Concord deployment architecture">
        <div className="agent-plane concord-plane"><span>Concord-managed control plane</span><h3>Policy · Fleet · Entitlements</h3><p>Versions, health summaries, tenant identifiers, and optional integrity hashes only.</p></div>
        <div className="agent-link-column"><span>Outbound mTLS</span><i/><b>Signed policy ↓</b><b>Minimized proof ↑</b></div>
        <div className="agent-plane customer-plane"><span>Customer environment</span><h3>Connector · Lineage · Repair · Verify</h3><div className="customer-plane-grid"><b>Customer vault</b><b>Local evidence store</b><b>Impact planner</b><b>Verification runner</b></div></div>
        <div className="agent-source-column"><span>Authoritative sources</span><b>SharePoint</b><b>Entra</b></div>
        <div className="agent-destination-column"><span>AI derivatives</span><b>Pinecone</b><b>Redis</b></div>
      </div>
      <div className="agent-placement-list">{recommendation.componentPlacement.map((row) => <article key={row.component}><strong>{row.component}</strong><span>{row.location}</span><p>{row.data}</p></article>)}</div>
    </section>}

    {run?.findings.length ? <section className="agent-audit-results"><div className="agent-section-title"><span>Independent audit</span><h2>The agent must earn permission to conclude.</h2><p>Findings stay attached to the run with severity, owner, remediation, and a validation method.</p></div><div className="agent-finding-list">{run.findings.map((finding) => <article key={finding.id}><span className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</span><div><h3>{finding.component}</h3><p>{finding.risk}</p><details><summary>Required control and validation</summary><p>{finding.remediation}</p><small>{finding.owner} · {finding.validationMethod}</small></details></div><b>{finding.status.replaceAll("_", " ")}</b></article>)}</div></section> : null}

    {run?.dossier && <section className="agent-dossier"><header><div><span className="commercial-eyebrow">Final artifact</span><h2>{run.dossier.title}</h2><p>Every conclusion is tied to the run’s intake, evidence snapshot, deterministic score, audit result, and revision history.</p></div><a className="button button-amber" href={`/api/deployment-agent?runId=${run.id}&format=markdown`}>Download Markdown dossier ↗</a></header><div className="agent-dossier-index">{run.dossier.sections.map((section) => <article key={section.number}><span>{String(section.number).padStart(2, "0")}</span><strong>{section.title}</strong><p>{section.content}</p></article>)}</div></section>}

    {run?.evidence.length ? <section className="agent-evidence"><div className="agent-section-title"><span>Evidence registry</span><h2>Claims keep their provenance.</h2><p>This release uses a dated primary-source registry. It does not claim unattended live-internet research until a separate research provider is approved and connected.</p></div><div className="agent-evidence-grid">{run.evidence.map((item) => <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer"><span>{item.classification.replaceAll("_", " ")} · {item.confidence}</span><strong>{item.sourceTitle}</strong><p>{item.claim}</p><small>Accessed {item.accessedAt} ↗</small></a>)}</div></section> : null}
  </>;
}
