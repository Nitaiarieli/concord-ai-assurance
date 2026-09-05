# Concord technical research and architecture decisions

Research date: 5 September 2026. This document separates primary-source findings from proposed Concord design. It describes a target architecture and acceptance criteria; it does not certify that every component has been implemented or connected.

## 1. Product boundary

**Proposed focus:** keep the data used by an enterprise assistant or agent consistent with current source permissions, content revisions, and deletion/retention state. Prove the result through the configured destination's retrieval path as an affected identity.

The first useful end-to-end slice is **BookStack → registered derived records → protected local/vector retrieval → permission or deletion change → containment → targeted repair → identity-based verification**. Start with one source and one destination. A connector catalog is not evidence of working integrations. Arbitrary external API connectivity requires a connector contract, credential handling, source semantics, and an acceptance suite for each adapter.

Do not require access to every application's internal code graph. Concord needs a data derivation graph: source object to chunks, embeddings, cached answers, or registered agent memory. Capture these edges through connectors, ingestion instrumentation, and destination adapters. Unregistered derivatives remain outside demonstrated coverage. Removing stored derivatives cannot erase already delivered answers or establish machine unlearning from trained model weights.

## 2. What each requested technology actually does

| Technology | Verified role | Proposed Concord use |
|---|---|---|
| LangChain | Model/tool integration and agent abstractions; its agents are built on LangGraph. | Optional provider and retrieval integration at the boundary. The authorization engine must not depend on an LLM's judgment. |
| LangGraph | Lower-level orchestration with state, persistence, streaming and human interaction. | Optional workflow runner around the same deterministic domain services. Useful for checkpointed repair runs and bounded retries. |
| LangSmith | Framework-agnostic tracing, monitoring and evaluation. | Optional engineering observability with sensitive input/output redaction; separate from Concord's evidence records. |
| Vector database | Vector retrieval plus database-specific record and metadata operations. | Destination adapter that can enumerate by source ID, update ACL metadata, quarantine/delete derivatives, and run filtered retrieval. |
| Agentic AI | An application may call tools and retain derived knowledge across steps. | Protect tool-result caches and explicitly registered agent memory in addition to RAG chunks. An agent must obtain context through the protected retrieval boundary. |
| Lovable / Base44 | Natural-language app development platforms. | Potential development tools, not replacements for the LangGraph runtime or Concord's policy engine. |

