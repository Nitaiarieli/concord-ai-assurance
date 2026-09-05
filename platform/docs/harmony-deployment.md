# Harmony.io deployment reference for Concord

Checked: **2026-09-05 (UTC)**. Scope: official public Harmony.io material; no Harmony tenant, installation, security review, or customer deployment was tested.

## Decision

The founder has resolved the identity: the reference is **Harmony.io**, the enterprise service management platform. The relevant verified reference is its **cloud-connected integration model plus an on-premises proxy for restricted internal targets**. A local proxy is not evidence that Harmony's entire platform is installed inside each customer environment.

For Concord, adopt the installation experience as a design reference: select an application, authorize its connection, choose the allowed scope, run discovery, and observe ongoing health. Use a customer-side connector worker where source files or APIs are private. A fully managed control plane, outbound enrollment tunnel, and private-cloud product are future architectural choices; do not label them existing Concord capabilities merely because the mockup depicts them.

## Evidence ledger

| Topic | What official material supports | Classification and limits |
|---|---|---|
| Customer-network component | Harmony documents an **On-Premises Proxy** that reaches configured internal systems through an encrypted outbound tunnel, without opening inbound firewall access. It shows target address, installation/connection status, and returned internal-system responses as relevant data. [Official proxy page](https://harmony.io/integrations/on-premises-proxy) | Vendor-documented architecture; not an independently tested installation. The target must be nominated. This is not automatic discovery of every organizational system. |
| Cloud and local relationship | The same page explicitly describes connecting inaccessible internal systems to Harmony cloud workflows. [Official proxy page](https://harmony.io/integrations/on-premises-proxy) | Supports a cloud service with a local bridge. It does not prove all data remains local or that the full service can run air-gapped. |
| Enterprise app catalog | The public directory lists Confluence, Jira, Atlassian, Slack, and the proxy among many integrations. [Integration directory](https://harmony.io/integrations) | Vendor-listed integration availability. Listing is not evidence of equivalent features, scopes, latency, or installation effort across apps. |
| Confluence knowledge | Harmony describes importing pages/spaces, automatic knowledge updates, and using page/space permissions when providing answers. It also lists attachments and structural metadata. [Official Confluence page](https://harmony.io/integrations/confluence) | Vendor claims. No measured update SLO, permission-change delay, or complete downstream-copy coverage was established. |
| Agent configuration | Harmony's builder describes connections to enterprise APIs, databases, MCP servers, and webhooks; it describes guardrails, testing, and staged rollout. [AI Agent Builder](https://harmony.io/platform/ai-agent-builder) | Vendor claims. The phrase “deploy everywhere” describes agent channels/background execution in this page, not verified infrastructure packaging into any customer VPC. |
| Whole-platform self-hosting / customer VPC | No reviewed primary page established an available full-platform self-hosted, private-VPC, or air-gapped edition. | Unknown. Do not turn absence in this bounded review into a claim that Harmony cannot offer these commercially. |
| Exact proxy installer | The reviewed marketing page established a proxy and installation status, but not a verified operating-system matrix, Docker image, Helm chart, enrollment command, upgrade method, resource requirements, or a one-click installer. | Unknown. Do not invent installation commands or copy branding into Concord's installation flow. |

The official documentation site is linked from Harmony's website. Its pages were discoverable, but direct reading failed in this research environment because the web reader rejected `text/markdown`; direct HTTP reads returned 403. The trust center rendered only a JavaScript-required message. Accordingly, documentation snippets and security badges are not used here to assert additional implementation or compliance facts. Relevant unavailable documents: [Understanding Integrations](https://docs.harmony.io/settings/understanding-integrations), [Confluence setup](https://docs.harmony.io/integrations/knowledge-base/confluence), [Trust Center](https://trust.harmony.io/).

## Concord implications — engineering and product recommendations

These are **our recommendations**, not attributed Harmony capabilities.

1. **Separate application connectors from deployment.** The Atlassian Cloud source adapters can execute in a customer-controlled worker with outbound HTTPS access. Local folders require access to the approved filesystem root. Supporting Confluence Cloud does not imply support for Confluence Data Center, Jira Data Center, every Atlassian product, or Slack.
2. **Keep the source contract neutral.** Each connector emits stable source/object identifiers, observed revision, extracted content, metadata, links, ACL knowledge state, and scan completeness. File parsers and application adapters should share normalization and validation instead of making the whole runtime depend on Confluence's API shape.
3. **Make setup scoped and repeatable.** Choose app → configure site/credential reference → choose projects/spaces or folder root → inspect discovered scope and unsupported objects → bind destination → scan. Scoped discovery is automatic after configuration; destination registration and permissions still require configuration.
4. **Treat local execution as the initial deployment fact.** A locally running Python worker is a reasonable backend foundation. Hosted management, outbound worker enrollment, remote fleet upgrades, customer SSO, and private-VPC packaging require their own implementation and validation. Show these only as concepts if they appear in the website.
5. **Keep the public website a mockup.** Put a persistent “Product preview · Sample data” indication on the workspace. A click can show a connection setup journey and sample discovery, but must not collect a production credential or claim an app is connected. Prefer “Preview setup” and “View sample scan” over a fake successful OAuth result.
6. **Do not confuse connectivity with synchronization.** A proxy lets a process reach an API; it does not provide pagination, change capture, deletion semantics, safe credential rotation, permission reconciliation, downstream lineage, or verified AI retrieval. Those remain Concord connector/runtime responsibilities.

## Suggested precise public copy

Headline: **Keep your agents connected to current company knowledge.**

Supporting line: **Concord keeps the data your agents use in sync with changes across your business apps. Starting with Confluence and Jira.**

Preview marker: **Product preview · Sample data**

Connection call to action: **Preview Atlassian setup**

Backend availability note: **A local Python backend is available for supported source scanning. Live Atlassian access and customer AI destinations require configuration and validation.**

The final availability wording must follow the release's actual implemented adapters and test evidence. Do not label an adapter production-ready from fixture tests alone.

## Information required before promising enterprise deployment

- Confirm customer preference: customer-operated worker only, managed control plane plus worker, or fully private service.
- Specify what source content, metadata, credentials, and telemetry cross each trust boundary.
- Establish support for enrollment, secret storage, upgrades, tenant isolation, outbound allowlists, and failure recovery.
- Validate an actual Atlassian tenant and one actual retrieval destination with authorized test identities.
- Measure setup time and scan/sync lag under customer-sized pages/issues and API-rate limits.

