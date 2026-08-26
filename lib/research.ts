export const researchCutoff = "2026-08-20";

export const pricingEvidence = [
  { company: "Atlassian Marketplace", model: "User-tiered; unique-user multi-instance option", evidence: "Verified Fact", implication: "Deduplicate people across instances where the platform relationship allows it.", url: "https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/" },
  { company: "Slack", model: "Active-member billing", evidence: "Verified Fact", implication: "Exclude inactive and deactivated users when value is no longer delivered.", url: "https://slack.com/help/articles/218915077-Slacks-Fair-Billing-Policy" },
  { company: "monday.com", model: "Seat buckets", evidence: "Verified Fact", implication: "Simple to quote, but bucket cliffs can feel unfair; Concord should use progressive tiers.", url: "https://support.monday.com/hc/en-us/articles/4405633151634-Plans-and-pricing-for-monday-com" },
  { company: "Linear", model: "Free entry + per-user paid plans", evidence: "Verified Fact", implication: "A free wedge can coexist with organization expansion.", url: "https://linear.app/pricing" },
  { company: "BetterCloud", model: "License count + connected apps + modules", evidence: "Verified Fact", implication: "The closest public structural benchmark supports Concord’s hybrid metric.", url: "https://www.bettercloud.com/pricing/" },
  { company: "FinOps FOCUS", model: "Normalized cost and usage records", evidence: "Verified Fact", implication: "Every value claim should retain allocation, recency, currency, and source provenance.", url: "https://focus.finops.org/focus-specification/" },
  { company: "Zylo", model: "Core, Premium, Enterprise; request a quote", evidence: "Verified Fact", implication: "Enterprise SaaS management commonly packages by maturity while keeping rates negotiated.", url: "https://zylo.com/pricing" },
  { company: "CloudEagle", model: "Modular platform; demo and free-trial entry", evidence: "Verified Fact", implication: "Module sprawl can obscure value; Concord should keep one metric and explicit entitlements.", url: "https://www.cloudeagle.ai/pricing" },
  { company: "Lumos", model: "Custom enterprise pricing tied to identity and app count", evidence: "Vendor Claim", implication: "Identity plus application count is already explainable to enterprise IGA buyers.", url: "https://www.lumos.com/identity-matters/identity-governance/saviynt-competitors-and-alternatives" },
] as const;

export const marketStatusNotes = [
  { company: "Torii", status: "Public packages and free trial; numeric enterprise rates not publicly documented in the reviewed official pages.", evidence: "Verified Fact + Not Publicly Documented", url: "https://www.toriihq.com/blog/how-to-get-started-with-torii-smp" },
  { company: "Zluri", status: "Identity, access, posture, and SaaS-management scope is public; numeric rates were not publicly documented in the reviewed official pages.", evidence: "Vendor Claim + Not Publicly Documented", url: "https://www.zluri.com/" },
  { company: "AppOmni", status: "Platform scope is public; numeric rates were not publicly documented in the reviewed official pages.", evidence: "Vendor Claim + Not Publicly Documented", url: "https://appomni.com/platform/" },
  { company: "Productiv", status: "Ceased operations on 2026-08-06; retain only as a historical category and pricing reference.", evidence: "Verified Fact", url: "https://productiv.com/" },
] as const;

export const commercialRecommendation = {
  metric: "Connected production application instances + unique protected human identities",
  confidence: "Medium",
  classification: "Inference",
  rationale: [
    "Application instances approximate connector, workflow, storage, and support cost.",
    "Unique protected identities track the breadth of delivered assurance without charging the same person repeatedly.",
    "Pure usage billing would make security coverage feel unpredictable and can discourage customers from running verification.",
    "A free first application removes procurement friction while preserving a measurable second-application expansion event.",
  ],
  unresolved: [
    "Approved allowance and rate levels",
    "Guest weighting after design-partner evidence",
    "Whether non-human identities become a separate enterprise meter",
    "Connector-specific cost floors for unusually expensive systems",
  ],
} as const;

export type RadarPriority = "Investigate Now" | "Monitor" | "Weak Signal";

