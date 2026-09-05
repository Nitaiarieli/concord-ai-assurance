# Concord

**Keep your AI agents’ data up to date.**

This is the September 2026 Concord platform: the stone-and-plant workspace, Python engine, local API, tests, original artwork, and implementation/research documentation.

**Current status:** working automatic local runtime plus a browser demonstration. The installable Python process watches real local files or a supported complete-snapshot API and updates a durable SQLite lexical index and registered cache. The public UI runs the same core on sample data; the local runtime has its own authenticated operational console. Customer enterprise integrations and willingness to pay remain unverified.

The GitHub handoff is on `chore/concord-platform-handoff` pending review into `main`. Clone that branch until the PR is merged.

## Start here

From a clone of `Nitaiarieli/concord-ai-assurance`:

```bash
cd platform
npm ci
npm run prepare:python
npm run dev:local
```

Open the localhost URL printed by Vite (normally `http://localhost:5173`). When working from a standalone copy of this folder, omit `cd platform`.

Requirements: Git, Node.js 24 LTS with npm, Python 3.11+. The lockfile requires at least Node 22.13. Linux is verified; macOS and native Windows instructions are provided but have not been executed here. Windows users can use WSL2/Ubuntu for the Linux path.

**No API keys, cloud account, BookStack instance, vector database or paid model are needed to run the demo.**

- [Autonomous operation: product and engineering decision](docs/autonomous-data-sync.md)
- [Full developer setup and troubleshooting](docs/developer-setup.md)
- [התחלה מהירה בעברית](docs/start-here.he.md)
- [Python API and commands](backend/README.md)
- [Code architecture](docs/concord-architecture.md)
- [Artwork inventory and source images](docs/assets.md)
- [Contribution workflow](CONTRIBUTING.md)

## Run automatic synchronization on your files

From `platform/backend` (or `backend` in a standalone checkout), with Python 3.11+ on Linux, macOS or WSL:

```bash
python -m concord.runtime init --directory ../../concord-local
python -m concord.runtime run --config ../../concord-local/runtime.json
```

Open the printed loopback console. View status with the generated local operator credential; search with a consumer credential bound to an identity and route. Edit `concord-local/source/product-policy.json` using your own editor. The observer updates the registered index/cache and verifies both local retrieval implementations automatically. No manual change selector or repair action exists in the runtime API.

Read [runtime setup, API and coverage](docs/local-runtime.md), [v4 decisions, architecture and rollback](docs/release-v4.md), and [current market evidence](docs/product-market-decision-v4.md).

## What a teammate should see in the browser

1. Overview shows automatic observer health, discovered documents and registered coverage.
2. Open **Sample source application**, edit product content and save in that source.
3. The independent timer discovers the change and updates/verifies data automatically.
4. **Search sample data** optionally inspects the direct or cached result. It is not the verification trigger.
5. Test unknown ACL, unsupported schema or source outage; affected reads stay blocked until a successful reconciliation.
6. Connections states implemented vs prepared/unconnected integrations; Install downloads the actual local runtime.

The browser contains sample identities/data only. Its SQLite state lives in the browser worker and resets on reload. The older manual demonstration remains at `/lab` as a historical lab, not the production operating model.

## Commands (inside this folder)

| Command | Purpose |
|---|---|
| `npm ci` | Install the exact JavaScript dependency lockfile |
| `npm run prepare:python` | Copy pinned Pyodide and rebuild browser/source Python ZIPs and baseline |
| `npm run dev:local` | Run the UI on loopback with a portable local command |
| `npm run build:local` | Compile the Worker/frontend without Linux-only wrappers |
| `npm run test:python` | Run the 82 CPython behavior/transport/HTTP tests |
| `npm run test:wasm` | Run legacy scenarios and automatic-source/update/retrieval parity in WebAssembly |
| `npm run build` | Existing Linux Sites build with bounded execution |

`npm run install:ci`, `npm run build`, and `scripts/sites-env.sh` are retained Sites/Linux tooling. Use the local commands above on teammates’ computers. Run preparation again after Python source changes.

## Folder map

| Path | Contents / owner |
|---|---|
| `app/` | Page, layout, metadata and global styles |
| `components/concord/` | Automatic overview, connections, evidence and install UX; historical lab |
| `components/ui/`, `hooks/`, `lib/utils.ts` | Shared UI components and helpers |
| `backend/concord/domain/` | Models, graph rules and invariants |
| `backend/concord/application/` | Deterministic workflow and interfaces |
| `backend/concord/adapters/` | Local destination, persistence and external transport boundaries |
| `backend/concord/runtime/` | Automatic observer, source adapters, durable index/cache, CLI and authenticated console |
| `backend/concord/api/` | Independent, loopback-only Python sandbox API |
| `backend/tests/` | Engine, API, persistence and adapter contract tests |
| `lib/concord/`, `public/python-worker.mjs` | Browser-to-Python bridge and initial fixture |
| `public/assets/` | Optimized website images plus original hero PNG |
| `design/source-images/` | Three additional original generated PNGs |
| `scripts/` | Reproducible preparation and validation commands |
| `docs/` | Setup, architecture, evidence, research and release records |
| `worker/`, `build/`, `.openai/` | Existing Sites/Cloudflare deployment integration |
| `db/`, `drizzle/`, `examples/d1/` | Retained scaffold; no database binding is enabled in this demo |

Dependencies are represented by `package-lock.json` and `backend/pyproject.toml`. `node_modules`, Python virtual environments, generated runtime files, local SQLite state and secrets do not belong in source control. `npm ci` and `npm run prepare:python` restore the runtime libraries.

## Coverage and deployment

The engine acts on explicitly registered derivatives. It cannot discover or erase unknown copies, invalidate already-delivered answers, or unlearn model weights. BookStack and Qdrant are transport boundaries with synthetic contract tests; they are not turnkey live connectors. Optional LangChain, LangGraph and Gemini examples are not required or live-verified.

The deployed demonstration is [Concord](https://concord-renewal.nitai-arieli1.chatgpt.site). GitHub is the team handoff; pushing here does not automatically update that site. The existing `.openai/hosting.json` identifies the owner’s Site and is not a credential. Local setup does not require access to it. Do not deploy against that identity without the project owner’s authorization.

Release v4 adds the real automatic local runtime and workspace. The old Site source `ae2b903d0e8e66ae9ca0faf5434b3fc16732752e` is retained as rollback reference; see `docs/release-v4.md`.
