# Concord local automatic synchronization runtime

**Implemented scope, reviewed 2026-09-05:** a single-tenant Python process automatically observes one configured source, updates a durable SQLite text/chunk index, invalidates a registered local response cache, verifies readback and exercises two registered local retrieval routes. This is a working local runtime with actual HTTP endpoints. It is not a hosted enterprise connector, vector database, embedding service, customer IAM integration or universal agent-memory synchronizer.

**v5 source guide:** [Atlassian setup and expanded file coverage](atlassian-mvp.md). The main website is now a product mockup; the automatic browser lab is at `/runtime-lab`.

## Start from a source checkout

Requirements: Python 3.11+ and Linux, macOS or WSL for the filesystem source's POSIX no-follow traversal. No `pip install` or model API key is required. Windows users should use WSL; native Windows filesystem observation is explicitly unsupported. From the repository's `platform/backend` directory (or `backend` in a standalone platform checkout):

```bash
python -m concord.runtime init --directory ../../concord-local
python -m concord.runtime run --config ../../concord-local/runtime.json
```

The first command accepts only a new or empty directory. It creates:

- `runtime.json`: explicit source, state and polling configuration.
- `source/product-policy.json` and `source/team-handbook.json`: editable, clearly labeled example source documents.
- `credentials.local.json`: three distinct credentials, each generated from 32 random bytes; owner-only permissions (`0600`) on POSIX. The command never prints their values.
- `state/`: durable SQLite data, cache, jobs and source binding.
- `.gitignore`: excludes credentials and runtime state from version control.

The second command starts the automatic observer immediately and serves a console at `http://127.0.0.1:8080`. Opening the console or selecting **View sync status** does not start synchronization; it only views an already-running process. The configured poll interval defaults to 2 seconds, with a supported range of 1–3600 seconds. Each wait starts after the preceding scan ends, so scan duration is additional to the interval. Press `Ctrl+C` to stop.

Open the local credential file in a trusted editor when you need a token. Do not commit or send that file to colleagues. Each colleague should run `init` to create their own credentials. Tokens entered in the console stay in tab memory; no cookies or browser storage are used. **Lock console** clears displayed data and token inputs.

## Verify the intended operating model

1. Run the runtime, enter the operator token in the console, and view status.
2. Use the `alex_support` consumer token to search `Atlas`. The server binds this credential to `alex` and route `support`.
3. Use the `jordan_success` token to search `Atlas`. This route uses the separate local response cache.
4. In your editor, change `source/product-policy.json`, for example from `30 days` to `45 days`. Save the source file. Do not press a Concord repair or change button; none is required.
5. Search the new phrase through both credentials. Inspect the updated content, revision and content hash in actual HTTP results, and the new status records.
6. Change that document's `acl` to `["jordan"]`. After a complete successful scan, Alex cannot retrieve the document while Jordan can. The unrelated handbook remains available to Alex.
7. Temporarily rename the source directory. The next incomplete scan blocks covered retrieval; it does not interpret the outage as a deletion. Restoring the directory allows reconciliation to recover.

The CLI acceptance test runs this flow as a subprocess, checks both nonempty HTTP search paths, exercises the success-route cache, and checks deletion and restart. A fixture-specific 8-second acceptance deadline is a local test target, not an enterprise synchronization SLA.

## Sources: implemented capabilities and limits

| Source | Automatically observed | Initial configuration | Explicit limits |
| --- | --- | --- | --- |
| `confluence_cloud` | Current API-visible page text in configured spaces or page IDs | Fixed OAuth gateway, existing bearer token via environment, explicit scope | No OAuth consent/refresh or effective ACL resolver. Missing records are quarantined. See `atlassian-source-contract.md`. |
| `jira_cloud` | API-visible issues in configured projects, optional JQL | Fixed OAuth gateway, existing bearer token via environment, project keys | Search is eventually consistent. No comments/attachments or effective ACL resolver. Missing records are quarantined. |
| `filesystem` | Supported `.json`, `.md`, `.txt`, `.csv`, `.html`, `.htm` and `.docx` documents within the configured root; content changes; explicit JSON ACL changes; metadata/title changes; additions; disappearance in a complete scan | Root directory; explicit operator ACL list for extracted text formats, or per-document ACL for JSON | Hidden files and unsupported extensions are outside scope. Symlinks, invalid schemas, size/count limits and unreadable paths make the scan incomplete. No OS ACL inference. Extracted-file rename means deletion plus addition. DOCX covers main-body text only; no PDF/OCR. See `file-source-coverage.md`. |
| `json_http` | The fixed API endpoint's explicitly complete snapshot, including document content, revision, ACL and metadata | HTTPS endpoint; optional bearer-token environment-variable name; producer must implement the snapshot contract | This is a tested transport contract, not an off-the-shelf connector to arbitrary SaaS APIs. No pagination, event subscriptions, redirect following or inferred producer completeness. `complete:true` is the producer's scope assertion. |
| `bookstack` | Current contents of explicitly configured page IDs via BookStack's page-read API | Base URL; page IDs; token ID/secret environment-variable names; optional explicit declaration of public content | No automatic inventory, effective per-user ACL resolution, attachment sync or deletion detection. A missing/unreadable configured page makes the scan incomplete. Without independently resolved ACL or explicit public-content configuration, its documents remain blocked. Transport fixture tests do not establish live customer validation. |

