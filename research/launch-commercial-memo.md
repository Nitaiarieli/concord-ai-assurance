# Concord launch, commercial model, FinOps, and competitive intelligence memo

**Research cutoff:** 2026-08-20  
**Evidence ledger:** `research/evidence-ledger.json`  
**Recommendation:** design-partner pilot only; do not launch as a generally available assurance product yet.

## 1. Executive recommendation

- **Verified product state:** the current code is a bounded product demonstration with authenticated tenant setup, a versioned commercial data model, transparent free-first-application logic, and testable pricing and FinOps calculations. It does not yet operate live authority or derivative-system connectors.
- **Inference — commercial model:** use a hybrid of connected production application instances plus organization-level unique protected human identities. This best balances cost to serve, customer coverage value, procurement explainability, and expansion.
- **Required commercial rule:** the earliest eligible production application carries a $0 application fee. There is no contradictory base-platform fee.
- **Launch boundary:** invite a small number of design partners into a paid or tightly bounded pilot only after one real end-to-end SharePoint + Entra + derivative-store control loop passes the evidence gates.
- **Pricing boundary:** do not publish numeric rates until founder approval follows willingness-to-pay and connector-cost experiments. The production UI and public API intentionally lock unapproved rates.

## 2. Existing product audit

| Area | Audited state | Preservation decision |
|---|---|---|
| Frontend | Vinext/Next 16, React 19, Tailwind CSS 4 with a custom radical editorial design system | Preserved and extended |
| Backend | Next route handlers compiled to a Cloudflare Worker | Preserved |
| Database | Drizzle ORM; D1 helper existed but no active schema or binding | Activated D1 and added a versioned schema |
| Authentication | Sign in with ChatGPT headers and a protected workspace route | Preserved and used for tenant creation |
| Organization/user model | Previously absent | Added organizations and organization memberships |
| Connectors | Static demo contracts; no live OAuth or synchronization | Preserved honestly; registration is marked pending authorization |
| Billing | Previously absent | Added central price books, plans, subscriptions, entitlements, meters, and calculation logic |
| Analytics | Previously absent | Added organization-scoped commercial events |
| Routes | Product home and demo APIs | Preserved; added pricing, value, intelligence, workspace, and supporting APIs |
| Deployment | Cloudflare Sites/Worker; database binding previously null | Preserved and extended with D1 migration packaging |
| Tests | Rendered HTML and safe simulation tests | Preserved and expanded to 15 automated tests |

## 3. Market and pricing findings

### Verified facts

- Atlassian documents unique-user multi-instance pricing for eligible Marketplace arrangements.
- Slack applies an active-member billing principle.
- monday.com publishes seat buckets, illustrating the fairness problems of quantity cliffs.
- Linear combines free entry with public per-user paid plans.
- BetterCloud states that license count, connected apps, modules, and add-ons affect price.
- Zylo publishes Core, Premium, and Enterprise packages but requests a quote.
- CloudEagle publishes modular packages and free-trial/demo entry, but the reviewed page did not supply reliable numeric list rates.
- Productiv ceased operations on 2026-08-06 and is retained only as a historical category reference.

### Vendor claims

- Lumos describes its custom enterprise pricing as tied to identity and application count.
- AppOmni, Noma, Zenity, Grip, Token, Saviynt, ARMO, and ElixirData claims were recorded only as vendor positioning unless independently supported.

### Inference

The lowest-friction model is:

1. one transparent application-instance meter;
2. one deduplicated protected-human meter at organization level;
3. the first eligible production application at a $0 application fee;
4. progressive user tiers and an optional annual discount only after price-book approval;
5. separate non-human usage metering for cost analysis, not hidden human charges.

This avoids pure usage pricing, which could make assurance unpredictable and discourage verification.

## 4. Pricing and packaging recommendation

| Package | Role | Commercial hypothesis |
|---|---|---|
| Starter | Prove one control loop | First application fee $0; configurable user allowance; basic monitoring, verification, evidence retention, and baseline |
| Growth | Operationalize assurance | Additional application instances; organization-level protected users; remediation, FinOps, allocation, reports, and longer retention |
| Enterprise | Standardize controls | Progressive volume terms; SSO/SCIM/RBAC; residency/private deployment; SLA; procurement and connector packages |

