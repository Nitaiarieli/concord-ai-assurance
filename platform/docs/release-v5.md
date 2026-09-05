# Concord v5 — organizational applications first

Decision and verification date: **2026-09-05**. This release follows the founder's explicit clarification: the website currently needs to be a mockup; build real backend ingestion foundations underneath it. It supersedes v4's default browser-runtime presentation and its unresolved Harmony identity.

## Decision and review

The product remains an automatic data-freshness layer for organizational agents. Start with **Confluence Cloud and Jira Cloud** as a bounded first application family, while keeping Slack and other organizational apps in the expansion path. Cloud is an implementation assumption; Atlassian Data Center is not covered. First workflow hypothesis: an AI/backend team needs its agent to use current product pages and issue information. The AI/backend lead operates it; CTO/VP Engineering is the budget hypothesis. A live design partner, measured maintenance cost and paid conversion are still needed. See the prior market comparison in `product-market-decision-v4.md`; its customer/pricing hypotheses were not validated by this technical release.

The root product/implementation owner coordinated separate enterprise-integration, file-ingestion, distributed-state, deployment-research, Security and UX agents. They submitted independent code/research and reviewed interfaces and claims. These are assigned roles, not personal career claims.

| Review issue | Decision and reason |
|---|---|
| Manual change selection versus automatic operation | Main mockup starts with application setup. No user action is required for each subsequent source change. |
| All organizational apps versus repeatable MVP | Two Cloud adapters first, bounded file/API contracts next. Do not imply an arbitrary application API is already understood. |
| Harmony identity and deployment | Confirmed Harmony.io. Its vendor page describes an outbound customer proxy for cloud workflows; it does not establish full-platform self-hosting. Concord's cloud enrollment/tunnel is proposed, not implemented. |
| API listing completeness versus deletion | A successful visible listing is not authoritative existence. Preserve and block missing records unless an authoritative inventory explicitly supports removal. |
| Security review of generic HTTP | Deletion authority defaults false; reject invalid types. Bound established HTTP header/body reads with a shared deadline. DNS still depends on the host resolver. |
| UX review | Preserve saved scope within the session, label reset behavior, avoid “Every source change”, darken secondary text, and make missing OAuth/destination work explicit. |

No forced consensus on willingness to pay, the second commercial adapter, or enterprise rollout cost: these require actual customer evidence. If the customer's native ingestion already meets freshness, permissions and recovery needs at lower total cost, Concord needs a different use case or should not be sold to that account.

## Concrete release

- Main English interface: Overview, Applications, Sync activity and Deployment, with varied existing stone/plant assets. Example setup is session-only; no credentials or customer API calls.
- The previous automatic Python browser demonstration remains at `/runtime-lab`. The historical manual lab remains at `/lab`.
- Python source adapters for Confluence Cloud and Jira Cloud, fixed OAuth gateway, explicit source scope and bounded pagination. Existing authorized OAuth bearer environment reference only; no consent/refresh flow.
- Folder scanning for Markdown, Concord-contract JSON, UTF-8 text, CSV, static HTML and DOCX main-body text. No PDF/OCR, unsafe links or arbitrary file-format claims.
- CLI `catalog` and `scan`, plus the existing automatic `run`, durable SQLite index/cache, local authenticated status/retrieval and source/configuration binding.
- Non-authoritative disappearance retains indexed records and evidence, blocks registered retrieval/cache, and requires source/retrieval verification before recovery.
- Downloadable source package now includes current setup and source-contract documentation. GitHub handoff remains under `platform/`.

This is one configured source per local worker. A Confluence worker and Jira worker require separate configuration, state and ports today. No managed multi-source fleet, external VectorDB, live agent memory, effective Atlassian user ACL, webhook receiver, API delta checkpoint or model retraining is supplied.

## Acceptance and validation

Release gates: Python behavior/HTTP/security tests; packaged WebAssembly parity; actual HTTP-envelope console regression; working public mockup navigation, setup, activity and accurate labels; source package includes executable setup; production build; preserved prior source and saved Site version.

Executed evidence is recorded here before publishing. A planned gate is not a passing result.

- Full Python suite: **129 tests passed** in 10.106 seconds, including HTTP Jira status-only changes with a constant provider timestamp reaching direct and cached retrieval.
- Packaged WebAssembly legacy and automatic-runtime parity passed; the real HTTP-envelope console regression passed.
- Production frontend/Worker build passed; the main route and both retained labs were emitted.
- Freshly extracted backend download: bundled guide, `catalog`, `init` and actual `scan` passed.
- Desktop preview: main apps-first layout visually inspected; scope selection/save/reopen preserved choices; refresh-reset label visible; activity filter and visibility-loss detail worked; deployment explicitly shows cloud work still needed; the sample answer is labeled illustrative and makes no model/retrieval call.
- Documentation examples: fresh `init`, `scan`, `catalog`, Confluence runtime config, Jira source config and generic snapshot document validated without live vendor requests or printed secrets.

Live Atlassian authentication, quotas, real employees' access and customer retrieval paths have not been tested. Linux execution is verified; macOS/WSL instructions are not executed here. Native Windows filesystem scan is unsupported. Responsive CSS is supplied; mobile visual QA remains unverified in the available browser interface. Existing Cloudflare ambient types still prevent a separate whole-project `tsc --noEmit` claim.

## Rollback

Public website: restore the saved successful v4 version `appgprj_6a9c0fb1ff5081919f863cb560680fc8~appgver_cf449fa85fa881918bbd76433ee09f40`, corresponding to source `baa0bc609873a13cada6f11a3fd5372b35a1d1b4`. No customer runtime or database is deployed through this public Site update.

Local runtime: stop the process, preserve v5 code/config/state, then use the prior code with its matching preserved state. Do not run two writers on one database or remove source-binding files. Generic JSON's absent deletion-authority field now defaults false; restoring older code can restore older disappearance semantics, so explicitly review that producer contract before using an older runtime on real data.

## Next proof

Use `atlassian-mvp.md` for the 30/60/90-day product/engineering gates. Implement a distributable OAuth consent/refresh flow, verify one live Confluence scope, connect one customer's ingestion and actual retrieval, resolve effective permissions and measure source-visible-to-correct-retrieval latency and support cost. Then repeat with a second installation. Broader integrations and cloud fleet management follow demonstrated demand.