export const mainstreamCompetitors = [
  { name: "Glean", classification: "Functional competitor", overlap: "Permission-aware enterprise search and connector synchronization", gap: "No publicly documented cross-vendor derivative repair plus affected-identity retrieval proof found in the reviewed scope." },
  { name: "Microsoft Azure AI Search", classification: "Functional competitor", overlap: "Document-level access control and SharePoint ingestion", gap: "Control is strongest inside the Azure search boundary." },
  { name: "Elastic", classification: "Functional competitor", overlap: "Connector access-control synchronization and document-level security", gap: "No reviewed evidence of independent cross-system reconciliation." },
  { name: "AppOmni", classification: "Adjacent platform", overlap: "Continuous SaaS identity, privilege, posture, and AI-agent governance", gap: "Focus is SaaS security posture rather than downstream AI derivative consistency." },
  { name: "BetterCloud", classification: "Adjacent platform", overlap: "Connected-app governance, lifecycle automation, cost controls", gap: "Not positioned as identity-aware AI retrieval assurance." },
  { name: "Noma Security", classification: "Emerging threat", overlap: "AI discovery, posture, runtime protection, governance, remediation guidance", gap: "No reviewed public evidence of Concord’s full source-change-to-retrieval-proof loop." },
  { name: "Zenity", classification: "Emerging threat", overlap: "Agent configuration, permissions, runtime enforcement, and response", gap: "Agent decision security is adjacent to derivative-state reconciliation." },
  { name: "Internal engineering", classification: "Substitute", overlap: "Custom webhooks, deletions, cache invalidation, and audit scripts", gap: "Usually fragmented, expensive to maintain, and hard to prove across systems." },
] as const;

export const radarCompanies = [
  { name: "Grip Security", priority: "Investigate Now" as RadarPriority, classification: "Emerging threat", verification: "Partially verified", whyMissed: "Repositioned from SaaS identity security toward an AI identity graph.", overlap: "Maps users, agents, applications, permissions, and data.", trigger: "Adds affected-identity retrieval testing or cross-derivative repair.", url: "https://www.grip.security/blog/ai-security-platform" },
  { name: "Token Security", priority: "Investigate Now" as RadarPriority, classification: "Emerging threat", verification: "Partially verified", whyMissed: "Categorized primarily as non-human identity security.", overlap: "Identity graph, agent lifecycle governance, and automated remediation.", trigger: "Adds authoritative content-change lineage or destination read-back proof.", url: "https://www.token.security/" },
  { name: "Saviynt Zuma", priority: "Monitor" as RadarPriority, classification: "Adjacent platform", verification: "Verified vendor positioning", whyMissed: "A new AI-identity product inside an established IGA vendor.", overlap: "Discovers and governs agents and authorizes actions.", trigger: "Adds cross-system derivative-state verification.", url: "https://saviynt.com/products/zuma" },
  { name: "ARMO", priority: "Monitor" as RadarPriority, classification: "Adjacent platform", verification: "Partially verified", whyMissed: "Cloud-runtime security company publishing an agent governance direction.", overlap: "Runtime governance and independent two-plane verification language.", trigger: "Ships supported enterprise SaaS/RAG connectors and remediation.", url: "https://www.armosec.io/blog/ai-agent-governance/" },
  { name: "ElixirData", priority: "Weak Signal" as RadarPriority, classification: "Emerging threat", verification: "Vendor claim only", whyMissed: "Small governance product described through technical thought leadership.", overlap: "Policy gates and decision traces for enterprise agents.", trigger: "Publishes production documentation, customers, connector coverage, and retrieval proof.", url: "https://www.elixirdata.co/blog/runtime-policy-enforcement-ai-agents" },
  { name: "Natoma", priority: "Weak Signal" as RadarPriority, classification: "Emerging threat", verification: "Vendor claim only", whyMissed: "AI-governance language without enough public product detail.", overlap: "Enterprise AI governance integrations and audit trails.", trigger: "Publishes a production control loop for permission or retention propagation.", url: "https://natoma.ai/glossary/what-is-an-ai-governance-platform" },
] as const;

export const crunchbaseScope = {
  access: "Unavailable in this environment",
  limitation:
    "No authorized Crunchbase Advanced Search, AI Search Builder, or Search API connection was available. No login or paywall was bypassed, and Crunchbase-only filters such as employee range, undisclosed funding status, investor graph, and full result counts could not be used.",
  searchThemes: ["permission propagation", "identity-aware retrieval", "RAG and agent security", "AI lineage and observability", "non-human identity", "continuous controls", "data and SaaS posture"],
  materialFilters: ["new product signals", "small or emerging vendors", "adjacent identity/security category", "workflow overlap", "official evidence available", "no funding requirement"],
  rawCandidates: 18,
  deduplicatedCandidates: 14,
  verifiedCandidates: 12,
  watchlistCandidates: radarCompanies.length,
} as const;
