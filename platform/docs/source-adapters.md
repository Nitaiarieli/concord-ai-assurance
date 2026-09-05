# Source adapters and deployment boundaries

Status: implemented source polling adapters, tested against local files and a local HTTP test server. No live customer BookStack instance or commercial SaaS connector has been validated. Checked 2026-09-05.

## What is automatic

The runtime calls `source.scan()` on its configured schedule. A user or agent edits data in the source; no Concord button or manually selected change event is required. Each scan returns the current observed document set. The runtime compares content, ACL and structural fingerprints with its durable prior state, then confirms the observed snapshot before publishing a verified destination update.

This is bounded current-state polling, not an event log. An intermediate value created and removed between scans might never be observed. A scan is not a point-in-time transaction across files or remote pages. The runtime's second complete scan reduces observation races; a change after the last observation is handled by a later poll. End-to-end freshness includes both scans, processing and verification time. Polling interval alone is not a synchronization SLA.

## Coverage

| Source | Automatically discovered | Initial operator configuration | Permissions | Missing objects / limitations |
| --- | --- | --- | --- | --- |
| Local filesystem | Non-hidden `.md` and `.json` files recursively within the chosen directory, within configured limits | Root directory, read-only mount, Markdown identities or explicit per-document JSON ACL | Markdown uses configured named identities; default is unknown. JSON requires explicit `acl` | Only a successful complete bounded scan establishes absence within configured scope. Unreadability, malformed data, ID collisions, symlinks or a limit breach make the entire observation incomplete. |
| Generic JSON HTTP snapshot | Documents supplied by one fixed endpoint under schema version 1 | HTTPS endpoint exposing the documented envelope; optional bearer-token environment-variable name | Endpoint must supply each document's ACL. `null` is unknown, `[]` denies all; wildcard identities unsupported | Producer must truthfully assert completeness within a fixed configured scope. No pagination or arbitrary vendor API discovery is implemented. A complete empty list means no observed documents in that scope. Source omission is not evidence of physical deletion from all systems. |
| BookStack | Content changes for explicitly configured page IDs only | Base URL, page IDs, dedicated read token environment references | Effective user ACL stays unknown. An optional operator-declared public-content mode grants only explicitly named destination identities; it does not calculate BookStack authorization | No discovery of all pages, effective ACL resolution, attachments, confirmed deletion events, role changes or administrative audit feed. Any missing, forbidden, rate-limited or malformed configured page makes the whole scan incomplete. |

Supported structure changes are changes represented in the current document schema: title, content, ACL, supported metadata and supported source-parent metadata. Unknown schema versions stop publication. Generic schema evolution, field mapping migrations, automatic database schema inference and unregistered agent-memory discovery are future work.

Markdown identity is `file:<relative/path.md>`; renaming a Markdown file is removal plus addition. JSON documents use explicit stable IDs, so a filename change preserves identity. IDs must be unique across the configured source, including collisions between Markdown and JSON. Configuration scope changes require an explicit rebaseline/new connection identity; changing the root or endpoint must not silently relabel omissions as deletion from the previous system.

## Generic HTTP contract

```json
{
  "schema_version": 1,
  "complete": true,
  "cursor": "producer-observation-42",
  "documents": [
    {
      "schema_version": 1,
      "id": "support-policy",
      "title": "Support policy",
      "content": "Priority support now responds within two hours.",
      "revision": "source-revision-42",
      "acl": ["support-agent", "customer-success-agent"],
      "metadata": {"department": "support"}
    }
  ]
}
```

The same document object is accepted as a local `.json` source file. `revision` and `metadata` are optional; missing revision is derived from the observed content and authorization fields. The explicit `schema_version`, `id`, `title`, `content` and `acl` fields are required. Duplicate JSON keys, duplicate IDs, invalid types, unsupported versions and non-finite numbers are rejected. The runtime also fingerprints actual content; a producer revision string is opaque and does not establish monotonic ordering.

`complete: false` preserves uncertainty even when some documents are returned. A missing completeness marker is an error. Response `error` text is not forwarded to logs or the UI. Cursor strings are producer metadata; they are not used to skip reconciliation or to infer that changes cannot have been missed. A connector exposing a change stream must first implement its own resume-token, pagination and reconciliation contract before it can claim incremental consumption.

## BookStack-specific behavior

