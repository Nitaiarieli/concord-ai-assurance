"use client";

import { useState } from "react";

const traceStories = [
  { app: "SharePoint", event: "Permission revoked", action: "128 vector records + 16 cache keys repaired", proof: "Revoked identity returned 0 artifacts", value: "$184 measured processing avoided", className: "Verified", team: "AI Platform", costCenter: "CC-410", environment: "Production", confidence: "High" },
  { app: "Jira", event: "Project access removed", action: "Targeted repair replaced full synchronization", proof: "42 affected identities verified", value: "6.4 hours × approved loaded rate", className: "Estimated", team: "Security", costCenter: "CC-220", environment: "Production", confidence: "Medium" },
  { app: "Slack", event: "Retention policy changed", action: "Duplicate replay work prevented", proof: "Idempotency key closed once", value: "$620 future processing avoided", className: "Avoidance", team: "IT Operations", costCenter: "CC-180", environment: "Sandbox", confidence: "Medium" },
];

export function ValueDashboard() {
  const [application, setApplication] = useState("All applications");
  const [classification, setClassification] = useState("All classes");
  const [team, setTeam] = useState("All teams");
  const [costCenter, setCostCenter] = useState("All cost centers");
  const [environment, setEnvironment] = useState("All environments");
  const [confidence, setConfidence] = useState("All confidence");
  const [showMethod, setShowMethod] = useState(false);
  const filteredStories = traceStories.filter((story) =>
    (application === "All applications" || story.app === application) &&
    (classification === "All classes" || story.className === classification) &&
    (team === "All teams" || story.team === team) &&
    (costCenter === "All cost centers" || story.costCenter === costCenter) &&
    (environment === "All environments" || story.environment === environment) &&
    (confidence === "All confidence" || story.confidence === confidence));

  function downloadCsv() {
    const headings = ["Application", "Change", "Concord action", "Proof", "Value method", "Classification", "Team", "Cost center", "Environment", "Confidence"];
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = filteredStories.map((story) => [story.app, story.event, story.action, story.proof, story.value, story.className, story.team, story.costCenter, story.environment, story.confidence].map(escape).join(","));
    const blob = new Blob([[headings.map(escape).join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "concord-executive-value-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return <>
    <section className="value-hero"><div><p className="commercial-eyebrow">Value &amp; FinOps</p><h1>Prove the return.<br/><em>Show the evidence.</em></h1><p className="commercial-lead">Every financial number starts with a product event, a formula, a source, and a confidence label. Risk stays separate from realized savings.</p></div><aside><span>Illustrative product data</span><strong>Not a customer claim</strong><p>This screen demonstrates the measurement contract. A live organization starts empty until billing, event, baseline, and assumption data are connected.</p></aside></section>
    <section className="value-toolbar"><div><label>Date range<select><option>Current period</option><option>Previous period</option><option>Quarter to date</option></select></label><label>Application<select value={application} onChange={(event) => setApplication(event.target.value)}><option>All applications</option><option>SharePoint</option><option>Jira</option><option>Slack</option></select></label><label>Class<select value={classification} onChange={(event) => setClassification(event.target.value)}><option>All classes</option><option>Verified</option><option>Estimated</option><option>Avoidance</option></select></label><label>Team<select value={team} onChange={(event) => setTeam(event.target.value)}><option>All teams</option><option>AI Platform</option><option>Security</option><option>IT Operations</option></select></label><label>Cost center<select value={costCenter} onChange={(event) => setCostCenter(event.target.value)}><option>All cost centers</option><option>CC-410</option><option>CC-220</option><option>CC-180</option></select></label><label>Environment<select value={environment} onChange={(event) => setEnvironment(event.target.value)}><option>All environments</option><option>Production</option><option>Sandbox</option></select></label><label>Confidence<select value={confidence} onChange={(event) => setConfidence(event.target.value)}><option>All confidence</option><option>High</option><option>Medium</option></select></label></div><button type="button" onClick={() => setShowMethod((value) => !value)}>{showMethod ? "Hide" : "Show"} methodology</button></section>
    {showMethod && <section className="method-banner"><strong>Calculation contract</strong><p>Net verified value = evidence-backed financial value − Concord fees − Concord operating cost. ROI = net verified value ÷ total Concord cost. Estimated hours never enter verified value. Probabilistic risk is never added to savings.</p></section>}
    <section className="value-dashboard-shell">
      <div className="value-kpi-grid"><article><span>Verified value</span><strong>$12,480</strong><small>High confidence · demo evidence</small></article><article><span>Concord cost</span><strong>$4,200</strong><small>Example invoice + operating cost</small></article><article className="value-accent"><span>Net verified value</span><strong>$8,280</strong><small>197% illustrative ROI</small></article><article><span>Evidence coverage</span><strong>86%</strong><small>12 of 14 eligible events</small></article></div>
      <div className="value-body-grid"><article className="value-chart"><div><span>Value by classification</span><small>Illustrative period · USD</small></div><div className="value-bars"><div><label>Verified financial <b>$12.5k</b></label><i><span style={{width:"63%"}}/></i></div><div><label>Estimated operational <b>$9.0k</b></label><i><span className="bar-purple" style={{width:"45%"}}/></i></div><div><label>Cost avoidance <b>$17.1k</b></label><i><span className="bar-amber" style={{width:"86%"}}/></i></div><div><label>Risk exposure <b>separate</b></label><i><span className="bar-red" style={{width:"32%"}}/></i></div></div><p>Only the first bar contributes to net verified value.</p></article><article className="efficiency-card"><div><span>Operational efficiency</span><small>Illustrative</small></div><dl><div><dt>Mean time to detect</dt><dd>1m 42s <small>−64%</small></dd></div><div><dt>Mean time to repair</dt><dd>4m 18s <small>−71%</small></dd></div><div><dt>Automated repairs</dt><dd>82% <small>+18 pts</small></dd></div><div><dt>Identity verification</dt><dd>97% <small>+9 pts</small></dd></div></dl></article></div>
      <article className="trace-table"><header><div><span>Traceable value stories</span><p>{filteredStories.length} result{filteredStories.length === 1 ? "" : "s"} · illustrative product data</p></div><div><button type="button" onClick={downloadCsv}>CSV ↓</button><button type="button" onClick={() => window.print()}>PDF / print ↗</button></div></header><div className="trace-table-head"><span>Change</span><span>Concord action</span><span>Proof</span><span>Value method</span></div>{filteredStories.length ? filteredStories.map((story) => <div className="trace-row" key={story.app}><span><b>{story.app}</b>{story.event}</span><span>{story.action}</span><span>{story.proof}</span><span><i className={`value-class value-${story.className.toLowerCase()}`}>{story.className}</i>{story.value}</span></div>) : <p className="trace-empty">No illustrative events match these filters.</p>}</article>
      <article className="honest-empty"><div><span>Production organization state</span><h2>No financial value yet.</h2><p>Connect billing exports, approve a baseline, configure cost rates, and collect evidence-bearing repair events before Concord displays customer financial value.</p></div><ol><li><span>01</span>Connect cost source</li><li><span>02</span>Approve baseline</li><li><span>03</span>Approve assumptions</li><li><span>04</span>Verify events</li></ol></article>
    </section>
  </>;
}
