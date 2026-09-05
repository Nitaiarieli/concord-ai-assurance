# Atlassian Cloud backend contract

Checked against primary documentation on **2026-09-05**. Implementation status: Python adapters and loopback HTTP contract tests; **not validated against a live customer Atlassian tenant**. The website is a product mockup and never collects these credentials.

## What is implemented

| Source | Configured scope | Read path | Normalized content |
| --- | --- | --- | --- |
| Confluence Cloud | Exactly one of explicit numeric space IDs or page IDs | `GET /wiki/api/v2/pages`, `status=current`, `body-format=storage`; cursor pagination | Page title, extracted storage text, version, page/space/parent IDs |
| Jira Cloud | Explicit project keys with an optional additional JQL filter | `GET /rest/api/3/search/jql`, opaque `nextPageToken` pagination | Issue summary, description text/ADF text nodes, returned status name, issue/project IDs and update timestamp |

Confluence spaces allow scoped discovery of API-visible pages. Configured page IDs do not imply discovering child pages. Jira project scope is mandatory; a JQL filter can narrow it. Both adapters return `SourceDocument` objects into the same SQLite synchronization runtime as file and HTTP sources. A scheduler already provided by that runtime polls them; no per-change user action is required.

These are read-only adapters: they never write to Jira or Confluence. This implementation does not ingest attachments, comments, page drafts, issue history, custom fields, or externally resolved macros/cards. Jira embedded node types omitted from text are recorded in document metadata. A returned status is validated, included in searchable text and recorded as `status_name`; if the API omits it, `status_coverage=not_returned` makes that gap explicit. Confluence storage is flattened to text; macros are not evaluated. These exclusions are part of the extraction scope, not claims that all application information was captured.

## Authentication and operator configuration

The adapters use **an existing OAuth access token**, supplied only through an environment-variable name in customer-side configuration. The allowed HTTPS base is the official OAuth gateway, with product and cloud ID:

```json
{
  "type": "confluence_cloud",
  "base_url": "https://api.atlassian.com/ex/confluence/CLOUD-ID",
  "token_env": "ATLASSIAN_ACCESS_TOKEN",
  "space_ids": ["12345"],
  "max_documents": 1000,
  "max_pages": 20,
  "page_size": 50,
  "max_scan_seconds": 30
}
```

```json
{
  "type": "jira_cloud",
  "base_url": "https://api.atlassian.com/ex/jira/CLOUD-ID",
  "token_env": "ATLASSIAN_ACCESS_TOKEN",
  "project_keys": ["CON"],
  "jql_filter": "statusCategory != Done",
  "max_documents": 1000,
  "max_pages": 20,
  "page_size": 50
}
```

These snippets replace the `source` object in a configured runtime. Use a separate runtime state database and connection ID per configured source. **Consent, distributable OAuth application registration, token exchange, secure refresh-token storage, token refresh, hosted worker enrollment and shared organization management are not implemented.** For unattended customer use those are necessary work, not details hidden behind a functioning “Connect” button. An expired token produces an incomplete observation and read barrier until credentials recover. For development use an existing authorized test token; do not instruct customers to create individual OAuth apps or paste API tokens into the public website.

Atlassian documents the OAuth gateway and user grant flow. Its published guidance recommends a distributable 3LO app and explicitly addresses applications that collect API tokens or require individual customer apps. [Jira OAuth 2.0](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/), [Confluence OAuth 2.0](https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/), [Atlassian authentication guidance](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/).

## Permissions, visibility and disappearance

Default `acl=None` means effective consumer permission is unknown, so downstream runtime retrieval is denied. The permission of the OAuth-connected account is not evidence that another employee or agent can retrieve the document.

For a deliberately scoped test corpus, an operator can declare exact destination identities by adding both:

```json
{
  "operator_declared_access": true,
  "allowed_identities": ["alex", "jordan"]
}
```

This is a local access declaration, **not inferred Atlassian permission**. It does not track a user's group membership, space restrictions or issue security changes. An empty list declares that nobody can retrieve; no wildcard grant exists. Metadata keeps `effective_authorization=unknown` and `acl_basis=operator_declaration` so a test grant cannot silently become a provider permission claim.

Successfully traversing every returned page sets `Snapshot.complete=True` only for the configured visible API scope. Both adapters always set `deletion_authoritative=False`. If a previously indexed item disappears, the core preserves its evidence and quarantines it as `source_missing_or_no_longer_visible`; it must not label the object “deleted in Atlassian.” Retrieval and its registered cache are blocked for that object. Reappearance requires source and retrieval verification before release. Permission-filtered responses, JQL membership changes and eventually consistent search can all cause disappearance without deletion.

This follows the documented permission-filtered behavior of [Confluence page reads](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/) and [Jira enhanced search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/). Jira also states that search can lag a recent update; two matching search snapshots do not prove the API has already exposed the newest source write.

## Bounds and recovery

- Maximum 1,000 documents and 100 HTTP pages per scan; default 20 pages of 50 items.
- Maximum 4 MB per response; default 2 MB. Total response bytes are bounded by `max_pages × max_bytes` (default upper bound 40 MB), plus HTTP headers. Aggregate scan deadline defaults to 30 seconds, at most 120 seconds.
- Default request timeout is five seconds. HTTP redirects are refused. Pagination never changes the origin or original configured scope. Confluence next links supply only a validated cursor; all other query parameters are rebuilt from configuration. Repeated cursors, duplicate IDs, malformed data, non-200 responses or exceeded limits make the scan incomplete.
- HTTP 429 is not automatically retried within a scan. The normal scheduler observes again on a later poll; adaptive rate-limit backoff is not implemented. Set a conservative API poll interval (for example 60–300 seconds during a small test), then choose it from observed quotas and scan cost. Do not advertise a fixed freshness SLA before live measurement.
- Scans are read twice by the core when applying changes. This increases request cost and remains bounded per scan; it is not a provider transaction or a global snapshot.
- A complete initial state and bounded full scans are implemented. Webhook intake, incremental checkpoints, provider deletion/tombstone feeds and historical event replay are deferred.
- Tokens, response bodies and arbitrary URLs are excluded from operational error messages. No secret is embedded into generated configuration or public assets. Loopback HTTP is only available through explicit `allow_loopback_http=true` and a literal loopback IP for fixture tests.

## Validation

`tests/test_runtime_atlassian.py` exercises actual HTTP requests to a local fixture server: Confluence page scope and pagination, cursor scope preservation, origin and redirect rejection, rate limiting after a partial page, count/byte bounds, unknown ACL, explicit local grants, Jira's enhanced endpoint and opaque pagination, ADF extraction boundaries, malformed schemas, missing credentials, and an HTTP-to-runtime test that updates indexed text, quarantines disappearance and verifies recovery.

These tests validate Concord's adapter contract and local runtime integration. They do not validate an Atlassian tenant, API rate limits, OAuth consent, real employees' permissions, or a customer's vector database/agent retrieval path.

## Wiring into the CLI

`atlassian_config.py` exposes `normalize_atlassian_source(config)` and `create_atlassian_source(config)`. The CLI calls the normalizer before the legacy source-key allowlist when `source.type` is `confluence_cloud` or `jira_cloud`and converts configuration exceptions to the CLI's safe `ConfigurationError`. In `create_source`, it dispatches those kinds explicitly before the legacy BookStack fallback. Normalization constructs an adapter but reads no secret and sends no request.

The core must include the backward-compatible `Snapshot.deletion_authoritative` contract. No additional Python dependencies are required.

ADF text extraction is based on Atlassian's documented structured format. [Atlassian Document Format](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/).
