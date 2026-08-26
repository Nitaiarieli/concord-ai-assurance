# Concord BookStack Integration Readiness Report

**Status:** Ready for a BookStack endpoint, credentials, destination confirmation, and a test identity  
**Prepared:** 2026-08-21  
**MVP destination:** Deterministic local retrieval index  

## Executive readiness

| Component | State | What is true now |
|---|---|---|
| Concord Core | READY | Deterministic impact, policy, security epoch, remediation, verification, proof, and Serve Guard are implemented. |
| Connector Contract | READY | The source connector maps application objects and events into connector-independent Concord records. |
| BookStack Adapter | READY FOR CREDENTIALS | Endpoint validation, token isolation, system probe, page read, permission-override read, webhook observation, reconciliation input, and event normalization are implemented. |
| Artifact Registry | READY | Generic AI-consumable artifacts and source-to-artifact lineage are represented by typed nodes, versioned edges, and lineage records. |
| Local Index Adapter | READY | Deterministic tokenization, identity-aware retrieval, idempotent rebuild, deletion, blocking, read-back, and version observation are implemented. |
| Policy and Remediation | READY | Cost is considered only after correctness; a zero budget cannot remove mandatory work. |
| Verification | READY FOR IDENTITY | The interface tests actual destination retrieval and authorization. Live BookStack verification needs a test identity. |
| Evidence | READY | Actions, versions, epochs, boundary observations, receipts, and proof hashes are recorded. |
| Mock E2E | PASSING | Page update and permission-revocation lifecycles pass using realistic BookStack responses. |

## Architecture currently running

```text
BookStack API + Webhooks
        |
        v
BookStackConnector (customer runtime)
  - /api/system probe
  - /api/pages/{id}
  - /api/content-permissions/page/{id}
  - webhook observation + API reconciliation
        |
        v
NormalizedSourceObject + NormalizedEvent
        |
        v
Versioned Dependency / Lineage Graph
        |
        v
Deterministic Impact + Policy + Security Epoch
        |
        v
Safely Sufficient Remediation Plan
        |
        v
Deterministic Local Index Adapter
        |
        v
Identity-Aware Retrieval Verification
        |
        v
Proof Object + Serve Guard
```

Application-specific behavior ends at the BookStack connector. Impact analysis, policy, remediation ordering, proof state, and serving decisions stay in the Concord core. A future connector implements the same source contract and reuses the core.

## Implemented BookStack contract

The adapter is built against BookStack's documented token authentication and current API routes:

- `GET /api/system` — connectivity and BookStack version probe.
- `GET /api/pages` — bounded page discovery and reconciliation.
- `GET /api/pages/{id}` — authoritative page snapshot.
- `GET /api/content-permissions/page/{id}` — configured page permission overrides.
- `GET /api/audit-log` — ordered reconciliation cursor when the deployed BookStack role permits it.
- BookStack outgoing webhooks — low-latency observation, followed by API reconciliation before a correctness decision.
- `GET /api/pages/{id}` using the test identity — authoritative access observation for the identity under test.

Authentication uses `Authorization: Token <token_id>:<token_secret>` only inside the customer runtime. Concord stores a credential reference and runtime-token hash, never the BookStack token secret.

### Important authorization limitation

BookStack's content-permissions endpoint exposes configured overrides. It does not provide a complete evaluated permission answer across inherited container permissions, roles, and all identities. The BookStack controller also requires the `RestrictionsManage` permission for the relevant item.

Therefore:

1. Permission configuration is dependency evidence, not final correctness proof.
2. A webhook is an observation, not proof of final source state.
3. The adapter reconciles the current API state.
4. The final authorization test uses the real test identity.
5. If the identity test cannot run, a security-sensitive artifact stays blocked.

## Required BookStack permissions

### Connector service account

Minimum intended role for the first controlled test:

- **Access System API**.
- **View** access to the specific test shelf, book, chapter, and page being monitored.
- **Manage content restrictions** (`RestrictionsManage`) on the monitored test content, required to read configured content-permission overrides.
- Permission to read the audit log if audit-log reconciliation is enabled in the environment.
- No content create, update, delete, user-management, or role-management permission is required for the initial read-only Concord connector.

If audit-log permission cannot be granted, the MVP can use webhooks plus bounded periodic page reconciliation, but the reduced observability must be recorded as a limitation.

### Test identity

Use a separate non-administrator BookStack user representing a normal employee:

- **Access System API** only if verification will use the BookStack page API.
- Normal role and content visibility matching the scenario.
- No `RestrictionsManage`, user administration, or role administration permission.
- A separate short-lived test credential or authenticated session stored in the customer vault.

The test identity must initially be able to view one controlled page and must lose access during the revocation test.

## First AI destination

The implemented first destination is a deterministic local index.

This choice is deliberate:

- no embedding-provider credentials are required;
- indexing and retrieval are reproducible;
- version consumption can be observed directly;
- permission filtering can be tested without vector similarity ambiguity;
- the adapter contract remains generic, so a vector database can replace it later.

The local index is a POC destination, not a claim that production RAG should use lexical retrieval. The next destination adapter can implement vector records while preserving stable artifact identifiers, source versions, identity policy, idempotent actions, read-back, and retrieval verification.

## Simulated E2E results

### Scenario A — page content update

