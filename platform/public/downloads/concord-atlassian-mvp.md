# Concord: Atlassian-first MVP and developer guide

**Status and source check: 2026-09-05.** The website is an interactive product mockup using sample data. The separate Python backend performs real, bounded source scanning and local synchronization. Atlassian adapters have local HTTP contract coverage; no live customer Atlassian tenant or customer AI destination has been validated.

## Product decision

Concord's center is automatic freshness of the information organizational agents consume. Confluence Cloud and Jira Cloud are the first application adapters; file and generic HTTP sources provide an extensible ingestion foundation. Slack and additional enterprise applications remain part of the expansion direction. “Atlassian-first” does not mean all Atlassian products, Cloud and Data Center editions, attachments, or every object type are supported.

The initial use case is a software team whose internal or customer-facing agent relies on changing product knowledge and issues. A page or issue changes in its source; a configured worker observes it on a later scan, normalizes its text and revision, updates the registered local index/cache, and verifies local retrieval. Nobody selects each change in Concord. Connecting the same flow to that team's actual agent retrieval is the next commercial validation gate.

The public mockup should illustrate **choose source → authorize → select scope → review discovered data → monitor synchronization**. Its connection controls preview setup; they do not perform OAuth, collect production tokens, install a worker, or establish an enterprise connection. Sample status and activity are presentation data, not measurements from customer systems.

## What the backend currently supports

| Source | Implemented scan | Setup and boundaries |
|---|---|---|
| Confluence Cloud | API-visible current page text; page/version/space/parent metadata; bounded cursor pagination | Explicit space IDs **or** page IDs, fixed OAuth gateway URL, existing bearer token through an environment-variable reference. Space scope discovers visible pages; a list of page IDs does not discover descendants. |
| Jira Cloud | API-visible issues in explicit projects; summary, description/ADF text and returned status name; update metadata; bounded enhanced-search pagination | Explicit project keys, optional narrowing JQL filter, fixed OAuth gateway, existing bearer token. |
| Files and folders | Recursive regular `.md`, `.json`, `.txt`, `.csv`, `.html`, `.htm`, `.docx` files inside a configured root | UTF-8 text; JSON must use Concord's document contract. CSV is a comma-delimited table; HTML is static text; DOCX covers the main document body. No rendering, script execution or linked-content fetch. |
| Generic JSON API | One bounded endpoint supplying an explicit document snapshot | Adapter-specific normalized JSON contract, optional environment bearer token; no arbitrary SaaS schema discovery or pagination. |
| BookStack | Explicit page IDs through the earlier read adapter | Technical legacy adapter; not the chosen commercial MVP. No live environment validation. |

**Excluded now:** Slack; PDF/OCR; native Windows filesystem scanning; symbolic links; Atlassian Data Center; attachments/comments/history; resolved macros and embedded external content; actual employee effective ACL resolution; external vector databases, agent memory and customer caches.

The runtime is **one configured source per local worker**, with a durable SQLite text/chunk index and two local retrieval routes, one using a controlled local cache. SQLite text retrieval is not a vector database. To run Confluence and Jira concurrently today, configure separate workers, state databases, connection IDs and local ports. A shared organization control plane or multi-source fleet manager is not implemented.

## Start a local backend

Use Python 3.11+ on Linux or WSL; POSIX filesystem traversal is required. The file adapter has been tested on Linux. The runtime needs no model key or additional Python packages. From `platform/backend` in the GitHub handoff, or `backend` in a standalone checkout:

```bash
python -m concord.runtime catalog
python -m concord.runtime init --directory ../../concord-local
python -m concord.runtime scan --config ../../concord-local/runtime.json
python -m concord.runtime run --config ../../concord-local/runtime.json
```

`init` requires a new or empty directory and refuses to overwrite an existing deployment. It creates two sample JSON documents, `runtime.json`, an owner-only `credentials.local.json`, and a state directory. Every colleague should initialize their own credentials. Keep the credential file and state out of source control and outside the scanned source root.

