# Concord

**Keep your AI agents’ data up to date.**

This is the September 2026 Concord platform: the stone-and-plant workspace, Python engine, local API, tests, original artwork, and implementation/research documentation.

**Current status:** working sample-data prototype. The UI runs Python inside the browser. Starting the separate Python API does not connect the UI to it. Live customer integrations and willingness to pay remain unverified.

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

## What a teammate should see

1. Overview with the agent-data freshness headline and sample-data disclosure.
2. Start the permission-change sample case; open Change review.
3. Apply the repair. Verification is still pending.
4. Verify: Alex loses access, Jordan retains access, and Alex’s unrelated document stays available.
5. Inspect Evidence and export the scoped sample JSON record.
6. Reset, then run the unavailable-probe case: an unknown result must not become a verification pass.

The four scenarios cover permission changes, content updates, deletion and an unavailable probe. These are local fixtures, not proof that external customer systems were updated.

## Commands (inside this folder)

| Command | Purpose |
|---|---|
| `npm ci` | Install the exact JavaScript dependency lockfile |
| `npm run prepare:python` | Copy pinned Pyodide and rebuild browser/source Python ZIPs and baseline |
| `npm run dev:local` | Run the UI on loopback with a portable local command |
| `npm run build:local` | Compile the Worker/frontend without Linux-only wrappers |
| `npm run test:python` | Run the 21 CPython acceptance tests |
| `npm run test:wasm` | Run the four fixture scenarios using the bundled Python WebAssembly runtime |
| `npm run build` | Existing Linux Sites build with bounded execution |

`npm run install:ci`, `npm run build`, and `scripts/sites-env.sh` are retained Sites/Linux tooling. Use the local commands above on teammates’ computers. Run preparation again after Python source changes.

## Folder map

| Path | Contents / owner |
|---|---|
| `app/` | Page, layout, metadata and global styles |
| `components/concord/` | Overview, change review, coverage and evidence UX |
| `components/ui/`, `hooks/`, `lib/utils.ts` | Shared UI components and helpers |
| `backend/concord/domain/` | Models, graph rules and invariants |
| `backend/concord/application/` | Deterministic workflow and interfaces |
| `backend/concord/adapters/` | Local destination, persistence and external transport boundaries |
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

Source snapshot: published Site commit `ae2b903d0e8e66ae9ca0faf5434b3fc16732752e`, followed by developer-onboarding documentation and preparation-command improvements. No production integration has been added by this handoff.