```text
Mock BookStack page v1
  -> registered local-index artifact
  -> page changes to v2
  -> authenticated page and permission reads
  -> normalized CONTENT_UPDATED event
  -> affected lineage traversed
  -> deterministic REBUILD actions
  -> local-index retrieval finds the new term
  -> consumed source version v2 observed
  -> proof succeeds
  -> Serve Guard allows the current artifact
```

### Scenario B — permission revocation

```text
Test identity can retrieve Page 42
  -> access is revoked in mocked BookStack
  -> normalized ACCESS_REVOKED event
  -> tenant security epoch advances before repair
  -> old proof is unusable
  -> affected artifact is BLOCKED_SECURITY
  -> identity authorization is removed from the local index
  -> retrieval as the affected identity returns no result
  -> source version and authorization outcome are observed
  -> proof succeeds at the new epoch
```

### Fail-closed scenario

When the connector has a permission change but no complete test-identity observation, the event is classified `security_unknown`. The local index remains blocked, verification fails, no current proof is issued, and Serve Guard returns `BLOCK`.

## Automated validation added

- Authenticated BookStack system, page, and permission mock reads.
- Content-update E2E through actual local-index retrieval.
- Permission-revocation E2E through identity-aware zero-result verification.
- Deterministic replay of the complete mocked lifecycle.
- Rejection of credentials embedded in an endpoint URL.
- Proof that connector outputs do not contain resolved token values.
- Webhook-to-reconciliation boundary test.
- Incomplete authorization fail-closed test.
- Zero-cost-budget test proving mandatory remediation remains present.
- Existing engine, replay, concurrency, fault-injection, tenant, API, and UI regression suites.

## Persistent configuration prepared

The onboarding data model now stores:

- application type and display name;
- API endpoint, without embedded credentials;
- authentication method;
- customer-vault credential reference;
- required permissions;
- monitored scopes;
- AI destination type and non-secret adapter configuration;
- destination secret reference when needed;
- verification identity reference;
- policy version;
- connection and destination status;
- last synchronization and verification timestamps.

Raw BookStack credentials, customer content, embeddings, full permission snapshots, and test-identity secrets are prohibited from control-plane payloads.

## Exact inputs still required

1. **BookStack base URL** — for example `https://bookstack.example.com`, without `/api`, credentials, or query parameters.
2. **Connector service credential** — token ID and token secret for the least-privilege service account described above, delivered through the customer vault/runtime rather than chat, logs, or frontend state.
3. **Destination confirmation** — use the prepared deterministic local index for the first test, or provide vector database endpoint, namespace/index, metadata contract, and vault credential reference.
4. **Test identity** — stable identity reference plus a short-lived API token or authenticated verification mechanism for a normal user.
5. **Controlled test scope** — one shelf/book/chapter/page and confirmation that permission changes are safe to perform there.
6. **Webhook delivery choice** — a BookStack webhook pointing to the enrolled customer runtime, or permission to begin with polling and audit-log reconciliation.

## First real test after connection

1. Probe `/api/system` with the connector service token.
2. Read the selected page and its permission overrides.
3. Read the same page using the test identity and confirm access is initially allowed.
4. Register the page, local-index record, dependency edges, baseline version, and initial proof.
5. Revoke the test identity's access in BookStack.
6. Receive the webhook or detect the change through the audit/reconciliation cursor.
7. Advance the security epoch and confirm Serve Guard blocks the old proof before repair begins.
8. Apply the safely sufficient local-index repair.
9. Query the local index as the test identity and confirm the page is absent.
10. Query BookStack as the same identity and confirm the authoritative boundary also denies access.
11. Record the action receipts, source versions, retrieval observation, authorization observation, and proof hash.
12. Replay the event and confirm idempotence.

## Remaining assumptions and gaps

- Live BookStack payload fields and role behavior must be checked against the exact deployed version at `/api/docs`.
- Webhook delivery is not assumed complete; periodic reconciliation remains mandatory.
- Configured permission overrides do not prove effective authorization.
- One test identity does not prove behavior for every user, role, or inherited permission path.
- The local index validates the lifecycle but not embedding or vector-search semantics.
- Real network, BookStack, database, indexing, and verification latency remain unmeasured.
- Correctness remains conditional on delivered events, registered lineage, safe connector contracts, and mediation by Serve Guard.

## Conservative cleanup report

No existing production file was deleted solely to reduce line count. Safe removal could not be proven for the current UI, simulated research scenarios, deployment-agent flow, or integration platform.

Candidates intentionally left for review after live BookStack validation:

- consolidate the older simulated source connectors with the generic connector contract;
- consolidate the integration-platform canonical event DTO with the engine normalized event DTO;
- retire mock-only presentation paths only after the live BookStack scenario replaces them;
- review generated example directories separately from production code.

Keeping these candidates is safer than deleting them before the first live integration proves which compatibility paths remain necessary.

## Stop condition

The next meaningful blocker is now external. No additional architecture phase should be required once the inputs above are supplied. The next work should be credential enrollment, source probing, baseline registration, and the real revocation test.

## Primary BookStack references

- BookStack API authentication and in-instance documentation: https://www.bookstackapp.com/docs/admin/hacking-bookstack/
- BookStack webhooks: https://www.bookstackapp.com/docs/admin/email-webhooks/
- Current API routes: https://github.com/BookStackApp/BookStack/blob/development/routes/api.php
- Content permission API behavior and `RestrictionsManage` check: https://github.com/BookStackApp/BookStack/blob/development/app/Permissions/ContentPermissionApiController.php