`catalog` reports capabilities without connecting. `scan` reads the configured source once and prints inventory metadata, completeness and errors; it does not populate an index or start the server. Exit code `0` means the configured scan completed, while `2` means an incomplete scan or configuration error. It loads the initialized local configuration and credential file even though it does not serve HTTP. Titles and metadata can still be sensitive; keep this output in the customer environment.

`run` begins automatic polling and serves the local console at `http://127.0.0.1:8080`. Inspect the generated credentials in a trusted local editor. The operator credential can view status; the generated consumer credentials bind Alex to the direct `support` route and Jordan to the cached `success` route. These are test identities, not enterprise SSO. Edit the source files externally and inspect the changed revision and retrieved text after the observer runs. Press `Ctrl+C` to stop.

The API remains loopback-only, validates Host/Origin, and requires bearer credentials for status/retrieval. It must not be exposed as a shared public service without implementing the missing authentication and transport boundary. See [the local runtime guide](local-runtime.md) for endpoint contracts, failures and state handling.

## Configure a bounded Atlassian scan

Initialize a separate empty directory for the test, then edit its private `runtime.json`. This is a complete example configuration; replace the illustrative UUID and space ID with values authorized for your test tenant:

```json
{
  "schema_version": 1,
  "tenant_id": "local",
  "connection_id": "confluence-test",
  "database": "state/confluence.sqlite3",
  "credentials_file": "credentials.local.json",
  "poll_interval_seconds": 120,
  "port": 8080,
  "source": {
    "type": "confluence_cloud",
    "base_url": "https://api.atlassian.com/ex/confluence/11223344-a1b2-3b33-c444-def123456789",
    "token_env": "ATLASSIAN_ACCESS_TOKEN",
    "space_ids": ["12345"],
    "max_documents": 1000,
    "max_pages": 20,
    "page_size": 50,
    "max_scan_seconds": 30
  }
}
```

The worker expects an **existing, authorized OAuth access token** in its environment. Supply it through your approved local secret workflow; do not put its value in configuration, Git, logs or the mockup. A site URL such as `https://company.atlassian.net` or a raw email/API-token pair does not match this adapter's authentication contract. Atlassian's OAuth documentation specifies product gateway URLs using the accessible site's cloud ID. [Official OAuth flow and gateway](https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/).

The current backend does not implement customer consent, OAuth app enrollment, authorization-code exchange, automatic refresh, hosted worker registration or cloud-ID discovery. Concord must implement a distributable authorization flow before promising self-service customer setup. An expired or missing token creates an incomplete observation; it does not turn the source green.

For Jira, use this `source` object in a separate initialized configuration. Give it a different database, `connection_id` and, if running simultaneously, port:

```json
{
  "type": "jira_cloud",
  "base_url": "https://api.atlassian.com/ex/jira/11223344-a1b2-3b33-c444-def123456789",
  "token_env": "ATLASSIAN_ACCESS_TOKEN",
  "project_keys": ["CON"],
  "jql_filter": "statusCategory != Done",
  "max_documents": 1000,
  "max_pages": 20,
  "page_size": 50,
  "max_scan_seconds": 30
}
```

Run `scan` before `run` and inspect its scope/completeness. Both adapters are read-only. The default result has unknown consumer ACL, so the runtime denies retrieval despite successful source scanning. A deliberately authorized test corpus may use the explicit operator access declaration described in [the Atlassian source contract](atlassian-source-contract.md); that declaration never proves real Atlassian employee permissions.

The 120-second interval above is an initial test setting, not an SLA. Full scan duration adds to it; applying changes can require a second source read. Pagination, responses and scan duration are bounded. HTTP 429 makes the scan incomplete; adaptive backoff, webhooks and incremental change capture are not yet implemented.

## Files, API snapshots and safe disappearance handling

