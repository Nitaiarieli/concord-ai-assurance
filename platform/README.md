# Concord

**Keep your AI agents’ data up to date.**

This is the September 2026 Concord platform: the stone-and-plant workspace, Python engine, local API, tests, original artwork, and implementation/research documentation.

**Current status (v5):** an interactive **Atlassian-first product mockup** plus a separately runnable Python backend. The main website uses illustrative data and performs no OAuth or live source connections. The backend scans real supported files/folders and implements Confluence Cloud, Jira Cloud, generic JSON snapshot and BookStack API adapters. API adapters have local HTTP contract tests, not live vendor validation. Automatic updates currently reach the runtime's own durable SQLite lexical index and registered cache; external customer RAG/VectorDB routes still require adapters.

Start with [the Atlassian MVP and setup guide](docs/atlassian-mvp.md). The deployment concept takes inspiration from Harmony.io's customer-side outbound proxy; Concord's managed cloud enrollment/tunnel is not implemented.

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

1. **Overview** illustrates organizational apps feeding the data used by agents.
2. **Applications** starts with Confluence and Jira Cloud. Choose example spaces/projects once; saving changes only the current mockup session and resets on refresh.
3. **Sync activity** explains a content update, issue update and a record that is no longer API-visible. No manual per-change selector or repair button exists here.
4. **Deployment** separates the proposed customer-worker/cloud model from the currently downloadable local backend.
5. **Show example response** displays a labeled illustrative answer, with no model call.

The previous automatic Python browser demonstration is retained at `/runtime-lab`; its sample SQLite state resets on reload. The older manual lab remains at `/lab`. Neither is a live customer connection. The real local runtime has its own authenticated console.

## Commands (inside this folder)

| Command | Purpose |
|---|---|
| `npm ci` | Install the exact JavaScript dependency lockfile |
| `npm run prepare:python` | Copy pinned Pyodide and rebuild browser/source Python ZIPs and baseline |
| `npm run dev:local` | Run the UI on loopback with a portable local command |
| `npm run build:local` | Compile the Worker/frontend without Linux-only wrappers |
| `npm run test:python` | Run the 129 CPython behavior/transport/HTTP tests |
| `npm run test:console` | Verify the shipped console against the actual HTTP envelope |
| `npm run test:wasm` | Run legacy scenarios and automatic-source/update/retrieval parity in WebAssembly |
| `npm run build` | Existing Linux Sites build with bounded execution |

`npm run install:ci`, `npm run build`, and `scripts/sites-env.sh` are retained Sites/Linux tooling. Use the local commands above on teammates’ computers. Run preparation again after Python source changes.

## Folder map

| Path | Contents / owner |
|---|---|
| `app/` | Page, layout, metadata and global styles |
| `components/concord/` | Enterprise application mockup; retained runtime and historical labs |
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

The deployed product mockup is [Concord](https://concord-renewal.nitai-arieli1.chatgpt.site). GitHub is the team handoff; pushing here does not automatically update that site. The existing `.openai/hosting.json` identifies the owner’s Site and is not a credential. Local setup does not require access to it. Do not deploy against that identity without the project owner’s authorization.

Release v5 adds the Atlassian-first mockup, API adapters, bounded file extractors and non-authoritative disappearance handling. See [v5 decisions, validation and rollback](docs/release-v5.md). Earlier research and release records are historical; v5 is the current implementation scope.
