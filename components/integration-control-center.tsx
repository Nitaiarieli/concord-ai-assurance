"use client";

import { FormEvent, useMemo, useState } from "react";

type CatalogItem = {
  id: string;
  connectorKey: string;
  displayName: string;
  connectorClass: string;
  phase: string;
  readiness: string;
  certification: string;
  capabilityManifest: { eventMode: string; authMode: string; capabilities: string[] };
  limitations: string[];
};

type Deployment = {
  id: string;
  connectorKey: string;
  connectorName: string;
  connectorClass: string;
  displayName: string;
  externalInstanceKey: string;
  environment: string;
  deploymentMode: string;
  status: string;
  healthStatus: string;
  runtimeVersion: string | null;
  policyVersion: string | null;
  lastHeartbeatAt: string | null;
  apiEndpoint: string | null;
  verificationIdentityRef: string | null;
  connectionStatus: string | null;
  destinationType: string | null;
  destinationStatus: string | null;
  createdAt: string;
};

type Snapshot = {
  catalog: CatalogItem[];
  deployments: Deployment[];
  metrics: { deployments: number; healthyRuntimes: number; canonicalEvents: number; fullyVerified: number; unresolved: number };
};

const connectorClassDetails = [
  ["Source", "Authoritative applications and data systems"],
  ["Identity + policy", "Users, groups, roles, and effective access"],
  ["Transformation", "Parsing, chunking, embedding, and orchestration"],
  ["Destination + proof", "Derived state, read-back, and retrieval behavior"],
];