For text/Markdown/CSV/HTML/DOCX retrieval, configure exact local test identities in the filesystem `source.identities` list; otherwise access is unknown. JSON documents carry their own explicit `acl`. Filename-derived IDs are `file:<relative/path>`; a rename is an old item disappearing plus a new item. Unsupported extensions and hidden files are outside scope; malformed supported files, unsafe links or exceeded limits make the observation incomplete. DOCX extraction is bounded and does not include headers, footers or embedded objects.

A custom HTTP producer must normalize its API into the following contract. `deletion_authoritative` is a **response field**, not a runtime configuration switch:

```json
{
  "schema_version": 1,
  "complete": true,
  "deletion_authoritative": false,
  "documents": [
    {
      "schema_version": 1,
      "id": "support-policy",
      "title": "Support policy",
      "content": "The Atlas plan includes 45 days of support.",
      "acl": ["alex", "jordan"]
    }
  ]
}
```

Generic JSON defaults `deletion_authoritative` to **false** if omitted. A producer should assert true only when its complete feed authoritatively defines existence for that registered scope. Atlassian adapters always set it false: source reads are permission-filtered, and an item can leave the visible scope without being deleted. [Confluence page permissions](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/), [Jira search permissions and consistency](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/).

On a complete non-authoritative observation, a previously known missing item is quarantined as `source_missing_or_no_longer_visible`; its covered retrieval and cache are blocked while evidence is retained. On an incomplete observation, the runtime applies a read barrier rather than inferring mass deletion. Reappearance requires reconciliation and verification. Jira also documents delayed visibility after recent writes, so matching search responses do not establish that the newest write is already exposed by the provider.

Changing configured source scope requires a new database path and baseline. State is bound to its original tenant/source configuration; do not remove binding files to reuse unrelated data. Restart or roll back with preserved matching code/configuration/state, never with two processes writing one database.

## Deployment inspiration: precisely what Harmony establishes

The intended reference is **Harmony.io**. Its official On-Premises Proxy page describes a local component that opens an encrypted outbound tunnel to configured internal targets, connecting them to Harmony cloud workflows without inbound firewall changes. This is vendor-documented architecture, not a deployment independently tested here. [Harmony On-Premises Proxy](https://harmony.io/integrations/on-premises-proxy).

Concord can adopt the scoped connection and minimal ongoing intervention experience. Its current worker executes locally; a managed cloud control plane, outbound enrollment/tunnel, remote updates and full private-VPC packaging remain planned work. The reviewed Harmony sources did not establish full-platform self-hosting or air-gapped operation. See [deployment research](harmony-deployment.md) for evidence and unknowns.

## Next gates and a focused 90-day scope

| Period | Product responsibility | Engineering responsibility | Evidence needed to advance |
|---|---|---|---|
| Days 1–30 | Recruit an Atlassian design partner; identify one agent's stale-knowledge failure and baseline maintenance cost; validate the setup mockup | Validate one authorized Confluence tenant; implement distributable OAuth consent/refresh and secret handling; enumerate actual scope and extraction gaps | Repeatable authorized scan, expiry recovery, documented limits; customer identifies a specific workflow worth fixing |
| Days 31–60 | Agree freshness and coverage targets; price a bounded paid pilot against observed maintenance work | Connect one actual customer ingestion/retrieval destination; implement authoritative identity mapping, targeted updates, cache invalidation and independent retrieval checks; measure rate limits and provider delay | Source mutation → correct customer retrieval, plus access-denied and unaffected-document controls, under failures and restart |
| Days 61–90 | Convert the pilot based on measured benefit; test setup with a second customer | Harden the initial path, add Jira only where useful, introduce incremental observation/backoff where measured costs justify it, and validate worker upgrades/rollback | Second installation without bespoke reconstruction; measured propagation distribution, coverage, recovery and operating cost |

These dates are planning targets, not commitments that unresolved integration work is already complete. Broader app support, large file-format coverage and cloud fleet management should follow repeated demand. Measure “up to date” as propagation time from a known source write to verified registered retrieval, together with coverage and failure rate. Observation age alone cannot prove that an agent has the newest data.