Source JSON document contract:

```json
{
  "schema_version": 1,
  "id": "product-policy",
  "title": "Product support policy",
  "content": "The Atlas plan includes 45 days of support.",
  "acl": ["alex", "jordan"],
  "metadata": {"product": "Atlas"}
}
```

`revision` is optional; adapters derive a deterministic revision fingerprint when absent. Unknown ACL (`null`) is not a grant. An empty ACL (`[]`) grants no identity. The runtime does not infer a customer's real user identity from these names. The local consumer mapping is configured by the operator and is not enterprise identity federation.

JSON API snapshot contract:

```json
{
  "schema_version": 1,
  "complete": true,
  "deletion_authoritative": false,
  "cursor": "producer-owned-opaque-revision",
  "documents": [
    {
      "schema_version": 1,
      "id": "product-policy",
      "title": "Product support policy",
      "content": "The Atlas plan includes 45 days of support.",
      "acl": ["alex", "jordan"]
    }
  ]
}
```

**Deletion semantics:** `deletion_authoritative` defaults to `false`; missing prior records remain stored but blocked as `source_missing_or_no_longer_visible`. Set it to `true` only when the producer can assert a complete authoritative inventory of the configured scope. Two confirming authoritative scans are required before removal. Incomplete scans never justify deletion.

Example runtime configurations are adjacent to this guide. Replace environment-variable names and endpoints in a private local configuration; never put secret values in it. HTTP requires HTTPS except when the operator explicitly enables literal loopback HTTP for a local test. Queries, URL-embedded credentials and redirects are rejected. BookStack's total scan deadline is configurable through `max_scan_seconds` (default CLI value 30 seconds, maximum 120); each request also has a bounded timeout.

## Authenticated local API

| Endpoint | Credential | Result |
| --- | --- | --- |
| `GET /healthz` | None | Minimal `{"status":"ok"}` process liveness. This does not mean data is current. |
| `GET /v1/status` | Operator bearer token | Source/index/job metadata and observer timestamps. No document content or raw adapter credentials. |
| `POST /v1/retrieve` | Consumer bearer token | Search through the credential's configured identity and route. JSON body must contain only `query`, 1–512 characters. |
| `GET /` | None | Local operational console; data requires a credential. |

Authentication uses the `Authorization: Bearer …` header only. Identity and route cannot be supplied or overridden in a retrieval request. The operator token cannot retrieve content by inventing another identity. There are no source-edit, arbitrary connector, forced-sync or arbitrary URL endpoints.

The server binds only `127.0.0.1`, accepts only the matching loopback Host/port, rejects cross-origin requests, sends no wildcard CORS headers, and accepts no query parameters. It is intentionally not configurable as a public network service. Customer deployment behind shared authentication, TLS and authorization boundaries needs a separate security review and implementation.

Input JSON is limited to 4 KB; response JSON to 2 MB. API methods return sanitized errors. Requests encountering a busy source scan return `503 sync_busy` after at most 0.25 seconds of lock waiting instead of accumulating indefinitely blocked request threads. The console labels this unavailable and does not infer freshness from it. Source polling runs in a daemon worker; shutdown does not wait indefinitely for an unavailable external endpoint.

## Durable state and safe reconfiguration

The database has an OS process lock and an owner-only source-binding sidecar. Its binding includes the normalized source configuration, tenant and connection identifiers. Changing those while reusing an existing database is rejected. Choose a new database path for a changed source scope and establish a new verified baseline. This prevents accidental cross-source or cross-tenant reuse; it is not a claim of general multi-tenant deployment support.

Rotating credentials and changing the poll interval do not change the source binding. Back up or retire old data using your organization's data-handling process. Do not delete binding files to force acceptance of an unrelated existing database.

SQLite state is owner-only, but it contains source-derived content and therefore belongs inside the customer's trusted environment. The runtime does not supply at-rest encryption, enterprise secret storage, remote admin, SSO, automatic process supervision or high availability.

## Measuring “up to date”

- **Source observation age:** age of the last complete successful observation. The current core field `metrics.sync_lag_seconds` is this observation age; it is not an actual source-change propagation measurement.
- **Propagation latency:** measure externally from a recorded source mutation to the first correct response from each registered consumer route. The acceptance test measures this for local fixtures only.
- **Coverage:** enumerate the configured source scope, the two local registered routes and their controlled cache. Unknown/unregistered systems are not counted as synchronized.
- **Read freshness budget:** the current core default is 60 seconds since the last complete observation. An explicitly incomplete scan blocks immediately rather than waiting for the budget. This budget is a local serving policy, not a customer SLA.
- **Verification failures and incomplete scans:** count them separately from source mutations. “No new change observed” is not proof that all external systems are reachable or up to date.

## Rollback and remaining enterprise work

Stop the new process, preserve its configuration and state for inspection, and run the previous checked-out code/configuration on its own preserved database. Do not run old and new processes concurrently on the same SQLite file. There is no production customer integration migration in this local release.

Before a commercial rollout: connect one actual customer's source and retrieval paths, establish authoritative identity/ACL mapping, replace local text retrieval with the existing customer ingestion/vector pipeline adapter, register real cache/memory invalidation, validate missed-event recovery and source-specific structural changes, measure propagation at agreed load, and prove that a second customer can install it repeatably.