**Unknown and founder-controlled:** numeric application rate, included-user allowance, user-tier prices, annual discount, guest treatment, non-human meter, and connector-specific cost floors.

## 5. Connected-application and identity rules

- A connected application is one customer-controlled workspace, site, tenant, account, or organizational instance.
- Jira and Confluence are distinct application units.
- The earliest eligible production application gets the free designation.
- Reconnection preserves that designation; replacement requires an owner-approved audited change.
- Linked sandbox/staging environments are measured for cost-to-serve but are not separate billing units unless contracted as standalone coverage.
- Deleted instances stop future metering while historical billing and evidence remain.
- Repeated rotation or false environment labeling triggers review, not a hidden fee.
- Identity resolution order: verified IdP subject, verified normalized email, then source-specific identity.
- Humans and guests with effective protected access can count once. Deactivated identities without access, bots, service accounts, and AI agents do not become protected-human charges.

## 6. FinOps evidence methodology

| Classification | Rule |
|---|---|
| Verified financial value | Requires observed cost/usage data and linked evidence |
| Estimated operational value | Approved hours saved × approved loaded hourly rate |
| Cost avoidance | Supported future cost prevented; never labeled realized cash savings |
| Risk exposure | Scenario, likelihood, impact, source, method, confidence; never added to savings |

- `Net verified value = verified financial value − Concord fees − Concord operating cost`
- `ROI = net verified value ÷ total Concord cost × 100`
- `Targeted repair value = equivalent full-rebuild cost − measured targeted-repair cost`
- Missing source, baseline, evidence, cost, or approved assumption returns an empty state rather than a fabricated number.

Every production metric record carries formula, source/evidence, baseline and measurement periods, currency, recency, confidence, assumptions, and classification.

## 7. Mainstream competitive landscape

| Company | Present class | Material pathway |
|---|---|---|
| Glean | Functional competitor | Permission-aware search and connector synchronization |
| Azure AI Search | Functional competitor | Access-controlled ingestion and retrieval inside Azure |
| Elastic | Functional competitor | Connector permission sync and document-level security |
| AppOmni | Adjacent platform | SaaS posture, identity, privilege, and AI-agent governance |
| BetterCloud | Adjacent platform | Connected-app governance and lifecycle automation |
| Noma Security | Emerging threat | AI security lifecycle with discovery, governance, runtime, and response |
| Zenity | Emerging threat | Agent permissions, runtime enforcement, and response |
| Internal engineering | Substitute | Webhooks, deletions, cache invalidation, and audit scripts |

**Inference, medium confidence:** no vendor was verified in the documented search as offering Concord's entire source-change → cross-derivative repair → destination read-back → affected-identity retrieval proof → evidence workflow. This is not proof that no private capability exists.

## 8. Under-the-radar watchlist

| Priority | Company | Present class | Dated reclassification trigger |
|---|---|---|---|
| Investigate Now | Grip Security | Emerging threat | Adds affected-identity retrieval tests or cross-derivative repair |
| Investigate Now | Token Security | Emerging threat | Adds authoritative content-change lineage or destination read-back proof |
| Monitor | Saviynt Zuma | Adjacent platform | Adds cross-system derivative-state verification |
| Monitor | ARMO | Adjacent platform | Ships enterprise SaaS/RAG connectors and remediation |
| Weak Signal | ElixirData | Emerging threat | Publishes production docs, connector coverage, customers, and retrieval proof |
| Weak Signal | Natoma | Emerging threat | Publishes a production permission/retention propagation loop |

## 9. Crunchbase scope and limitations

**Access level:** unavailable in this environment. No authorized Advanced Search, AI Search Builder, or Search API was exposed. No login, paywall, export limit, or API limit was bypassed.

Unavailable: database-only employee/founding/funding filters, full investor graphs, last-funding filters, stealth result counts, and Crunchbase-reported volatile fields.

