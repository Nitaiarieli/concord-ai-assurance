import { canonicalChangeTypes, connectorCatalog } from "@/lib/integration-platform";

const loop = [
  ["01", "Detect", "Observe an authoritative content, identity, permission, or validity change."],
  ["02", "Normalize", "Convert source-specific behavior into one canonical, idempotent event."],
  ["03", "Trace", "Follow registered lineage through transformations and downstream AI artifacts."],
  ["04", "Repair", "Apply a version-aware, policy-controlled action or quarantine uncertain state."],
  ["05", "Verify", "Read back the destination and test the real retrieval path with an affected identity."],
  ["06", "Prove", "Preserve evidence and label partial, inferred, or unsupported outcomes honestly."],
];

const connectorLayers = [
  ["Source", "Applications and data systems", "Knowledge, messaging, project management, files, databases, warehouses, APIs"],
  ["Identity + policy", "Users, groups, roles, entitlements", "Directories, identity providers, permission models, policy engines"],
  ["Transformation", "The AI data supply chain", "Parsing, chunking, embedding, orchestration, enrichment, routing"],
  ["Destination + proof", "Derived state and AI consumers", "Vector stores, caches, indexes, memory, retrieval APIs, copilots, agents"],
];

export function CoverageExperience() {
  return <>
    <section className="coverage-hero">
      <div className="coverage-hero-copy">
        <p className="commercial-eyebrow">Universal enterprise coverage</p>
        <h1>One closed loop.<br/><em>Every supported system.</em></h1>
        <p>Concord is being built as a vendor-neutral validity layer across the enterprise AI data supply chain. BookStack and Zulip are the first proof environments; Linear is the first black-box SaaS reuse test.</p>
        <div className="coverage-hero-actions"><a className="button button-amber" href="/workspace/integrations">Open connector control center →</a><a href="#coverage-contract">Inspect the connector contract ↓</a></div>
      </div>
      <aside aria-label="Current coverage status">
        <span>Current technical truth</span>
        <strong>Foundation stage</strong>
        <dl><div><dt>BookStack</dt><dd>Phase 1 · first</dd></div><div><dt>Zulip</dt><dd>Phase 1 · second</dd></div><div><dt>Linear</dt><dd>Phase 2 · reuse gate</dd></div></dl>
        <p>This is a product and integration plan—not a claim of production-certified connector coverage.</p>
      </aside>
    </section>

    <section className="coverage-loop" id="coverage-contract">
      <header><p className="commercial-eyebrow">The invariant product contract</p><h2>Every connector must complete the same loop.</h2><p>Expansion cannot create a collection of unrelated integrations. New systems implement normalized capabilities and pass the same conformance gates.</p></header>
      <div className="coverage-loop-grid">{loop.map(([number, title, detail]) => <article key={title}><span>{number}</span><h3>{title}</h3><p>{detail}</p></article>)}</div>
    </section>

    <section className="coverage-layers">
      <header><p className="commercial-eyebrow">Risk-weighted coverage</p><h2>Broader than applications.</h2><p>Concord must cover the full registered path from source truth to the behavior observed by an AI application or agent.</p></header>
      <div>{connectorLayers.map(([title, subtitle, detail], index) => <article key={title}><span>0{index + 1}</span><div><h3>{title}</h3><strong>{subtitle}</strong></div><p>{detail}</p></article>)}</div>
    </section>

    <section className="coverage-roadmap">
      <header><div><p className="commercial-eyebrow">Connector roadmap</p><h2>Evidence before expansion.</h2></div><p>Each phase answers a different technical question: white-box correctness, event and permission stress, then portability without source-code access.</p></header>
      <div className="coverage-connector-grid">{connectorCatalog.slice(0, 3).map((connector) => <article key={connector.key} className={`coverage-connector coverage-${connector.readiness}`}><div><span>{connector.phase}</span><b>{connector.readiness.replaceAll("_", " ")}</b></div><h3>{connector.name}</h3><p>{connector.capabilities.join(" · ")}</p><dl><div><dt>Event path</dt><dd>{connector.eventMode}</dd></div><div><dt>Credential boundary</dt><dd>{connector.authMode}</dd></div><div><dt>Current status</dt><dd>{connector.certification}</dd></div></dl><small>{connector.limitations[0]}</small></article>)}</div>
    </section>

    <section className="coverage-boundary">
      <div><p className="commercial-eyebrow">Hybrid deployment boundary</p><h2>Customer data stays with the customer.</h2><p>The customer-hosted runtime performs sensitive reads, permission evaluation, lineage, repair, read-back, and behavioral verification. Concord’s managed plane receives only minimized, tenant-scoped operational metadata.</p></div>
      <div className="coverage-boundary-grid"><article><span>Customer environment</span><ul><li>Credentials and API tokens</li><li>Full source content</li><li>Identity and permission data</li><li>Lineage and detailed evidence</li><li>Repair and retrieval-test identities</li></ul></article><article><span>Concord control plane</span><ul><li>Connector and policy versions</li><li>Health and workflow status</li><li>Non-sensitive counters</li><li>Error classifications</li><li>Evidence hashes and completion state</li></ul></article></div>
    </section>

    <section className="coverage-event-contract">
      <div><p className="commercial-eyebrow">Canonical event model</p><h2>Source-specific changes become one safe language.</h2><p>The managed backend now accepts this bounded taxonomy through authenticated customer runtimes. Payloads containing documents, embeddings, raw credentials, or full evidence are rejected.</p></div>
      <div>{canonicalChangeTypes.map((type) => <code key={type}>{type}</code>)}</div>
    </section>

    <section className="coverage-gate"><span>Final decision gate</span><h2>Authoritative change → registered impact → safe repair → read-back → identity-aware verification → evidence.</h2><p>If any stage cannot be completed, Concord keeps the case open and records exactly where the chain breaks.</p><a className="button button-amber" href="/workspace/integrations">Prepare a client integration →</a></section>
  </>;
}