The adapter reads `GET /api/pages/{id}` using `Authorization: Token <id>:<secret>`, with token parts loaded at request time from named environment variables. It checks the returned numeric page ID, name, HTML content and updated timestamp. HTML is extracted to plain text without rendering JavaScript or fetching referenced URLs. Comments, image content and attachments are excluded. Rendered page includes may appear in returned HTML; their observed text is included in the fingerprint, so an include change can be observed even if the host page's timestamp does not change.

BookStack's API is limited by the API user's permissions. Neither token-owner visibility nor local permission overrides prove another user's effective access. The default adapter therefore emits `acl: null` and `effective_authorization: "unknown"`. Public-content mode is an explicit operator assertion about all returned content, including rendered includes, restricted to named destination identities. It is unsuitable for private content whose changing effective permissions must be resolved automatically. It does not prove that a page is publicly accessible and must never be labeled verified BookStack authorization.

A `403`, `404`, `429`, network error or malformed response is not a deletion tombstone. All configured IDs must be readable to return `complete: true`. The adapter does not remove IDs from its configured list on failure. It performs no writes to BookStack.

Primary documentation, checked 2026-09-05:

- [BookStack API documentation: authentication, page reads and rate limits](https://demo.bookstackapp.com/api/docs) establishes the token format, token-owner visibility, `name`, `html`, `markdown`, `updated_at`, rendered includes and per-user rate limiting. Markdown is not always available, so the adapter uses HTML-to-text extraction.
- [BookStack roles and permissions](https://www.bookstackapp.com/docs/user/roles-and-permissions/) describes role combinations and inherited content permissions. The adapter does not reimplement that policy engine.
- [BookStack content includes](https://www.bookstackapp.com/docs/user/reusing-page-content/) documents included-content behavior and authorization considerations. A returned parent page is not a complete independently discovered dependency graph.

## Security and operational setup

Run the component inside an operator-controlled environment with only the necessary source mounts and network egress. The filesystem adapter requires POSIX no-follow directory-descriptor support; use Linux or a Linux container on Windows. It opens the root path and every descendant directory without following symlinks. Hidden files/directories and non-supported extensions are outside the manifest. Mount source data read-only. Do not use a directory containing credentials or unrelated application configuration as a source root.

HTTP endpoints are fixed trusted operator configuration. They must not be chosen from incoming document content, user queries or arbitrary tenant request parameters. HTTPS uses normal certificate validation. HTTP is permitted only for explicitly enabled literal loopback addresses used by local tests; `localhost` and other names are not a bypass. Requests use a direct configured origin, do not follow redirects, do not inspect source-provided next-page URLs, do not inherit HTTP proxy environment settings, and never fetch images or linked resources. Private HTTPS origins are intentionally possible for self-hosted customer applications; deployment egress controls should restrict which configured hosts the service can reach.

Only environment-variable **names** belong in tracked configuration. Never commit tokens or put secrets in URL query strings. Source errors contain fixed operational messages and status codes, not response bodies, authorization headers or endpoint URLs. Source content remains sensitive data in the customer-side runtime database and is subject to that deployment's access and retention controls.

Default filesystem scan bounds: 1,000 documents, 10,000 directory entries, depth 16, 2 MB per source file and 20 MB total file bytes. Default HTTP bounds: 1,000 documents, 4 MB per response, 10-second request timeout. BookStack defaults: at most 100 configured pages and a 120-second aggregate scan budget, carried into each remaining request. The runtime has additional stricter document/snapshot limits; exceeding either boundary is an explicit incomplete observation. The deployment must size page count and poll interval to provider rate limits and the cost of two complete reads per successful tick.

Socket timeouts and bounded response-read deadlines limit ordinary remote failures. They do not promise hard cancellation of a stalled operating-system DNS lookup. Use a controlled resolver, egress policy and process supervision for customer deployment. No zero-downtime, unlimited throughput or all-events-captured guarantee is implied.

## Verification performed

The adapter suite runs against temporary files and a real loopback HTTP server. It covers discovery after a normal file edit, identity stability, rename semantics, ACL unknown/deny distinction, invalid JSON/schema, missing ACL, duplicate identity, symlink rejection, unreadable roots, FIFO safety, byte/count limits, environment-only credentials, redirect refusal, protocol truncation, response contract failures, non-JSON/compressed responses, header injection, BookStack unknown ACL, public-mode declaration, page mismatch, `403`/`404`/`429` failures and the aggregate scan deadline.

These checks validate adapter behavior, not live vendor compatibility, enterprise identity federation, real external RAG retrieval, VectorDB consistency, missed webhook recovery or organization-wide coverage. Those require explicit customer routes and end-to-end acceptance tests.