Public fallback scope covered permission propagation, identity-aware retrieval, RAG/agent security, lineage/observability, non-human identity, continuous controls, SaaS/data posture, investor/launch/product signals, and official product documentation. It produced 18 raw candidates, 14 deduplicated candidates, 12 candidates with official-source verification, and 6 watchlist entries. The search is not exhaustive.

## 10. Implemented product, data, API, and deployment changes

- New public pricing calculator with first-app $0, protected-user definition, cadence, packaging, FAQ, and locked unapproved rates.
- New Value & FinOps experience with filters, trace stories, calculation contract, evidence coverage, honest empty state, CSV export, and printable/PDF executive view.
- New market-radar UI with mainstream landscape, under-the-radar priorities, official evidence links, search counts, and Crunchbase limitations.
- New authenticated workspace onboarding, application registration, free-app designation, additional-app flow, billing methodology, and honest pending-authorization state.
- New authenticated application/workspace/analytics APIs plus public pricing and research APIs.
- New versioned D1 schema with 28 tables, tenant fields, audit trails, idempotency keys, metering, billing, identity mapping, FinOps evidence, research provenance, watchlists, and reports.
- New D1 migration and deployment binding.
- Existing marketing, readiness, case simulation, integration contracts, metadata, and radical visual system preserved.

## 11. Validation experiments

All targets below are **Assumptions** until measured with customers.

| Experiment | Assumed success threshold | Decision unlocked |
|---|---:|---|
| First-app activation | ≥40% of qualified invited workspaces in 14 days | Free wedge viability |
| Time to first verified value | ≤7 days after authorization | Pilot feasibility |
| Free-to-second-app conversion | ≥25% within 90 days | Expansion metric |
| Pilot-to-paid | ≥40% of completed pilots | Commercial viability |
| Identity dedup precision | ≥99.5% on reviewed high-confidence matches | Billing trust |
| Identity dedup recall | ≥98% on labeled design-partner identities | Duplicate-charge control |
| Financial calculation accuracy | 100% reproducible on sampled events | CFO credibility |
| Connector gross margin | ≥75% after onboarding normalization | Scalable cost to serve |
| FinOps dashboard monthly engagement | ≥60% of active pilots | Decision value |
| Executive report usage | ≥1 export per active pilot per quarter | Renewal/procurement utility |
| Watchlist verification rate | ≥60% of investigated candidates | Research efficiency |
| Watchlist signal-to-noise | ≤25% weak signals promoted without later evidence | Radar quality |

Also measure average applications and unique users per customer, gross margin by connector/user tier, renewal and expansion intent, WTP by buyer, and cost per verified identity/detection/repair/verification.

## 12. Verification performed

- Production build passed.
- ESLint passed.
- Git whitespace validation passed.
- 15 automated tests passed: billing, application counting, identity deduplication, draft-price lock, FinOps separation/empty states, tenant-scoped schema/idempotency, rendered routes, public price safety, mutation authentication, and safe simulation bounds.
- Evidence ledger strict validation passed: 23 claims, zero errors, zero warnings.

## 13. Remaining launch blockers

- No live OAuth connectors, webhook ingestion, synchronization, derivative repair, destination read-back, or affected-identity retrieval probe.
- No independent security review, adversarial tenant-isolation test, recovery drill, SLO history, on-call history, or connector abuse testing.
- No approved price book, payment processor/invoicing integration, tax handling, or production billing close.
- No customer-approved cost sources, baselines, assumptions, or live FinOps evidence.
- No authorized Crunchbase database research pass.

## 14. Founder approvals required

1. Approve pilot-only positioning and assurance promise boundary.
2. Select the first live connector/control-loop pair and design partners.
3. Approve the price-book experiment ranges, not public final rates.
4. Approve included-user allowance, guest policy, non-human identity meter, and sandbox policy.
5. Select billing/invoicing provider and procurement workflow.
6. Approve data residency, retention, security-review, and SLA commitments.
7. Authorize Crunchbase access if database-backed discovery is required.

## 15. Launch verdict

**31/100 — Design-partner staging only.** The commercial and measurement architecture is now materially more launch-ready and explainable. The core product assurance claim remains unproven until a live, identity-aware control loop produces repeatable customer evidence under failure, retry, tenancy, and recovery tests.
