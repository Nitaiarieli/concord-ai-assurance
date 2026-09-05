# Developer setup

Run commands in the `platform/` directory of the GitHub repository unless a section explicitly says otherwise. This folder is self-contained and can also be used on its own.

## 1. Install prerequisites

- Git.
- Node.js **24 LTS** and npm. `.nvmrc` selects major 24; the package minimum is 22.13.0. The existing dependency lockfile is authoritative.
- Python **3.11 or newer**. The core and local API use the standard library only.
- Internet access to the npm registry for the first dependency install. Runtime assets are then served locally.

Linux was tested with Node 24.19.0 and Python 3.12.13. macOS and native Windows were not exercised in this environment. The local scripts avoid Bash environment assignments and GNU timeout; Windows developers can use WSL2/Ubuntu for the verified Linux command path.

## 2. Clone, install and launch the browser demo

```bash
git clone https://github.com/Nitaiarieli/concord-ai-assurance.git
cd concord-ai-assurance/platform
npm ci
npm run prepare:python
npm run dev:local
```

Open the URL printed by Vite, normally `http://localhost:5173`. If that port is in use, use the actual printed port. To request another explicitly: `npm run dev:local -- --port 5174`.

In WSL2, install Node and Python inside WSL and keep the clone in the Linux filesystem. Run the same commands in its Ubuntu terminal. Use the localhost address in your Windows browser.

The preparation script tries Python 3.11+ through `python3`, `python`, then Windows `py -3`. To choose a specific executable:

```bash
export CONCORD_PYTHON=/absolute/path/to/python3
npm run prepare:python
```

PowerShell equivalent:

```powershell
$env:CONCORD_PYTHON = 'C:\Path\To\python.exe'
npm run prepare:python
```

An activated virtual environment is also supported. No Python pip install is needed for the browser core or tests. Optional agent packages in `backend/pyproject.toml` are outside this setup path and have not been validated as a locked integration.

### Expected runtime boundary

| Process | Data and persistence |
|---|---|
| Vite + React UI | Presents the workspace and serves local assets |
| Browser Web Worker + Pyodide | Runs `backend/concord`’s packaged fixture engine; reload creates a fresh sample session |
| Optional Python HTTP API | Independent sample session persisted in the chosen SQLite file |

Starting the Python API does not switch the UI to server mode. There is no environment variable that currently makes it a live customer UI. Synthetic identity names in commands are not real employee authentication.

## 3. Verify the installation

```bash
npm run test:python
npm run test:wasm
npm run build:local
```

Expected: 21 CPython tests pass; the WebAssembly harness runs four scenarios. Permission/content/deletion should verify; `probe_failure` deliberately remains unverified (11/12 measured checks), and that failure behavior is the expected test outcome.

The existing `npm test` additionally invokes the Linux build wrapper and scaffold UI tests. The current whole-project `tsc --noEmit` has pre-existing Cloudflare ambient-type gaps (`cloudflare:workers`, `Fetcher`, `D1Database`); a successful build does not claim that separate type-check command passed. Mobile visual behavior was not verified here.

## 4. Run the independent local Python API (optional)

From `platform/backend` on Linux/macOS/WSL:

```bash
export CONCORD_API_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
python3 -m concord.api.server --port 8080 --database concord-demo.sqlite3
```

From `platform/backend` in PowerShell, with the Python launcher installed:

```powershell
$env:CONCORD_API_TOKEN = py -3 -c "import secrets; print(secrets.token_urlsafe(32))"
py -3 -m concord.api.server --port 8080 --database concord-demo.sqlite3
```

The server binds `127.0.0.1:8080`. Visit `http://127.0.0.1:8080/healthz` for an unauthenticated health check. All other endpoints need `Authorization: Bearer <token>`. See [the API command examples](../backend/README.md).

**`backend/.env.example` is a variable reference, not an auto-loaded configuration file.** Set variables in your shell or approved process manager. The token must contain at least 24 characters. Do not put it in the UI, a URL, Git, a screenshot or a support log.

SQLite state persists across API restarts. The `reset` sandbox command changes that local fixture; it does not affect the browser’s separate session. Stop with Ctrl+C. Keep database files local and ignored.

## 5. Change code or assets

- UI: edit `components/concord/` and `app/globals.css`.
- Engine: edit `backend/concord/`, run the Python tests, then rerun `npm run prepare:python` before refreshing the browser.
- Artwork: keep original PNGs in `design/source-images/` (the original hero is in `public/assets/`); export website WebP variants into `public/assets/`. Update [the inventory](assets.md).
- Dependencies: update manifests and their lockfile deliberately; do not commit downloaded `node_modules`.
- New connectors: implement the application interfaces and test failure/authorization semantics before labeling anything live-verified.

## Troubleshooting

| Symptom | Action |
|---|---|
| Python or wasm file returns 404 | Run `npm run prepare:python` from `platform/`; restart the local server |
| `python3` unavailable | Install Python 3.11+ or set `CONCORD_PYTHON`; use WSL2 if native dependencies fail |
| `timeout`, `flock` or shell assignment error | Use `npm run build:local` and `npm run dev:local`; the original Sites wrappers target Linux |
| Node engine warning | Switch to Node 24, remove only local `node_modules`, then `npm ci` |
| Python changes absent from UI | Rebuild Python assets, then reload to create a fresh sample session |
| API refuses startup | Export a 24+ character `CONCORD_API_TOKEN`; `.env` is not loaded automatically |
| UI and API show different events | Expected: they are separate sandbox sessions |
| API port occupied | Pass a different `--port`; do not stop another developer’s process |
| BookStack credentials do not produce end-to-end proof | Transport access is not effective-identity verification; see the integration boundary docs |

## Deployment ownership

`npm run build:local` compiles the frontend and Cloudflare Worker; it is not a generic Python web-server build. The Python API is a separate process. D1 and R2 bindings are disabled in this demo. The retained ChatGPT-auth helper trusts the Sites dispatch boundary and is not a standalone authentication system for another host.

No auto-deploy workflow is added by this handoff. The production Site remains the separately published version. Coordinate Site publication with its owner; external hosting needs an explicit deployment and identity design.
