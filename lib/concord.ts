export type CaseStatus = "Verified" | "Repairing" | "Exception";

export type ProofStep = {
  label: string;
  detail: string;
  state: "complete" | "active" | "blocked";
};

export type AssuranceCase = {
  id: string;
  event: string;
  principal: string;
  source: string;
  status: CaseStatus;
  coverage: number;
  exposure: string;
  artifacts: string;
  updated: string;
  risk: string;
  proofLevel: "L1" | "L2" | "L3";
  proof: ProofStep[];
};

export const readinessReport = {
  assessedOn: "2026-08-20",
  score: 31,
  verdict: "DESIGN-PARTNER STAGING ONLY",
  confidence: "Medium",
  basis:
    "Evidence-backed assessment of the product blueprint, current code, demo assets, and primary-source market documentation.",
  dimensions: [
    { label: "Product definition", score: 72, note: "Tightly bounded MVP and clear promise boundary." },
    { label: "Evidence integrity", score: 28, note: "Proof model exists; no production evidence pipeline yet." },
    { label: "Security & tenancy", score: 36, note: "Controls are specified, not independently validated." },
    { label: "Operations", score: 24, note: "No observed SLO, recovery, or on-call history." },
  ],
  gates: [
    "Connect a real BookStack staging fixture and map its effective permission behavior.",
    "Stress-test Zulip private-channel events, metadata visibility, and content visibility.",
    "Prove Pinecone and Redis reconciliation is idempotent under retries.",
    "Close a case only after identity-aware retrieval denial is observed.",
    "Pass the Linear black-box portability gate without redesigning the connector core.",
  ],
} as const;

export const cases: AssuranceCase[] = [
  {
    id: "CR-0841",
    event: "Permission revoked",
    principal: "A. Chen",
    source: "Board Strategy / FY27",
    status: "Verified",
    coverage: 100,
    exposure: "02:18",
    artifacts: "144 / 144",
    updated: "18s ago",
    risk: "Revoked identity returned zero registered artifacts.",
    proofLevel: "L3",
    proof: [
      { label: "Authority observed", detail: "Entra revocation linked to a registered SharePoint object.", state: "complete" },
      { label: "Derivatives reconciled", detail: "128 vector chunks and 16 cache keys read back as invalid.", state: "complete" },
      { label: "Behavior verified", detail: "Retrieval probe returned zero revoked artifacts.", state: "complete" },
    ],
  },
  {
    id: "CR-0842",
    event: "Group access removed",
    principal: "Finance Ops",
    source: "Pricing / Scenario C",
    status: "Repairing",
    coverage: 93,
    exposure: "07:14",
    artifacts: "87 / 94",
    updated: "41s ago",
    risk: "Seven stale semantic-cache keys remain quarantined.",
    proofLevel: "L2",
    proof: [
      { label: "Authority observed", detail: "SharePoint permission delta accepted and deduplicated.", state: "complete" },
      { label: "Vector state verified", detail: "All 82 registered Pinecone records read back clean.", state: "complete" },
      { label: "Cache retry active", detail: "Seven Redis keys are isolated while invalidation retries.", state: "active" },
    ],
  },
  {
    id: "CR-0843",
    event: "Direct grant removed",
    principal: "Vendor Reviewers",
    source: "Acquisition / Diligence",
    status: "Exception",
    coverage: 76,
    exposure: "12:46",
    artifacts: "38 / 50",
    updated: "2m ago",
    risk: "Twelve derivatives have no registered owner or repair adapter.",
    proofLevel: "L1",
    proof: [
      { label: "Authority observed", detail: "Permission removal is confirmed at the source.", state: "complete" },
      { label: "Coverage gap isolated", detail: "Unregistered derivatives are excluded from the guarantee.", state: "blocked" },
      { label: "Owner action required", detail: "Assign an adapter and rerun reconciliation.", state: "blocked" },
    ],
  },
];

export const integrations = [
  { name: "BookStack", role: "Structured knowledge source", state: "Foundation contract" },
  { name: "Zulip", role: "Messaging and permission stress test", state: "Foundation contract" },
  { name: "Pinecone", role: "Vector destination", state: "MVP contract" },
  { name: "Redis", role: "Cache destination", state: "MVP contract" },
  { name: "Linear", role: "Black-box SaaS validation", state: "Phase 2 planned" },
  { name: "SharePoint", role: "Enterprise knowledge target", state: "Roadmap" },
  { name: "Slack", role: "Enterprise messaging target", state: "Roadmap" },
  { name: "Jira", role: "Project-management target", state: "Roadmap" },
] as const;

type SimulationInput = {
  sourceId?: unknown;
  principalType?: unknown;
  vectorRecords?: unknown;
  cacheKeys?: unknown;
  proofEndpoint?: unknown;
};

function safeInteger(value: unknown, max: number, field: string) {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max) {
    throw new Error(`${field} must be an integer from 0 to ${max}.`);
  }
  return Number(value);
}

export function simulateRevocation(input: SimulationInput) {
  const sourceId = typeof input.sourceId === "string" ? input.sourceId.trim() : "";
  if (!sourceId || sourceId.length > 120) {
    throw new Error("sourceId must contain 1 to 120 characters.");
  }

  if (input.principalType !== "user" && input.principalType !== "group") {
    throw new Error("principalType must be user or group.");
  }

  const vectorRecords = safeInteger(input.vectorRecords, 10_000, "vectorRecords");
  const cacheKeys = safeInteger(input.cacheKeys, 1_000, "cacheKeys");
  const proofEndpoint = input.proofEndpoint === true;
  const total = vectorRecords + cacheKeys;

  return {
    mode: "simulation",
    writesPerformed: false,
    state: "Planned",
    sourceId,
    principalType: input.principalType,
    affectedArtifacts: total,
    expectedCoverage: proofEndpoint ? 100 : 84,
    approvalRequired: vectorRecords > 250,
    actions: [
      { adapter: "Pinecone", action: "quarantine + metadata invalidate", count: vectorRecords },
      { adapter: "Redis", action: "delete registered cache keys", count: cacheKeys },
      { adapter: "Retrieval API", action: proofEndpoint ? "identity-aware denial probe" : "manual proof required", count: 1 },
    ],
    exceptions: proofEndpoint ? [] : ["Behavioral retrieval endpoint is not registered."],
  };
}