Sources: [LangChain overview](https://docs.langchain.com/oss/python/langchain/overview), [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview), [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [LangSmith observability](https://docs.langchain.com/langsmith/observability), [Qdrant filtering](https://qdrant.tech/documentation/search/filtering/), [Lovable introduction](https://docs.lovable.dev/introduction/welcome), [Base44 app building](https://docs.base44.com/Getting-Started/Quick-start-guide).

**Design decision:** LLM calls can explain a completed incident, help map a connector's documentation, or propose a repair plan for review. They cannot decide that a principal has access, mark an unexecuted repair successful, or manufacture a verification result. A local deterministic demonstration should remain usable without paid model keys.

## 3. Supplied video and Google AI Studio link

The supplied [YouTube video](https://www.youtube.com/watch?v=SP-b_G74Nuk) could not be opened directly in this research environment. No video transcript was retrieved and no claim is made that the video was watched. Its creator, Dhaval Patel, links the exact video ID in a public post and describes a Lovable-style application generator using LangGraph, LangChain, GPT-OSS and Groq. That establishes its subject and stack, not the correctness of its code. It is relevant as a learning example of tool-using orchestration; an application generator solves a different problem from Concord's source-to-retrieval assurance. [Creator's description](https://www.linkedin.com/posts/dhavalsays_i-built-lovable-clone-and-published-it-to-activity-7369935165101539328-kwtQ).

The supplied [AI Studio prompt workspace](https://aistudio.google.com/prompts/new_chat) was also not accessible directly. Google's official documentation links to the dedicated [API keys page](https://aistudio.google.com/api-keys). Keep a Gemini credential in server-side configuration or a secret manager, never browser code, repository contents, URL parameters or client localStorage. As of the current documentation, updated 2 September 2026, newly created AI Studio keys use authorization keys and Google describes a September 2026 transition from standard keys; validate the actual project's key type during setup. [Google Gemini API key documentation](https://ai.google.dev/gemini-api/docs/api-key).

## 4. BookStack integration findings that change the design

API calls use the token owner's permissions and require the Access System API permission. The authentication header is `Authorization: Token <token_id>:<token_secret>`. A successful admin-token fetch proves that the connector can read; it does not prove that a different employee can read. The content-permissions endpoint returns local overrides, not complete inherited or evaluated permissions. The audit-log endpoint requires permissions to manage users and system settings. Inspect the target deployment's `/api/docs`, since capabilities depend on its version. [BookStack API documentation](https://demo.bookstackapp.com/api/docs).

BookStack combines multiple roles, supports ownership rules and content overrides, and gives specificity precedence. Book and chapter restrictions can cascade to their children; shelf restrictions do not automatically cascade to books. The default admin role retains access. These semantics invalidate a naive implementation that simply copies a shelf ACL to every descendant or tests with an admin account. [BookStack roles and permissions](https://www.bookstackapp.com/docs/user/roles-and-permissions/).

**Proposed integration behavior:** retain source-native ACL snapshots and identify which semantics the adapter can evaluate. Prefer an authorized source read using the actual test identity, or a validated source-specific evaluator with sufficient role/membership/ancestor inputs. An unreadable object is not automatically proven deleted. Missing permissions, unavailable identity credentials, API failure or incomplete ancestry must produce `unknown`, with affected retrieval contained according to the configured policy.

## 5. Python architecture

Use a modular monolith first. Separate a domain core, application services, typed ports, infrastructure adapters, and HTTP delivery. FastAPI supports splitting routes with `APIRouter` and sharing dependencies; this is an implementation mechanism, not a reason to place business rules in route functions. [FastAPI bigger applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/).

| Module | Responsibility |
|---|---|
| `domain/` | Source objects, revisions, lineage edges, policy decisions, incident state machine and invariants; no network or framework imports. |
| `application/` | Observe change, contain lineage, plan/apply repair, query protected context, verify outcome and export evidence. |
| `ports/` | Python protocols for source readers, identity authorization, destination operations, repositories, clock and telemetry. |
| `adapters/` | BookStack HTTP client; local/vector store; SQLite/PostgreSQL repository; optional Gemini/LangChain and LangSmith clients. |
| `api/` | Pydantic request/response contracts, authentication dependencies, routes, status codes and redacted error mapping. |
| `workflows/` | Optional LangGraph graph that calls application services and checkpoints run IDs. |
| `tests/` | Domain invariants, connector contracts, and end-to-end retrieval/repair acceptance scenarios. |

Suggested ports: `SourceConnector.get_snapshot`, `SourceConnector.read_changes`, `AuthorizationPort.can_read`, `LineageRepository.descendants`, `DestinationAdapter.quarantine`, `DestinationAdapter.apply`, `DestinationAdapter.enumerate_by_source`, `DestinationAdapter.retrieve`, and `EvidenceRepository.append`.

Every source snapshot should include source ID, connection ID, tenant ID, source revision, content digest, native permission evidence, evaluation completeness and observation time. Every derivative should include stable ID, destination ID, parents, source revision, policy revision, derivation type, and lifecycle state. A cached summary derived from multiple parents must retain all contributing source references.

The vector database stores search representations; a relational store should retain canonical incidents, identity mapping, policy versions, lineage and evidence. Qdrant supports conjunctions and other payload filter operations, but Concord must construct tenant and authorization filters from trusted server-side state. Metadata filtering alone does not keep stale ACLs current. [Qdrant filtering](https://qdrant.tech/documentation/search/filtering/).

## 6. Ten practical architecture principles

These are explicit engineering choices for this product, not an objective ranking of the ten strongest rules in the world.

1. **Give each module one clear responsibility.** HTTP parsing, source authorization semantics, lineage traversal and destination writes have separate owners.
2. **Make dependencies point toward the domain.** Frameworks and vendors implement typed ports; replacing a vector database does not rewrite policy rules.
3. **Keep safety decisions deterministic.** Source authorization, revision checks and state transitions are explicit code. AI output is untrusted explanatory input.
4. **Use typed, versioned contracts.** Validate requests and provider payloads at the boundary; distinguish absent, denied and unknown values.
5. **Make authorization and tenant scope mandatory.** Derive production identity from validated authentication, enforce scope on every read/write, and keep secrets server-side.
6. **Make work idempotent and revision-aware.** Deduplicate events, attach operation keys, and reject stale repair completion against a newer policy epoch.
7. **Model partial failure explicitly.** Persist progress, retry bounded operations with backoff, and retain containment when a destination or source is unavailable.
8. **Record explainable evidence.** Preserve inputs, source/policy revisions, operation receipts and actual probe outcomes with correlation IDs. A digest is an integrity aid, not an audit certification.
9. **Test observable contracts and invariants.** Prove revoked retrieval is blocked while legitimate access survives; cover race conditions, isolation and replay.
10. **Keep the first system small and replaceable.** Start with one source and destination, documented configuration and pinned dependencies; add abstractions when an adapter needs them.

## 7. Deterministic incident lifecycle

| State | Required condition | Next behavior |
|---|---|---|
| `observed` | Authenticated source observation persisted with revision and scope. | Determine affected registered lineage and immediately contain risky retrieval. |
| `contained` | Retrieval boundary denies the affected scope while uncertainty remains. | Build an explicit repair plan for the current policy epoch. |
| `planned` | Actions, target IDs, source revision and expected policy revision are recorded. | Apply idempotent destination operations. |
| `applying` | Destination writes are executing or awaiting receipt. | Read back changed state; failed steps retain containment. |
| `verifying` | All required writes acknowledged. | Execute identity and coverage probes through the protected destination path. |
| `verified` | Required probes pass and source/policy epoch is still current. | Release only access that remains authorized; preserve the evidence record. |
| `blocked` | Source authority, connector capabilities or identity proof is missing. | Explain the missing input; do not silently turn unknown into allowed. |
| `failed` | Repair or verification failed. | Keep containment and expose a bounded retry path. |

An incoming newer change invalidates any older run's right to release containment. Use a transaction or compare-and-swap on the relevant policy epoch before closing a run. A broad reindex can be a recovery action; selective repair should operate on explicit affected IDs.

## 8. Suggested API contracts

These are design examples; implementation endpoint names may differ.

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/connections` | Register connector type, server-approved endpoint and credential reference; return discovered capabilities and status. |
| `POST /api/v1/connections/{id}/sync` | Start bounded source observation with a cursor; return run ID. |
| `GET /api/v1/incidents/{id}` | Return affected source, observed change, destination scope, current state and evidence status. |
| `POST /api/v1/incidents/{id}/repair` | Apply an explicit plan using an idempotency key and expected policy revision. |
| `POST /api/v1/incidents/{id}/verify` | Run configured identity probes; return actual results or `blocked`. |
| `POST /api/v1/retrieve` | Retrieve context using the authenticated principal and tenant, not a caller-supplied identity. |
| `GET /api/v1/evidence/{id}` | Return evidence with provenance, observations, limitations and probe outcomes. |

Example source event:

```json
{
  "schema_version": "1",
  "event_id": "evt_001",
  "connection_id": "bookstack_pilot",
  "source_id": "page:42",
  "kind": "permissions_changed",
  "source_revision": "opaque-source-revision",
  "observed_at": "2026-09-05T10:00:00Z",
  "evidence_ref": "source_observation_001"
}
```

Example verification result:

```json
{
  "run_id": "run_001",
  "mode": "demo",
  "status": "passed",
  "policy_revision": 7,
  "checks": [
    {"name": "revoked_identity_retrieval", "expected": "deny", "actual": "deny"},
    {"name": "authorized_identity_retrieval", "expected": "allow_current", "actual": "allow_current"}
  ],
  "coverage": {"registered_derivatives": 4, "checked_derivatives": 4},
  "limitations": ["Synthetic source and local destination; no live BookStack identity tested"]
}
```

In production, tenant and principal come from validated authentication; event origin comes from an authenticated connector path. A public demo may select synthetic identities through explicitly isolated demo endpoints. Do not reuse that identity override in production routes. Connection endpoints need outbound URL policy and redirect handling so an arbitrary URL does not become an internal-network fetch capability.

## 9. Acceptance scenarios

| Scenario | Required observable result |
|---|---|
| Permission revoked after indexing | Affected identity cannot retrieve registered descendants, including cached context. Authorized control identity still receives current permitted context. |
| Content revision changes | Old revision is withheld, affected derivatives are rebuilt, and result cites the new source revision. |
| Source deletion confirmed | Registered derivatives are tombstoned/deleted according to policy; direct enumeration and retrieval verify the outcome. |
| Source becomes inaccessible to connector | Status is unknown/blocked; no false deletion claim or successful identity proof. |
| Source or destination outage | Bounded retries; containment remains; incident does not turn green. |
| Duplicate or reordered events | No duplicate destructive effects; stale events do not roll back a newer source/policy state. |
| Change occurs during repair | Older run cannot release newer containment. |
| Membership or inherited ACL changes | Adapter either proves source-specific effective access or reports unsupported/incomplete evaluation. |
| Cross-tenant attempt | No returned objects, metadata, evidence or repair target from another tenant. |
| Multiple-source summary | Revoking one contributing source invalidates the dependent summary even if other parents remain accessible. |
| Partial destination coverage | Evidence states what was checked; partial coverage cannot be presented as universal assurance. |
| No model credentials | Deterministic local demonstration works; optional explanation reports unavailable instead of fabricated AI output. |

Use both destination enumeration by source/derivative IDs and identity retrieval probes. A semantic query returning no hits alone does not prove absence. Validate the same protected path the actual assistant uses; a database-admin listing alone does not prove the user's outcome.

## 10. Honest rollout status

Use distinct interface labels: **Demo**, **Configured**, **Connection tested**, and **Live verified**. A credential form is not an integration. A connectivity check is not effective-permission proof. A passing local fixture is not a live customer result.

Keep model traces separate from proof: LangSmith supports hiding or transforming inputs/outputs before transmission, and explicit redaction should be configured if enabled. It should default off in a demonstration unless a server-side deployment is configured. [LangSmith trace privacy controls](https://docs.langchain.com/langsmith/mask-inputs-outputs).

The live pilot still needs a BookStack endpoint, least-privilege connector credentials with explicitly assessed capabilities, a controlled AI destination, and an authorized test identity. The product claim becomes stronger only when the end-to-end revocation and authorized-control scenarios pass against those real systems.
