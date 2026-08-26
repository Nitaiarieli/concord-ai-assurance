"use client";

import { useMemo, useState } from "react";

const apps = ["Jira", "Confluence", "Slack", "monday.com", "Linear", "Microsoft Teams", "SharePoint", "Google Workspace"];

export function PricingExperience() {
  const [selectedApps, setSelectedApps] = useState(["Jira"]);
  const [protectedUsers, setProtectedUsers] = useState(250);
  const [cadence, setCadence] = useState<"monthly" | "annual">("annual");
  const additionalApps = Math.max(0, selectedApps.length - 1);
  const nextStep = useMemo(() => additionalApps ? `${additionalApps} additional application${additionalApps === 1 ? "" : "s"} will use the approved price book.` : "Add a second application to model expansion.", [additionalApps]);

  function toggleApp(app: string) {
    setSelectedApps((current) => current.includes(app) ? (current.length === 1 ? current : current.filter((item) => item !== app)) : [...current, app]);
  }

  return (
    <>
      <section className="pricing-hero">
        <div className="pricing-orb"><span>1</span><small>application fee</small><strong>$0</strong></div>
        <p className="commercial-eyebrow">A lower-friction path to enterprise assurance</p>
        <h1>Connect your first<br/><em>application for free.</em></h1>
        <p className="commercial-lead">Start with one real control loop. Prove the value. Expand only when the evidence supports it.</p>
        <div className="pricing-hero-actions"><a className="button button-amber" href="/workspace">Start with one application →</a><a href="#calculator">See how billing works ↓</a></div>
      </section>

      <section className="pricing-definition">
        <article><span>01</span><h2>Application instance</h2><p>A specific workspace, site, tenant, or account. Jira and Confluence count separately—even when both belong to Atlassian.</p></article>
        <article><span>02</span><h2>Protected user</h2><p>A unique human or guest with effective protected access. Verified identities are deduplicated across every application.</p></article>
        <article><span>03</span><h2>No protection tax</h2><p>Bots, service accounts, deactivated identities, and duplicate records do not become duplicate human-user charges.</p></article>
      </section>

      <section className="calculator-section" id="calculator">
        <div className="calculator-intro"><p className="commercial-eyebrow">Transparent estimator</p><h2>Build the shape of your plan.</h2><p>Founder-approved rates are not public yet. The calculator exposes the charging logic now and will activate totals only when an approved, versioned price book exists.</p></div>
        <div className="calculator-shell">
          <div className="calculator-controls">
            <fieldset><legend>Choose application instances</legend><p>The earliest production instance keeps the $0 application fee.</p><div className="app-selector">{apps.map((app, index) => <button key={app} type="button" className={selectedApps.includes(app) ? "selected" : ""} onClick={() => toggleApp(app)}><span>{selectedApps.includes(app) ? "✓" : "+"}</span><strong>{app}</strong>{index === 0 && selectedApps.includes(app) ? <small>Free app</small> : null}</button>)}</div></fieldset>
            <label className="user-slider"><span><strong>Unique protected users</strong><b>{protectedUsers.toLocaleString()}</b></span><input type="range" min="25" max="5000" step="25" value={protectedUsers} onChange={(event) => setProtectedUsers(Number(event.target.value))}/><small>Counted once across {selectedApps.length} selected application{selectedApps.length === 1 ? "" : "s"}.</small></label>
            <div className="cadence-toggle" aria-label="Billing cadence"><button className={cadence === "monthly" ? "active" : ""} type="button" onClick={() => setCadence("monthly")}>Monthly</button><button className={cadence === "annual" ? "active" : ""} type="button" onClick={() => setCadence("annual")}>Annual</button></div>
          </div>
          <aside className="estimate-card" aria-live="polite">
            <div><span>Model summary</span><small>Price book pending</small></div>
            <h3>{selectedApps.length} app{selectedApps.length === 1 ? "" : "s"} · {protectedUsers.toLocaleString()} users</h3>
            <dl><div><dt>First application fee</dt><dd>$0</dd></div><div><dt>Additional application fees</dt><dd>{additionalApps ? "Approved rate required" : "$0"}</dd></div><div><dt>Included users</dt><dd>Founder approval required</dd></div><div><dt>Protected-user charge</dt><dd>Approved rate required</dd></div><div><dt>Progressive discount</dt><dd>{cadence === "annual" ? "Applied after approval" : "—"}</dd></div></dl>
            <div className="locked-total"><span>Estimated {cadence === "annual" ? "annual" : "monthly"} total</span><strong>$—</strong><p>No unapproved prices are exposed in production.</p></div>
            <p className="estimate-next">{nextStep}</p>
            <a className="button button-dark" href="/workspace">Create a pilot workspace →</a>
          </aside>
        </div>
      </section>

      <section className="package-section">
        <div className="package-title"><p className="commercial-eyebrow">Packaging hypothesis</p><h2>Land narrow.<br/>Expand with proof.</h2></div>
        <div className="package-grid">
          <article><span>Starter</span><h3>Prove the control loop</h3><strong>First app / $0 app fee</strong><ul><li>Basic monitoring and verification</li><li>Configurable protected-user allowance</li><li>Limited evidence retention</li><li>Value baseline and methodology</li></ul><a href="/workspace">Start pilot →</a></article>
          <article className="package-featured"><span>Growth</span><h3>Operationalize assurance</h3><strong>Apps + unique protected users</strong><ul><li>Closed-loop remediation</li><li>Full Value &amp; FinOps dashboard</li><li>Cost-center allocation</li><li>Longer evidence retention</li></ul><a href="/workspace">Model expansion →</a></article>
          <article><span>Enterprise</span><h3>Standardize the control plane</h3><strong>Progressive volume contract</strong><ul><li>SSO, SCIM, and advanced RBAC</li><li>Residency and private deployment</li><li>Enterprise SLA and support</li><li>Custom connector packages</li></ul><a href="/workspace">Request enterprise terms →</a></article>
        </div>
      </section>

      <section className="billing-faq"><div><p className="commercial-eyebrow">Billing FAQ</p><h2>Designed to be explainable.</h2></div><div>{[
        ["Why not charge every seat in every app?", "That would charge the same person repeatedly. Concord resolves verified identity mappings and bills one protected human once at organization level."],
        ["What happens to bots and AI agents?", "They are distinguished and metered for cost-to-serve, but they are not silently converted into protected-human charges."],
        ["Can I replace the free application?", "Yes, through an owner-approved, audited change. Reconnection preserves the existing free designation; repeated rotation triggers review, never a hidden fee."],
        ["How are sandboxes treated?", "A non-production instance linked to production is measured but is not a separate application unit unless contracted as standalone coverage."],
        ["Where are the actual rates?", "No rate has founder approval yet. Concord will publish only an approved, dated price-book version after design-partner willingness-to-pay and cost-to-serve tests."],
      ].map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
    </>
  );
}
