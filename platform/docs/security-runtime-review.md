# Concord v4 — Security / correctness implementation review

Checked: 2026-09-05. Reviewer angle: defensive security and distributed-update correctness. No personal work history or security certification is asserted. Review scope is the new Python local runtime, adapters, HTTP host and browser demonstration. No customer account or external vector database was tested.

## Decision

The local automatic-observer release is acceptable as a bounded technical implementation once the UI state corrections below are applied. It must continue to distinguish the browser fixture from the installable local service, and both from a customer-integrated enterprise deployment.

The key product boundary is preserved: the source owner edits the source, the worker observes it independently, and routine changes do not require a Concord case selection or repair click. Security conditions support automatic freshness; they do not redefine Concord as a manual permission-testing product.

## Concrete defects found and corrected

| Finding | Consequence | Disposition and independent verification |
|---|---|---|
| A connector could raise `ValueError` with a token/URL and the core forwarded its text | Operational status could disclose provider secrets | Source exceptions are sanitized before runtime-owned validation. An adversarial secret-canary exception no longer appears in status. |
| Initial worker lease could expire during a scan without a publish fence | An old worker could overwrite work published by a newer worker | Owner, local generation and lease checks were added within write transactions and before publish/error writes. A two-worker, same-database fake-clock takeover test preserves the newer value. |
| API status/retrieval waited indefinitely for the synchronization lock | A slow source hid health and tied up request threads | Bounded acquisition returns `503 sync_busy` with safe metadata. The same test that previously timed out now returns promptly. |
| HTTP `read1` could accept premature EOF when a JSON prefix parsed | A transport-truncated response might be treated as complete | Received bytes must match declared Content-Length. A local HTTP fixture with valid JSON but truncated advertised length is rejected. |
| Unknown-ACL updates could have a job labeled verified while retrieval remained blocked | Job wording could imply permission-ready data | Core jobs are explicitly blocked for unknown ACL; scoped bytes may exist, but retrieval remains denied. |
| Unbounded/nonfinite freshness configuration | NaN could defeat elapsed-budget comparison | Runtime now requires a finite positive freshness budget. |

BookStack also gained an aggregate scan budget in addition to per-request bounds. The runtime confirms the source a second time and discards work if the observed manifest changes. DNS resolution and all-source atomic snapshots are not promised by this local implementation.

## Independent adversarial results

Thirteen checks passed against the actual supplied implementation:

- Six SQLite-core checks: partial scan retains previous rows but blocks both routes; source exception secret redaction; unknown ACL/unsupported schema do not grant reads; altered cache content cannot override authoritative indexed content; colliding document IDs remain scoped to tenant namespaces; expired worker cannot overwrite its successor.
- Four HTTP-host checks: operator and consumer privileges remain separate; consumer identity/route is server-bound; hostile Origin/Host and URL-token parameters are rejected; there is no source-mutation endpoint; status remains responsive while polling is blocked. Related assertions are grouped in four test cases.
- Three adapter checks: a redirect cannot relay credentials to a different location; premature EOF fails; a filesystem symlink cannot disclose content outside the configured root.

These tests use source doubles or explicitly local HTTP fixtures where appropriate. They establish behavior of the exercised code, not real BookStack authorization, tenant-isolated enterprise operation, scale, or immunity to all failures.

Internal reproducer files: `test_runtime_adversarial.py`, `test_local_api_boundary.py`, `test_source_boundaries.py`. These currently reference the review checkout paths and must be adapted to ordinary package imports if copied into the repository test suite.

## Browser and console review

The browser UI uses React text rendering; the operational console uses `textContent` for source/status/retrieval values. The reviewed code does not turn source text into HTML, shell commands, endpoint selection, policy changes or model instructions. This does not make downstream source content factually correct or resistant to prompt injection in another AI application.

The local console was asked to rename its status-view button so it does not imply a manual action is required to begin source observation. It stores credentials in tab memory, avoids query-string tokens, and clears the view on lock/pagehide. Consumer credentials bind identity and route on the server; the browser fixture's identity selector is explicitly a simulation.

The first new Site draft had three state/copy defects reported to the root implementer before publication:

1. `sync_lag_seconds` represented age since the last completed scan, but the caption called it detection-to-verification latency. Display scan age unless a real processing duration is measured.
2. The Connections badge could show green before any first complete observation. Use starting/unknown until supported by state.
3. A worker error left historical per-document green badges. Mark historical/unknown and surface retrieval's blocked status/reason separately from an empty search result.

The setup page must also state the POSIX filesystem adapter requirement (Linux/macOS, or a supported WSL/container path). Plain native Windows plus Python does not establish filesystem-source support.

## Remaining deployment boundaries

- The CLI is a local, single-tenant installation. A namespace unit test does not establish hosted multi-tenant isolation, federation, SSO or customer IAM.
- Filesystem identities are explicit operator policy. JSON API scope/completeness is a source-producer contract. Neither discovers effective enterprise permissions.
- BookStack reads explicitly configured page IDs. Its service token does not prove user authorization; missing/unreadable pages make observation incomplete. Inventory discovery and deletion confirmation are outside this adapter's supported claim.
- BookStack public-content mode is an operator declaration restricted to named destination identities. It must never be described as discovered effective access or enabled by default for sensitive data.
- The HTTP listener is loopback-only; credentials/content remain in the local installation. Remote/container access, reverse-proxy TLS and real application identity delegation require an explicit deployment design and validation.
- The local SQLite lexical route and document cache are real implementations. External vector databases, arbitrary RAG pipelines, enterprise application caches and agent memories remain unconnected.
- Verification is relative to the latest complete, confirmed observation and configured freshness budget. It does not capture every intermediate user/agent action, retract already emitted answers, change model weights, or prove every query returns a correct answer.

Before a sensitive customer pilot, require a real source identity model or an explicitly scoped unrestricted corpus, customer/connection namespaces, the actual retrieval path with server-authenticated identities, registered caches, and source-to-route recovery tests. This is a condition on the commercial integration, not a reason to block the honest local technical release.

## Root integration follow-up

All 13 independent cases were ported to normal package imports and included in the 82-test repository suite. The actual console HTTP envelope mismatch was corrected; `npm run test:console` exercises a real local API response in the shipped console script and checks that a network failure clears prior cards. The final browser UI labels observation age accurately, waits for first complete scan before a connection pass, and labels previous query data historical when the source becomes unhealthy.
