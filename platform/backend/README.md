# Concord Python — automatic local runtime

The current runtime automatically watches a configured filesystem or complete-snapshot API, maintains a durable SQLite lexical index/cache, verifies registered retrieval, and serves an authenticated local console/API.

Python 3.11+; Linux, macOS or WSL for filesystem sources. From this extracted package directory, no installation is required:

```bash
python -m concord.runtime init --directory ./concord-local
python -m concord.runtime run --config ./concord-local/runtime.json
```

Open the printed localhost URL. Edit the initialized source JSON in your own editor; no per-change Concord action is needed. Generated operator and consumer credentials stay in `credentials.local.json`; use a trusted editor to view them, and do not commit/share them. Each employee should initialize their own workspace.

The public website is a separate sample browser demonstration. This local runtime is single-tenant and loopback-only. Filesystem and local HTTP acceptance are tested; BookStack transport is prepared but has no live vendor validation or effective-ACL discovery. No external vector database or customer agent memory is connected.

For complete source contracts, deployment, API, recovery and limits, read the runtime guide downloaded beside this package or the repository's `docs/local-runtime.md`. Optional editable installation: `python -m pip install -e .`; it includes the operational console as package data.

## Historical sandbox implementation

The material below describes the older manually driven lab at `/lab` and `concord.api`. It is retained for compatibility and test history. Use `concord.runtime` above for automatic operation. Its legacy limitations do not describe the newly implemented runtime.

# Concord Python reference MVP

A working, deterministic assurance engine for **registered** AI derivatives. The hosted website executes this exact engine using a self-hosted Pyodide runtime in a browser worker. This package runs the same engine under CPython and exposes an independent local HTTP API.

## Run without installing dependencies

Requires Python 3.11 or newer. From this directory:

```bash
python3 -m unittest discover -s tests -v
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
```

Set `CONCORD_API_TOKEN` in your shell to the generated value, then:

```bash
python3 -m concord.api.server --port 8080 --database concord-demo.sqlite3
```

The server binds **127.0.0.1 only**. Every API route except `/healthz` requires `Authorization: Bearer <your token>`. Do not commit tokens. It uses a single request thread and atomic SQLite snapshots. State survives API restarts. This is an isolated sandbox API, not production authentication or a multi-tenant service.

## Run a complete API scenario

Use an HTTP client with your bearer header and `Content-Type: application/json`.

| Method and path | Request / behavior |
|---|---|
| `GET /healthz` | Readiness and explicit sandbox mode |
| `GET /v1/sandbox/snapshot` | Registered nodes, incidents, minimized proofs and counts |
| `POST /v1/sandbox/commands` | Typed command from the examples below |
| `GET /v1/connectors` | Configuration/readiness boundaries |
| `GET /v1/connectors/bookstack/pages/42` | Optional service-account page/overrides fetch; never effective identity proof |

Send the following commands in order; copy the actual returned event ID into subsequent commands.

```json
{"action":"detect","source_id":"src-forecast","kind":"permission","identity":"alex","key":"my-first-unique-request"}
```

```json
{"action":"repair","event_id":"chg-0001"}
```

```json
{"action":"verify","event_id":"chg-0001"}
```

```json
{"action":"probe","artifact_id":"memory-forecast","identity":"alex"}
```

Allowed scenarios: `permission`, `content`, `deletion`, `probe_failure`. Use `{"action":"reset"}` to clear the API sandbox. UI session and API server session are independent. The UI does not point at this API automatically.

The API's `alex` and `jordan` fields identify **synthetic test identities only**. A production identity must come from a validated token/delegation, not a caller-controlled field. The bearer token authenticates the local sandbox operator, not those employees.

## What is implemented

- Explicit source/derivative DAG with cycle checks, known authority, revision stamps, containment epochs and registered scope.
- Detect and contain; selective local-index repair; independent readback; positive/negative destination probes; protected retrieval probes; an unrelated positive control.
- Unknown authority and failed or unavailable probes remain unverified and blocked.
- Stale or overlapping earlier events cannot release newer containment.
- Idempotent change requests and current-state integrity checks at retrieval.
- Content-minimized SHA-256 chained proof records; **not externally signed**.
- Dependency-free HTTP delivery and durable SQLite state for one local process.
- BookStack read-only client and Qdrant HTTP adapter with fake-transport contract tests.

## Integration readiness

The BookStack client requires `BOOKSTACK_URL`, `BOOKSTACK_TOKEN_ID` and `BOOKSTACK_TOKEN_SECRET`. It retrieves the page and that page's permission overrides. **Effective permissions remain unknown**: book/chapter inheritance, role combinations, ownership and actual identity credentials must be validated in your instance. An API error does not prove deletion. The service account cannot impersonate the affected user by changing a string.

`QdrantAdapter` includes tenant-scoped UUIDs, upsert, readback, delete and an explicit allowed-artifact filter. It is an **untested live transport adapter**, not a drop-in verified destination: an embedding producer, source-to-vector mapping, destination port implementation and real identity-retrieval contract are still needed. Do not expose Qdrant directly to untrusted clients.

The optional `langgraph_workflow.py` composes repair and verify with an injected checkpointer. The engine repository must be durable as well. The optional `gemini.py` uses LangChain's Gemini integration to explain minimized measured facts. No model participates in authorization or proof. Optional dependency ranges are not a tested lockfile; these integrations were reviewed against documentation but were not installed or run in this environment.

## Architecture

- `domain/`: explicit models and graph invariants, no networking.
- `application/`: deterministic workflow and typed destination/source protocols.
- `adapters/`: local index, SQLite, HTTP, BookStack, Qdrant, optional model/orchestration.
- `api/`: bounded requests, operator authentication, errors and composition.
- `demo.py`: isolated synthetic fixture composition; never a live connector.
- `tests/`: failure-oriented engine, contract, persistence and HTTP acceptance tests.

## Boundaries before a customer deployment

This is a reference MVP, not a production security service. The browser version deliberately contains only synthetic data and resets on reload. No live BookStack/Qdrant/Gemini integration has been verified. No webhook receiver, autonomous polling, real role resolver, tenant authentication, worker queue, distributed transaction, independently anchored proof store, retention scheduler, enterprise billing or production monitoring is implemented.

The first real pilot requires the BookStack endpoint, dedicated permissions/token, chosen first AI destination and an affected test identity. Deploy an authenticated customer runtime, integrate the actual retrieval boundary, enumerate/register derivatives, validate source authorization semantics, then repeat revocation/deletion/stale-event/failure tests. Keep source content and credentials in that runtime; only minimized results may leave it.

The source graph describes **data derivation**, not each application's internal code graph. We cannot erase already delivered answers, cover unknown copies or claim machine unlearning.

## Environment setup

`.env.example` documents supported variables; this standard-library server does not automatically load `.env` files. Export variables in your shell before startup. See `../docs/developer-setup.md` for POSIX and PowerShell examples. No pip dependencies are required for this core API.
