# Concord — developer handoff

**The current September 2026 platform is in [`platform/`](platform/). Start there.**

This handoff is published on `chore/concord-platform-handoff`, pending review into `main`. The command below checks out the working branch. After merge, a regular main-branch clone will also contain `platform/`.

It contains the Python engine, stone-and-plant UI, tests, original PNG artwork, optimized website images, dependency manifests, and developer documentation.

```bash
git clone --branch chore/concord-platform-handoff https://github.com/Nitaiarieli/concord-ai-assurance.git
cd concord-ai-assurance/platform
npm ci
npm run prepare:python
npm run dev:local
```

Install Node.js 24 LTS and Python 3.11+ first. Open the localhost URL printed by Vite. The sample-data demo needs no API key or cloud account.

- [Autonomous operation: corrected product/engineering decision](platform/docs/autonomous-data-sync.md)
- [Platform README and folder map](platform/README.md)
- [Complete setup / Windows and macOS notes](platform/docs/developer-setup.md)
- [התחלה מהירה בעברית](platform/docs/start-here.he.md)
- [Python API](platform/backend/README.md)
- [Original artwork inventory](platform/docs/assets.md)
- [Contribution guide](platform/CONTRIBUTING.md)

The browser UI and standalone Python API have independent sample sessions. Live customer integrations are not yet verified. See the platform README for exact coverage.

The earlier application remains at the repository root for continuity. Its code and documentation below describe that previous version; use `platform/` for the newly published experience. This handoff does not change the production site or activate automatic deployment.

<details>
<summary>Previous implementation README (retained for reference)</summary>

# Concord AI Assurance

Concord is an independent assurance and reconciliation plane for registered
AI-derived state. When access or authoritative information changes, Concord
detects the event, traces affected registered artifacts, calculates a bounded
repair, reads back the destination, tests the real retrieval path, and
preserves evidence and unresolved exceptions.

This repository contains the current design-partner implementation, including:

- the public Concord product experience and commercial routes;
- the assurance control surface and deterministic consistency engine;
- the BookStack integration boundary and local-index destination fixture;
- tenant-scoped APIs, D1 schema and migrations;
- pricing, billing, FinOps, deployment, and coverage experiences;
- research, architecture notes, benchmark evidence, and automated tests.

The current implementation is suitable for controlled design-partner staging.
Real connector credentials, customer-hosted runtime validation, recovery
testing, and identity-aware end-to-end retrieval proof remain production gates.

## Local development

Prerequisites:

- Node.js `>=22.13.0`
- npm
- Git

Install and validate:

```bash
npm ci
npm test
npm run lint
```

Start the local development environment:

```bash
npm run dev
```

## 21st MCP for local Codex

The repository includes a safe project-scoped `.codex/config.toml`. It connects
Codex to the remote 21st MCP server but never stores the API key in Git.

Create a fresh 21st API key and store it in the local environment as
`API_KEY_21ST`. On Windows PowerShell:

```powershell
[Environment]::SetEnvironmentVariable(
  "API_KEY_21ST",
  "<NEW_API_KEY>",
  "User"
)
```

Restart Codex, trust this repository when prompted, and use `/mcp` or
`codex mcp list` to verify that the `21st` server is available.

Never commit API keys, customer credentials, raw content, tokens, or local
environment files. `.env*`, generated builds, runtime directories, and local
dependencies are excluded by `.gitignore`.

## Technology

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build and verify the rendered development-preview metadata
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

</details>

