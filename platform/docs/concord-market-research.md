# Concord: market research and product decision

Research cutoff: **5 September 2026**. Mode: **strategic opportunity test**. This is a baseline public-source study, not a claim of product-market fit. All proposed commercial numbers and pilot goals are assumptions unless explicitly labeled otherwise.

## Recommendation

**Proceed with a narrower MVP: prove that a source permission change or deletion took effect across a customer's registered AI retrieval destinations.** The opportunity is plausible; buyer demand and differentiation remain unproven.

The product should follow one observable control loop: a source changes → Concord identifies the registered copies that depend on it → the integrated retrieval path blocks affected content while state is uncertain → targeted repair runs → the actual customer retrieval endpoint is tested using the affected identity → evidence records the result and remaining coverage gaps.

**בעברית פשוטה:** הבעיה שכדאי לבדוק היא מה קורה למידע שכבר הועתק למערכת AI לאחר ששינו או ביטלו את ההרשאה במקור. כבר קיימים מוצרים שיודעים לחבר מקורות ולבדוק הרשאות. לכן הערך האפשרי של קונקורד הוא להראות אילו עותקים הושפעו, לתקן אותם ולבדוק בפועל שהמשתמש שקיבל ביטול הרשאה כבר לא יכול לקבל את המידע דרך המערכת של הלקוח. המחקר מצדיק בניית פיילוט ממוקד; הוא עדיין לא מוכיח שחברות יקנו את המוצר.

**Confidence:** medium in the existence of a concrete engineering problem; low in the size of a separately purchasable market; low in current commercial validation. Public documentation can show a failure mode or existing control. It cannot establish how frequently the chosen customers suffer it or what they will pay Concord to fix.

## 1. The decision and what could change it

The decision is whether to build a new Concord MVP around **cross-system change propagation and retrieval evidence**, with a customer-run Python component, instead of a broad enterprise AI security dashboard.

Proceed to wider product development only if three design partners can identify a recent relevant incident or a release blocked by this problem, provide access to a controlled retrieval path, and accept measurable paid-pilot criteria. Revise or stop if their existing stack meets those criteria with configuration alone, no team owns a budget, or the required integration repeatedly takes more than five engineer-days after the initial integration is learned. These thresholds are proposed experiments, not observed results.

## 2. What the evidence actually shows

### A genuine synchronization problem is documented

**Verified Fact:** Azure AI Search documents document-level access enforcement against permission metadata synchronized into the index. Its current native features are preview; a check at query time does not automatically mean the upstream permissions were fetched at that instant. [Microsoft: document-level access control](https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview)