export function IntegrationControlCenter({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const available = useMemo(() => snapshot.catalog.filter((item) => item.readiness === "enrollment_open"), [snapshot.catalog]);
  const [connectorKey, setConnectorKey] = useState(available[0]?.connectorKey ?? "bookstack");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [enrollment, setEnrollment] = useState<null | { token: string; expiresAt: string; deploymentId: string }>(null);

  async function createDeployment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setEnrollment(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/integration-deployments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectorKey,
          displayName: data.get("displayName"),
          externalInstanceKey: data.get("externalInstanceKey"),
          environment: data.get("environment"),
          deploymentMode: data.get("deploymentMode"),
          apiEndpoint: data.get("apiEndpoint"),
          destinationType: data.get("destinationType"),
          verificationIdentityRef: data.get("verificationIdentityRef"),
          monitoredScopes: ["pages", "content_permissions", "audit_log", "webhooks"],
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Connector deployment could not be created.");
      const catalog = snapshot.catalog.find((item) => item.connectorKey === connectorKey);
      const deployment: Deployment = {
        ...body.deployment,
        connectorName: catalog?.displayName ?? connectorKey,
        connectorClass: catalog?.connectorClass ?? "source",
        externalInstanceKey: String(data.get("externalInstanceKey")),
        environment: String(data.get("environment")),
        deploymentMode: String(data.get("deploymentMode")),
        runtimeVersion: null,
        policyVersion: null,
        lastHeartbeatAt: null,
        apiEndpoint: body.deployment.apiEndpoint ?? null,
        verificationIdentityRef: body.deployment.verificationIdentityRef ?? null,
        connectionStatus: body.deployment.connectionStatus ?? "awaiting_endpoint",
        destinationType: body.deployment.destinationType ?? "local_index",
        destinationStatus: body.deployment.destinationStatus ?? "adapter_ready",
        createdAt: new Date().toISOString(),
      };
      setSnapshot((current) => ({ ...current, deployments: [deployment, ...current.deployments], metrics: { ...current.metrics, deployments: current.metrics.deployments + 1 } }));
      setEnrollment({ token: body.enrollment.runtimeToken, expiresAt: body.enrollment.expiresAt, deploymentId: body.deployment.id });
      setMessage("Integration boundary created. The connector is not live until the customer-hosted runtime enrolls and sends a valid heartbeat.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connector deployment could not be created."); }
    finally { setBusy(false); }
  }

  return <>
    <section className="integration-platform-hero">
      <div><span>Connector control center</span><h1>Prepare the customer boundary.</h1><p>Enroll customer-hosted runtimes, inspect connector capabilities, receive minimized operational signals, and keep unsupported coverage explicit.</p></div>
      <aside><span>Platform state</span><strong>Foundation active</strong><p>BookStack and Zulip enrollment contracts are open. Live source connectivity and certification still require design-partner environments.</p></aside>
    </section>

    <section className="integration-platform-shell">
      <div className="integration-kpis"><article><span>Deployments</span><strong>{snapshot.metrics.deployments}</strong><small>Tenant scoped</small></article><article><span>Healthy runtimes</span><strong>{snapshot.metrics.healthyRuntimes}</strong><small>Outbound heartbeat</small></article><article><span>Canonical events</span><strong>{snapshot.metrics.canonicalEvents}</strong><small>Idempotent intake</small></article><article><span>Fully verified</span><strong>{snapshot.metrics.fullyVerified}</strong><small>Behavioral proof</small></article><article><span>Open chains</span><strong>{snapshot.metrics.unresolved}</strong><small>Never hidden</small></article></div>

      <section className="integration-foundation">
        <header><div><span>Normalized connector platform</span><h2>Four classes. One conformance model.</h2></div><a href="/coverage">Read the public coverage plan ↗</a></header>
        <div>{connectorClassDetails.map(([title, detail], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p></article>)}</div>
      </section>

      <section className="integration-workbench">
        <form className="integration-enrollment-form" onSubmit={createDeployment}>
          <div><span>New client integration</span><h2>Create an enrollment boundary.</h2><p>Concord stores a hash of the runtime credential and a customer-vault reference. The plaintext credential is shown once and is never stored.</p></div>
          <fieldset><legend>Connector</legend><div className="integration-provider-grid">{available.map((item) => <button type="button" key={item.connectorKey} className={connectorKey === item.connectorKey ? "active" : ""} onClick={() => setConnectorKey(item.connectorKey)}><strong>{item.displayName}</strong><small>{item.phase}</small></button>)}</div></fieldset>
          <label>Deployment name<input name="displayName" required maxLength={100} placeholder="e.g. Knowledge POC"/></label>
          <label>Instance identifier<input name="externalInstanceKey" required maxLength={180} placeholder="e.g. bookstack.staging.acme.internal"/></label>
          <label>API endpoint <span>optional until the environment is ready</span><input name="apiEndpoint" type="url" maxLength={500} placeholder="https://bookstack.example.com"/></label>
          <div className="integration-form-grid"><label>First AI destination<select name="destinationType" defaultValue="local_index"><option value="local_index">Deterministic local index</option><option value="vector_database">Customer vector database</option></select></label><label>Verification identity reference<input name="verificationIdentityRef" maxLength={240} placeholder="e.g. bookstack-user:17"/></label></div>
          <div className="integration-form-grid"><label>Environment<select name="environment" defaultValue="staging"><option value="staging">Staging</option><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label><label>Deployment mode<select name="deploymentMode" defaultValue="customer_cloud"><option value="customer_cloud">Customer cloud</option><option value="private_network">Private network</option><option value="air_gapped_preparation">Air-gapped preparation</option></select></label></div>
          <div className="integration-data-rule"><strong>Control-plane data rule</strong><p>No documents, embeddings, secrets, full permission snapshots, or detailed evidence may be submitted to these endpoints.</p></div>
          <button className="button button-amber" type="submit" disabled={busy}>{busy ? "Creating boundary…" : "Create enrollment boundary →"}</button>
          {message && <p className="integration-form-message" role="status">{message}</p>}
        </form>

        <aside className="integration-runtime-panel">
          <span>Customer runtime enrollment</span>
          {enrollment ? <><h2>Store this token now.</h2><p>It is shown once. Put it in the customer vault and use it only from the enrolled runtime.</p><code>{enrollment.token}</code><button type="button" onClick={() => navigator.clipboard.writeText(enrollment.token)}>Copy token</button><dl><div><dt>Heartbeat</dt><dd>POST /api/runtime/v1/heartbeat</dd></div><div><dt>Canonical events</dt><dd>POST /api/runtime/v1/events</dd></div><div><dt>Expires</dt><dd>{new Date(enrollment.expiresAt).toLocaleDateString()}</dd></div></dl></> : <><h2>Outbound. Authenticated. Minimized.</h2><p>After enrollment, the runtime reports health, version, policy, bounded error state, and canonical event metadata. Sensitive execution remains in the customer environment.</p><div className="runtime-contract-list"><span>SHA-256 credential hash</span><span>90-day enrollment credential</span><span>Tenant-scoped deployment</span><span>Duplicate-event protection</span><span>Prohibited-payload rejection</span></div></>}
        </aside>
      </section>

      <section className="connector-catalog-panel">
        <header><div><span>Machine-readable capability registry</span><h2>Current connector truth.</h2></div><p>“Foundation contract” means the normalized backend contract exists. It does not mean the external connector is production certified.</p></header>
        <div>{snapshot.catalog.map((item) => <article key={item.id}><div><span>{item.connectorClass.replaceAll("_", " + ")}</span><b className={`connector-readiness connector-${item.readiness}`}>{item.readiness.replaceAll("_", " ")}</b></div><h3>{item.displayName}</h3><p>{item.phase}</p><ul>{item.capabilityManifest.capabilities.slice(0, 3).map((capability) => <li key={capability}>{capability}</li>)}</ul><small>{item.certification}</small></article>)}</div>
      </section>

      <section className="integration-deployments-panel">
        <header><div><span>Client integration deployments</span><h2>Every boundary is explicit.</h2></div><p>{snapshot.deployments.length ? "Runtime health and version state update after authenticated heartbeats." : "No client runtime has been enrolled yet."}</p></header>
        {snapshot.deployments.length ? <div>{snapshot.deployments.map((deployment) => <article key={deployment.id}><div><span>{deployment.connectorName.slice(0, 2).toUpperCase()}</span><div><h3>{deployment.displayName}</h3><p>{deployment.externalInstanceKey} · {deployment.environment} · {deployment.deploymentMode.replaceAll("_", " ")}</p></div></div><dl><div><dt>Connection</dt><dd>{(deployment.connectionStatus ?? deployment.status).replaceAll("_", " ")}</dd></div><div><dt>Destination</dt><dd>{deployment.destinationType?.replaceAll("_", " ") ?? "Not selected"}</dd></div><div><dt>Runtime</dt><dd>{deployment.runtimeVersion ?? "Awaiting enrollment"}</dd></div><div><dt>Last signal</dt><dd>{deployment.lastHeartbeatAt ? new Date(deployment.lastHeartbeatAt).toLocaleString() : "Never"}</dd></div></dl></article>)}</div> : <div className="integration-empty"><strong>No deployment records</strong><p>Create a BookStack or Zulip enrollment boundary to prepare the first customer-hosted runtime.</p></div>}
      </section>
    </section>
  </>;
}
