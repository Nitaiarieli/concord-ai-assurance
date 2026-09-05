# Concord v5 security review

Reviewed 2026-09-05: the scratch Atlassian adapters, file extractors/source traversal,
and runtime missing-object quarantine implementation. This is a code/contract
review with local adversarial tests, not a live Atlassian integration assessment.

## Corrections prepared

1. **Generic API deletion authority was ignored.** An API response declaring
   `deletion_authoritative:false` became a default-true runtime snapshot. That
   could remove an existing document when it merely disappeared from API visibility.
   The patch validates this boolean and defaults it to false. Missing documents are
   retained as quarantined evidence and denied on retrieval. An explicit true is
   accepted only as a producer assertion of an authoritative inventory; it cannot
   override an incomplete scan. The producer must establish that the complete scope
   really is authoritative before choosing true.

2. **A slow response could defeat the header deadline.** A local HTTP peer sending
   header bytes every 20 ms made a 50 ms budget take 347 ms; an endless trickle could
   keep the worker waiting. The patch uses a daemon timer to shut down the established
   socket when the request budget expires, covering headers and body even after
   `HTTPConnection` detaches the socket for `Connection: close`. The timer is cancelled
   and joined during cleanup. DNS resolution still depends on the operating system
   resolver before a socket exists; elapsed budget is checked after connect. This is
   not a strict DNS-inclusive wall-clock or product synchronization SLA.

## Reviewed boundaries

- Atlassian credentials are an environment-variable reference read only by the
  backend. The implementation does not implement OAuth consent or token refresh.
- Atlassian HTTPS origin/path is restricted to the configured official OAuth gateway.
  Pagination extracts a cursor and reconstructs the original scoped query. It does
  not follow an arbitrary next URL. Cross-origin links, duplicate/repeated pages,
  partial pagination, invalid bodies and bounds failures remain incomplete.
- API token visibility is not an end user's effective ACL. Atlassian ACL defaults
  to unknown, so retrieval is denied. Operator-declared grants are explicitly marked
  as declarations and require explicit destination identities.
- Complete Atlassian listings remain non-authoritative for deletion. Missing data
  is quarantined, cached text invalidated, and the actual registered retrieval routes
  checked. Source reappearance can release quarantine only after verification.
- File scanning uses POSIX descriptor-relative no-follow traversal, rejects symlink
  and concurrent file replacement hazards, and bounds file, directory and text sizes.
- DOCX archives are read in memory without extracting paths or following external
  relationships. DTD/entity declarations, oversized expansion, high compression
  ratios, excessive members and unsupported XML structures are rejected. HTML,
  CSV and DOCX text is not executed, rendered or used to open embedded links.
- Unknown file formats, PDF/OCR, effective Atlassian permission resolution, external
  destinations, customer agents and real OAuth operation remain outside this proof.

## Verification

The five new independent regression tests pass against the assembled scratch
package: false/default/invalid/true deletion authority and a deliberately slow
header peer. The same patched package also passes 16 Atlassian HTTP contract tests,
24 existing source tests and 13 file-format tests (58 tests in these selected suites).
The root release process still needs its complete integrated suite and browser QA.

Integration artifacts: `shared-sources-security.patch`, full reference
`concord/runtime/sources.py`, and `test_runtime_v5_security.py`. The focused patch is
based on the file-extraction agent's source copy so it does not repeat their changes.