**Verified Fact:** Microsoft distinguishes unique item ACL updates from inherited parent-scope permission changes in its SharePoint indexer. Recent previews support incremental item ACL changes; parent-scope changes require explicit refresh. This is a specific synchronization boundary Concord can test. It is not evidence that all Azure deployments expose restricted data. [Microsoft: SharePoint permission ingestion](https://learn.microsoft.com/en-us/azure/search/search-indexer-sharepoint-access-control-lists)

**Vendor Claim:** Microsoft's engineering team describes a customer project that carried SharePoint permissions into downstream AI search and planned periodic re-ingestion. This is stronger than a generic trend article because it describes an actual implementation need; it remains an unnamed vendor case without incident frequency, budget or third-party control purchasing evidence. [Microsoft engineering case, 30 April 2026](https://devblogs.microsoft.com/ise/sharepoint-doc-level-access/)

### Important parts of the proposed product already exist

**Verified Fact:** Glean documents mirrored source permissions and identity-aware enforcement across search, answers, agents, MCP and embedded interfaces. It also documents administration audit exports. Concord must not claim to have invented permission-aware enterprise retrieval. [Glean security principles, updated 24 August 2026](https://docs.glean.com/security/security-principles)

**Verified Fact:** Oso and AuthZed publish RAG authorization implementations. AuthZed also published a LangGraph example with authorization embedded in the pipeline. Using Python, vector search and LangGraph is an implementation choice, not a competitive moat. [Oso's Python/pgvector example](https://www.osohq.com/post/right-approach-to-authorization-in-rag), [AuthZed with Pinecone](https://authzed.com/docs/spicedb/integrations/pinecone), [AuthZed's LangGraph example, 15 April 2026](https://authzed.com/blog/build-production-grade-agentic-rag-authzed-cloud)

**Inference:** The defensible question is narrower: can Concord make **cross-system containment, selective repair and affected-identity outcome evidence** materially easier and faster than assembling existing controls? That is the comparison the MVP must win.

### There are good alternatives that shrink the opportunity

**Verified Fact:** Microsoft's SharePoint guidance recommends a remote knowledge source when the full SharePoint permissions model is required. It calls the Copilot retrieval API and keeps governance in SharePoint. Live retrieval architectures can reduce the amount of copied state that needs reconciliation. They do not justify a universal claim that every downstream cache is repaired. [Microsoft's remote-source recommendation](https://learn.microsoft.com/en-us/azure/search/search-indexer-sharepoint-access-control-lists)

**Vendor Claim:** Airbyte's May 2026 Agents launch combines a Context Store with live connectors and a Python SDK. Its security materials market permission-aware access and query-time authorization. A connector vendor can expand toward the same control point. No Airbyte performance figures are used as independently verified results here. [Airbyte Agents launch](https://airbyte.com/blog/airbyte-agents), [Airbyte security positioning](https://airbyte.com/agentic-data/ai-agent-security)

## 3. Target customer, buyer and job

The following are **ICP hypotheses**, selected for pilot recruitment, not verified market segmentation.

| Role or characteristic | Initial hypothesis | Evidence needed |
|---|---|---|
| Customer | A company running its own internal RAG/agent application over sensitive business documents | A working production or preproduction retrieval endpoint and recent control concern |
| Architecture | One authoritative source feeding at least two independently managed derived stores, or one store plus cache | A source-to-destination inventory and stable source IDs |
| Champion | Head of AI Platform, AI infrastructure engineer or platform engineering lead | Owns changes to retrieval middleware and can install the runtime |
| Security sponsor | Security engineering lead or CISO delegate | Defines acceptable exposure windows and approves evidence criteria |
| Economic buyer | Initially the AI/platform budget owner, with security co-sponsorship | Named budget, purchase process, cost of the existing workaround |
| Initial geography | Founder-accessible companies in Israel, then reachable international teams | Warm access and deployment feasibility, not a market-size claim |
| Avoid initially | Teams with no deployed retrieval use case; fully satisfied users of one managed search platform; inaccessible closed destinations | No controllable integration path or independently purchasable pain |

The job is: **“When access changes, tell me which registered AI copies are affected, contain the exposure on our integrated path, and show me whether the affected person can still retrieve the content.”**

Do not ask buyers whether “AI governance is important.” Ask them to reconstruct their last permission incident, deletion request, access-review finding or blocked AI launch: which systems, who repaired them, time spent, who accepted the residual risk, and whether anyone proved the final retrieval result.

## 4. Competitive alternatives

This bounded test compares ten alternatives: nine vendor/platform offerings plus internal build. “Functional” means an alternative can satisfy important parts of the buyer's job; it does not mean the full proposed Concord workflow is independently verified there.

| Alternative | Primary class | Publicly documented overlap | Implication for Concord |
|---|---|---|---|
| Glean | Functional | Source permission mirroring, identity enforcement, audit exports; SaaS and customer-hosted models | A strong option when governed enterprise retrieval within Glean satisfies the job. Customer-hosting alone is not differentiation. [Security](https://docs.glean.com/security/security-principles), [deployment overview](https://docs.glean.com/security) |
| Microsoft Azure AI Search / SharePoint retrieval | Functional | Native preview ACL ingestion and query enforcement, plus a remote-source alternative | Sell a measured operational outcome around the actual customer architecture; avoid implying Microsoft lacks ACL support. [ACL overview](https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview) |
| Paragon Managed Sync | Functional | Change and deletion events plus a synced fine-grained authorization model and query filters | Particularly relevant as a buy-versus-build alternative or connector partner. Prove value beyond sync status and access checks. [Sync API](https://docs.useparagon.com/managed-sync/sync-api), [Permissions API](https://docs.useparagon.com/managed-sync/permissions-api) |
| Onyx | Functional | Source permission sync for selected Enterprise Edition connectors; refresh/prune configuration; self-hosting and cloud | Competes when a managed/open platform is enough. Per-connector behavior matters. [Connectors](https://docs.onyx.app/admins/connectors/overview), [overview](https://docs.onyx.app/welcome) |
| Oso | Functional | Python/Postgres/pgvector example with local authorization | A credible authorization component for in-house systems. Concord needs propagation, repair and final endpoint proof around it. [RAG example](https://www.osohq.com/post/right-approach-to-authorization-in-rag) |
| AuthZed / SpiceDB | Functional | Relationship-based access checks integrated with vector retrieval and agent workflows | Do not build an unnecessary replacement authorization engine; integrate source truth and measure results. [Pinecone integration](https://authzed.com/docs/spicedb/integrations/pinecone) |
| Airbyte | Adjacent | Replication and an expanding agent context layer, Python/MCP integration; governance marketed | Owns source connectivity and can bundle more controls. Claims of protected context need scoped verification. [Agents launch](https://airbyte.com/blog/airbyte-agents) |
| Unstructured | Adjacent | Parsing, chunking, enrichment and embeddings in source-to-destination pipelines | Potential partner and substitute for ingestion work. Generic chunking and connector breadth are weak differentiation. [Documentation](https://docs.unstructured.io/welcome) |
| LangSmith | Adjacent | Offline and online evaluation, code evaluators, trace-based feedback | Can underpin an internal verification harness. Concord's value would be source-linked control logic, repair and deployment integration. [Evaluation](https://docs.langchain.com/langsmith/evaluation) |
| Internal build | Substitute | Combine connector events, an authorization engine, retrieval middleware and tests | The strongest discovery question may be why a competent platform team would buy instead of maintaining a small internal service. Relevant implementation examples: [Oso](https://www.osohq.com/post/right-approach-to-authorization-in-rag), [AuthZed](https://authzed.com/docs/spicedb/integrations/pinecone), [LangSmith](https://docs.langchain.com/langsmith/evaluation) |

**Not Publicly Documented:** No publicly documented support for the complete independently operated source-change → cross-vendor derivative repair → actual affected-identity retrieval evidence workflow was found as of 2026-09-05 in the reviewed documents above. This is a qualified scope finding. It is not proof that no vendor, private feature, professional service or internal platform already provides it.

### How competitive scoring was handled

The supplied research skill's scoring script was used with evidence IDs and unknown dimensions preserved as unknown. The focused study does not establish enterprise readiness, customer adoption, prices and every control dimension for each vendor. Consequently, **no vendor has sufficient coverage for a composite ranking**. Partial axis arithmetic is saved for reproducibility, not presented as a league table. Lack of a retrieved document is not scored as an absent feature.

Specific items requiring commercial diligence before a vendor shortlist: present pricing and packaging; supported versions; private deployment terms; security assurance reports; connector-specific semantics and SLAs; actual customer evidence. No funding, ARR, customer count or vendor price is invented in this study.

## 5. Under-the-radar discovery

**Access limitation:** authorized Crunchbase search/API access was unavailable in this session. No subscription database, export or authenticated Crunchbase results were used. No funding, headcount or stage is inferred.

The fallback pass used workflow and control-point queries, official product pages and repositories, plus a public launch/accelerator discovery query. It deliberately included unfunded and open-source projects; no funding filter was applied. Four named candidates were added to the watchlist. Together with the nine vendors above, the retained named vendor/project set is thirteen, plus the internal-build alternative. Raw search-engine hits were noisy and not counted as companies; this was not an exhaustive census.

| Candidate | Why surfaced and why easy to miss | Evidence / verification status | Priority and trigger |
|---|---|---|---|
| Ragie | Embedded multi-tenant RAG and connector lifecycle; may be classified as RAG infrastructure rather than security | Official launch describes authentication, permissions, syncing and webhooks. Detailed docs homepage failed with HTTP 502; exact ACL propagation remains partly verified. [Ragie Connect](https://www.ragie.ai/blog/introducing-ragie-connect) | **Investigate now:** a demonstrable revocation/deletion SLA, external-store control or independent identity outcome evidence |
| Nango | Integration infrastructure can supply missing deletion events without marketing itself as AI assurance | Official docs distinguish full-sync deletion detection from explicit incremental deletion handling. [Deletion detection](https://nango.dev/docs/guides/functions/syncs/deletion-detection) | **Monitor:** source permission graphs plus destination remediation/probe capabilities |
| Letta | Stateful agent memory is an adjacent derived-data control point | Docs say deleting a shared block removes it from attached agents. No broad source-to-memory guarantee is inferred. [Memory blocks](https://docs.letta.com/v1-sdk/memory/memory-blocks/) | **Monitor:** source-linked provenance, policy-driven memory invalidation and identity-specific evidence |
| SciPhi R2R | Open-source retrieval framework, discoverable through launch threads and GitHub rather than a security category | Official repository establishes agentic retrieval and a REST API. Enterprise permission propagation was not deeply assessed. [R2R repository](https://github.com/SciPhi-AI/R2R) | **Weak signal:** maintained cross-source permission synchronization and post-change retrieval verification |

These candidates are **not automatically direct competitors**. Their current control point makes them useful partners, alternatives or future threats. Refresh the watchlist when preparing a pilot comparison or financing discussion.

## 6. The smallest credible MVP

### Build one complete path

Use **BookStack as the first controlled integration environment**, because it is the selected project boundary in the prior Concord work. This choice demonstrates the mechanism; it does not validate BookStack as the largest commercial segment. The first commercial source should be whichever source three paying prospects actually use, likely evaluated among SharePoint, Confluence or Google Drive rather than selected by a logo list.

1. Register a BookStack source, its canonical object IDs and revisions, and the identities/groups relevant to the pilot.
2. Register one retrieval destination and one cache, with explicit mutation and probe capabilities. A local index is a valid first implementation; a vector database adapter follows the same contract.
3. Maintain deterministic source-to-chunk/cache lineage as those derivatives are created. Do not claim automatic discovery of every enterprise copy.
4. Ingest a source event or reconcile a snapshot with a documented freshness window. An incoming event must be checked against current authoritative state to avoid replay or ordering mistakes.
5. Contain the affected items on the integrated customer retrieval path before repair. If source truth, identity or policy is unknown, return a blocked/unverified state. Source outage and destination outage require explicit behavior.
6. Repair only the affected registered artifacts: update ACL metadata, remove deleted objects or invalidate/rebuild stale content and caches. Revoking one person's access need not delete material still available to other authorized people.
7. Verify destination state, then call the customer's actual retrieval endpoint with a scoped test identity. Keep repair and identity proof as separate states.
8. Preserve evidence: source revision, affected IDs, event and repair timestamps, policy version, actor, runtime/probe version, request context, expected outcome, observed returned identifiers and failures. Avoid collecting raw restricted content unless necessary and explicitly configured.

### Observable acceptance behavior

| Source change | Required outcome on the registered path | What must not be called success |
|---|---|---|
| A user's permission is revoked | The user's test query returns no affected identifiers; other authorized identities retain expected access | A vector update succeeded but the app cache still serves the record |
| A source document is deleted | Registered chunks and cache entries are removed or unavailable; retrieval probe confirms the bounded result | A successful delete request without confirming destination state |
| Content changes | Retrieved evidence references the intended current revision; stale cache is invalidated | A new embedding exists while the old revision is still retrievable |
| Source truth or identity is unavailable | Integrated path blocks the affected scope; incident stays unverified | A timeout, empty result or failed login counted as a successful denial |
| One destination is unreachable | Other results remain visible, but overall coverage is incomplete and case is unresolved | “All systems protected” based only on reachable systems |

A blocked query is not always a passed security probe. The probe must first establish that it authenticated as the intended identity and exercised the intended endpoint. A positive control should show permitted material can still be retrieved; an unavailable service proves neither permission correctness nor availability.

### Explicit boundary

Concord can promise only what its installed adapters and retrieval enforcement points control. It cannot retract information already copied outside those points, guarantee removal from a closed third-party model, erase model weights, or prove an unknown agent memory no longer contains a fact. Model training/unlearning is out of scope. Conversation history, generated summaries and durable agent memory require provenance and separate adapter semantics.

The pilot must measure the time from **source change to detection**, **detection to containment**, and **containment to verified repair** separately. Instant prevention is not a credible blanket claim when source APIs expose delayed polling rather than complete events.

## 7. Architecture implications from the market research

These are **design recommendations**, not claims about the completed code.

| Layer | Responsibility | Why it fits the opportunity |
|---|---|---|
| Customer runtime, Python | Source adapters, truth checks, identity mapping, retrieval guard, destination mutations and probes | The control must observe the real customer path; credentials and sensitive content can remain local |
| Concord control plane | Registered integrations, policies, capability status, incident workflow and evidence metadata | Gives platform/security teams a common view without requiring all source content centrally |
| Domain/application layer | Deterministic state machine, lineage, idempotency, version checks and explicit error handling | A security decision must not depend on a model's judgment |
| LangChain integration | Model/tool/retriever adapters at a bounded integration edge | Supports apps using LangChain without coupling the entire control engine to it |
| LangGraph integration | Durable multi-step orchestration, retries, checkpoints and optional operator intervention | Fits the long-running repair workflow, with permissions enforced by code |
| LangSmith, optional | Sanitized traces and regression evaluation | Adds diagnostics; it is not the system of record for authorization proof |
| Vector database | Store/query embeddings and source/revision metadata | Similarity is distinct from authorization; metadata alone is not upstream truth |

LangChain and LangGraph are related frameworks with different abstraction levels; LangGraph can be used independently, while LangChain's agents build on it. LangSmith supplies evaluation/observability. They are not equivalents of a visual app-building product. [LangChain overview](https://docs.langchain.com/oss/python/langchain/overview), [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview), [LangSmith evaluation](https://docs.langchain.com/langsmith/evaluation)

External tracing should be optional and scrubbed; LangSmith itself documents preventing sensitive inputs/outputs from being logged. The same rule should cover model-provider calls. The repair control loop should remain operational without a Gemini or other model API key. A language model may explain an incident or draft an operator summary; it should not grant permissions or certify a denied result. [LangSmith sensitive-data controls](https://docs.langchain.com/langsmith/mask-inputs-outputs)

**Critical trust-boundary constraint:** a browser selector or caller-provided user ID is not an authenticated customer identity. A credible production probe requires a valid scoped credential or supported delegation and proof of which identity actually executed. Demo identity simulation must be labeled clearly.

## 8. Business model and market sizing

### Commercial hypothesis

Start with a fixed-scope, time-bounded paid pilot covering one source, one or two registered destinations, a defined document/identity scope and an agreed verification objective. Price the pilot only after estimating implementation and support effort. Test whether an annual base subscription for a protected deployment plus additional sources/destinations is more understandable than pure seat pricing.

Prior Concord discussions proposed application instances and unique protected users, with a first free application. Keep that as a pricing hypothesis, not an MVP requirement. Duplicating one source into many caches and stores can increase cost without adding users; billing must match actual work. A narrowly bounded free diagnostic may be safer economically than unbounded continuous repair. No final list price is supported by this research.

### What is unknown

There is no verified count here of enterprises with the required mixed-stack architecture and purchase-worthy failure frequency. Therefore, there is no evidence-backed Concord TAM claim to place on the new site or in an investor deck. Adding together “AI security,” “AI governance,” “data integration” and “vector database” markets would double count overlapping spending and overstate this wedge.

The accompanying model is a **sensitivity exercise made entirely from explicit assumptions**, not a market estimate:

`eligible accounts = target organizations × relevant AI share × purchase-worthy pain share`

`TAM = eligible accounts × annual contract value`

`SAM = TAM × serviceable share`

| Unvalidated input / arithmetic | Conservative | Base | Upside |
|---|---:|---:|---:|
| Hypothetical target organizations | 2,500 | 10,000 | 25,000 |
| Relevant AI workflow share | 20% | 35% | 50% |
| Purchase-worthy pain share | 10% | 20% | 35% |
| Resulting eligible accounts | 50 | 700 | 4,375 |
| Hypothetical annual contract | $15,000 | $30,000 | $60,000 |
| Arithmetic TAM sensitivity | $0.75m | $21m | $262.5m |
| Serviceable share | 20% | 30% | 40% |
| Arithmetic SAM sensitivity | $0.15m | $6.3m | $105m |

The large range is the finding: assumptions can manufacture a large story. They do not resolve whether there is a venture-scale company. Doubling pain prevalence or contract value doubles the modeled market; both need direct research. A top-down check was intentionally not substituted for the missing account evidence because this is not yet a stable product category.

For **month 18 (March 2028)**, use delivery and sales capacity as the limiting factor. The assumption-only scenarios target 1, 3 or 6 paid customers, corresponding to $15k, $90k or $360k annualized subscription revenue at the prices above. These are future test goals, not pipeline or forecast. They assume zero starting customers; one deployment engineer with one new pilot per six weeks after the initial build; at most six completed external deployments during the first 18 months; founder-led sales and a hypothetical 3–6 month sales cycle. No renewal or expansion revenue is included because it is unvalidated. Replace these inputs once time-to-install, purchasing and retention are observed.

## 9. Investor narrative that the evidence can support

**One-sentence description:** Concord is building a control layer that helps companies propagate source access and deletion changes into their registered AI data stores and verify the resulting retrieval behavior.

**Investor paragraph:** Enterprise AI applications create derived data across search indexes, vector stores and caches. Established platforms already synchronize permissions and authorize retrieval, but mixed customer architectures still require integration and evidence that the complete path behaves correctly after a change. Concord is testing a focused control loop: detect the authoritative change, contain affected retrieval, repair registered derivatives and verify with the affected identity. The immediate proof is a customer pilot showing bounded exposure windows and less manual reconciliation work. Customer urgency, willingness to pay, repeatability and expansion are still to be established.

Five pitch insights:

1. Lead with a concrete offboarding or deleted-document demonstration that uses the actual customer path.
2. Show exactly which source IDs and derivatives are covered. Coverage gaps increase credibility when stated honestly.
3. Distinguish “repair request accepted” from “affected identity verified.”
4. Treat Glean, Microsoft and authorization infrastructure as serious alternatives; explain the mixed-stack case in which a separate control is useful.
5. Ask for capital to prove repeatable customer outcomes and adoption, not to finish a large connector logo wall.

Three potential defensibility arguments, all **future hypotheses**:

1. An operational control graph with reliable source revisions, derivative ownership and tested repair semantics can become difficult to reconstruct.
2. A growing library of connector-specific regressions and identity probes can reduce installation time and improve reliability across customers without exposing their data.
3. Evidence history embedded in access-review and release workflows may create switching costs if security and platform teams repeatedly rely on it.

None is a demonstrated moat today. Python, agentic AI, embeddings, LangGraph and a polished interface are not defensibility by themselves.

### Current evidence score

The skill's reproducible investor rubric produces **33/100**, a structured judgment about current evidence and readiness, not a valuation, probability of success or fundraising recommendation. Buyer budget and go-to-market feasibility trigger the rubric's caution gates. The strongest dimension is timing; the weakest are willingness to pay, market sizing, moat and repeatable sales. All nine ratings have evidence references, but the commercial references principally document what is unknown.

This score should not be shown as a product quality score in the UI. A successful paid pilot and repeat installation would change it far more than adding another visual feature.

## 10. Risks and disconfirmers

| Material risk | What would disconfirm the thesis | Smallest useful test |
|---|---|---|
| Bundled controls are enough | Customers reach the same acceptance criteria using Glean/Microsoft/Paragon or a modest internal fix | Compare the existing stack against the proposed pilot, including total maintenance effort |
| No standalone budget | Repeated “important” feedback but no sponsor can fund a scoped deployment | Present a concrete priced pilot after reconstructing a recent incident |
| Integration overwhelms value | Every source requires custom identity reconstruction, unsupported APIs or weeks of work | Measure customer engineer-hours and capability gaps for three installations |
| Incomplete provenance | Important summaries, memories or caches cannot be traced to source objects | Register actual derivatives and report known versus unknown coverage |
| Fail-closed behavior disrupts work | False blocks or source outages make customers disable the guard | Inject outages and measure allowed-query availability as well as denied-query correctness |
| A source was overshared to begin with | All derivatives correctly mirror a source permission mistake | Separate propagation assurance from source-permission risk management |

The last risk matters: Concord's initial control can faithfully propagate an incorrect source ACL. That is a different problem from stale downstream permissions and should not be hidden under a generic “secure data” promise.

## 11. Five measurable milestones for the next 12–18 months

All milestones below are proposed targets. None is claimed as achieved.

| Milestone | Target and falsification rule | Owner / horizon |
|---|---|---|
| 1. Establish a purchasable problem | Conduct 15 incident-based interviews; obtain 3 scoped design-partner commitments with a named budget owner and existing workaround. Revise the wedge if fewer than 3 can show concrete urgency. | Founder, first 6–8 weeks |
| 2. Prove the actual integration path | Deploy at 3 partners; third installation takes ≤2 customer engineer-days; source→registered-destination coverage denominator is documented. Investigate any repeat install >5 engineer-days. | Engineering + partner platform lead, months 2–5 |
| 3. Pass a bounded control benchmark | At least 1,000 identity/query cases across revocation, deletion, content change, event replay and outages; zero restricted retrieval after confirmed containment in this test set; at least 99% of permitted control queries remain available outside deliberately injected outages. | Engineering + security sponsor, months 3–6 |
| 4. Demonstrate operational value | For supported events, target p95 ≤60s from receipt of authoritative change to confirmed containment, and ≤5min from containment to verified repair; report source detection lag separately. Reduce measured manual reconciliation time by ≥50% against the partner baseline over 30 days. Adjust targets explicitly for real source limits. | Platform owner + founder, months 4–9 |
| 5. Convert and retain | Reach 3 paid customers by month 18; at least 2 continue beyond their initial paid evaluation; at least 1 expands source or destination scope. Do not call unpaid pilots or verbal interest PMF. | Founder, months 6–18 |

If achieved, the next financing case should use real deployment cost, support hours, control volume, renewal intent and expansion instead of the assumption model above. A five-year ARR plan or funding amount is premature without hiring costs, runway and initial paid economics; this bounded study does not invent them.

## 12. How the research was performed

1. **Reconstructed the product thesis** from the supplied Concord project context: authoritative sources; permission/identity/deletion/content changes; downstream AI derivatives; fail-closed containment; selective repair; affected-identity proof; BookStack as the first integration boundary. Previous pricing and visual preferences were treated as product inputs, not market facts.
2. **Selected the smallest research mode** that could guide the new build: a strategic opportunity test, with ten decision-relevant alternatives rather than a 50-logo market map.
3. **Read the research skill and references** covering evidence standards, the Concord thesis, competitor classes/scoring, under-the-radar discovery, market sizing, investor case and report structure.
4. **Searched by failure mode and control point:** “document-level permissions,” “permission sync,” “source deletion,” “RAG authorization,” “agent memory delete,” “query-time filtering,” “LangGraph authorization,” connector lifecycle and evaluation tooling.
5. **Prioritized technical primary sources.** Opened Microsoft ACL/indexer documentation, Glean security pages, Paragon sync/permission APIs, Oso/AuthZed implementations, Onyx connector documentation and LangChain/LangGraph/LangSmith documentation. Promotional claims were labeled as vendor claims.
6. **Checked disconfirming evidence early.** In particular, documented current Microsoft and Glean controls, the remote SharePoint retrieval alternative and existing AuthZed/LangGraph patterns. The resulting recommendation narrowed the product rather than asserting an empty market.
7. **Ran a separate discovery fallback** because authorized Crunchbase access was unavailable. Public queries surfaced Ragie, Nango, Letta and SciPhi R2R; primary sources were checked before assigning watch priorities.
8. **Separated proof from hypotheses.** Capability documentation is evidence of documented behavior. It is not independent deployment testing. No customer interviews, production integration, sales data, authenticated competitor accounts or paid databases were available to this research agent.
9. **Built a claim ledger before final conclusions.** The companion JSON contains stable claim IDs, classification, direct URL, date, confidence, rationale and dependencies for inferences/estimates. Unknown and absence findings record scope and cutoff.
10. **Ran reproducible quality checks.** The skill's strict evidence validator checks the ledger structure and references; the scoring scripts preserve unknown competitor dimensions. Scenario formulas expose every commercial input. This validates research bookkeeping, not the factual correctness of every vendor statement.

### Representative discovery queries

- `"Azure AI Search" "document-level" "permissions"`
- `"Glean" "permission" "sync" site:docs.glean.com`
- `"Airbyte" "permissions" "agents"`
- `"Unstructured" "incremental" "deletion"`
- `"Onyx" "permissions" "sync"`
- `"Oso" "RAG" authorization`
- `"AuthZed" "RAG" permissions`
- `"Ragie" "permissions" connectors`
- `"Nango" "delete" "sync"`
- `"Paragon" "permissions" "deletions" "Index"`
- `"Letta" "delete" "memory"`
- `"R2R" "permissions" "SciPhi"`
- `"Ragie" "Y Combinator"` (public launch/accelerator discovery; no accelerator membership inferred)

Some broad queries returned irrelevant results. Those results were discarded, and direct official documentation navigation was used to verify capabilities. Ragie's documentation homepage failed to load, so its detailed permission semantics remain a research gap. No browser or access-control bypass was attempted.

The research stopped when additional primary sources reinforced the same product decision: ordinary connectors, ACL-aware retrieval and evaluations already exist; the unresolved opportunity is an independently measured propagation-and-proof workflow for a reachable buyer. The next highest-value evidence is a customer baseline, not more general market articles.

## 13. Implications for the new site and demo

Use concise, concrete English. A suitable top-level message is **“When access changes, your AI should follow.”** Explain the product in one supporting sentence: **“Trace source changes through your registered AI stores, repair affected data, and verify what users can retrieve.”** These are product positioning proposals, not competitor quotations.

The main demo should show one document, one affected identity and visible derivative paths. Let a viewer revoke access, inspect the resulting incident and distinguish containment, repair and verification. Show source/destination revisions, scope and actual evidence on demand. Display “Demo data,” “Simulated identity” or “Local verification” wherever those labels match the implementation.

Suggested operational views: overview, registered integrations, changes/incidents, and evidence. A graph should answer “what depends on this source?” rather than serve as decoration. Dashboard figures must be computed from the displayed data; do not fabricate protected users, blocked attacks, savings, customers or production connections.

Keep investor hypotheses, forecast inputs and roadmap connectors out of operational success metrics. A connector tile should communicate whether it is available, configured, awaiting credentials, unsupported or planned. “Repair complete” must never become “Verified” without the appropriate probe.

## Evidence and reproducibility files

- `claim_ledger.md`: human-readable source and classification table.
- `claim_ledger.json`: 32 structured, traceable claims and assumptions.
- `evidence_validation.json`: strict evidence-validator result.
- `competitor_scoring_input.json` and `competitor_scoring.json`: partial evidence-based axes; composite ranking withheld for insufficient coverage.
- `investor_scoring_input.json` and `investor_scoring.json`: transparent judgment and caution gates.
- `market_scenarios_input.json` and `market_scenarios.json`: assumption-only sensitivity arithmetic.
- `build_research_data.py`: recreates the ledger and model inputs.

The study is dated and bounded. It does not establish PMF, a complete market census, legal compliance, universal data removal or production security certification.
