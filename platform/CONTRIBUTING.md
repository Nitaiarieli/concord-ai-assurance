# Contributing to Concord

The current application is `platform/` in the GitHub repository. Earlier root-level code is retained for reference and is not part of this platform’s local build.

While the developer-handoff PR is pending, branch from `chore/concord-platform-handoff`. After it is merged, use `main` as described below.

1. Pull `main` and create a short feature branch.
2. Work inside `platform/`; keep changes focused on one user outcome or engine behavior.
3. If Python changes, run `npm run test:python`, then `npm run prepare:python` and `npm run test:wasm`.
4. For UI/build changes, run `npm run build:local`; manually inspect the affected local flow, including an error state.
5. Open a PR explaining the problem, resulting behavior, verification and limits. Do not mark a connector live without real end-to-end evidence.

Use the sample fixtures. Never commit real customer data, API keys, `.env` files, local databases, browser profiles, machine dependencies or production credentials. Keep the checked-in empty environment example in sync with supported variables.

Generated runtime libraries and ZIPs are restored by `npm run prepare:python`; Python source and the JavaScript lockfile remain authoritative. Retain third-party notices and artwork provenance. CI checks installation, Python scenarios and compilation; it does not publish the Site or validate live integrations.

Roll back an application change using a reviewed Git revert, then rerun its relevant checks. A Git revert alone does not redeploy production. This developer handoff adds a new `platform/` folder and root navigation; the prior application files remain available.
