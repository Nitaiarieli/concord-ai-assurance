export const RESEARCH_AS_OF = "2026-08-21";

export const CENTRAL_HYPOTHESIS =
  "A limited Concord-managed control plane with a customer-hosted execution and data plane is the strongest default architecture; organizational content, credentials, repair execution, and retrieval verification remain inside the customer environment.";

export type DeploymentCriterion =
  | "security"
  | "promise"
  | "integration"
  | "enterprise"
  | "operations"
  | "performance"
  | "tco"
  | "timeToValue";

export type DeploymentAgentIntake = {
  targetCustomers: string;
  industries: string[];
  jurisdictions: string[];
  requiredClouds: string[];
  requireOnPrem: boolean;
  airGapped: boolean;
  priorityIntegrations: string[];
  prohibitedDataEgress: string[];
  availabilityTarget: string | null;
  rtoHours: number | null;
  rpoHours: number | null;
  supportExpectation: string;
  commercialModel: string;
  notes: string;
};

export type EvidenceRecord = {
  claim: string;
  classification: "verified_fact" | "vendor_claim" | "research_conclusion";
  sourceTitle: string;
  sourceUrl: string;
  sourceType: "official_documentation" | "regulation" | "standard";
  publishedAt: string | null;
  accessedAt: string;
  confidence: "High" | "Medium";
};

export const deploymentWeights: Record<DeploymentCriterion, number> = {
  security: 0.25,
  promise: 0.2,
  integration: 0.15,
  enterprise: 0.15,
  operations: 0.1,
  performance: 0.05,
  tco: 0.05,
  timeToValue: 0.05,
};

type DeploymentModel = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  commonArchitecture: string;
  customerProfile: string;
  baseScores: Record<DeploymentCriterion, number>;
  advantages: string[];
  limitations: string[];
  dataBoundary: string;
};

export type ScoredDeploymentModel = DeploymentModel & {
  eligible: boolean;
  score: number;
  scores: Record<DeploymentCriterion, number>;
  rationale: Record<DeploymentCriterion, string>;
  contraindications: string[];
};

const deploymentModels: DeploymentModel[] = [
  {
    id: "multi_tenant_saas",
    name: "Multi-tenant SaaS",
    shortName: "Shared SaaS",
    description: "Concord hosts the application and data plane in a shared, logically isolated service.",
    commonArchitecture: "Shared control, execution, persistence, and observability with tenant-scoped data and keys.",
    customerProfile: "Lower-sensitivity teams prioritizing fast activation and low operational ownership.",
    baseScores: { security: 2, promise: 3, integration: 4, enterprise: 3, operations: 5, performance: 5, tco: 5, timeToValue: 5 },
    advantages: ["Fast onboarding", "Centralized updates", "Lowest vendor cost to serve"],
    limitations: ["Content and credentials may cross the customer boundary", "Harder security review for sensitive repair permissions"],
    dataBoundary: "Customer content and execution may enter a Concord-managed tenant boundary.",
  },
  {
    id: "single_tenant_saas",
    name: "Dedicated single-tenant SaaS",
    shortName: "Dedicated SaaS",
    description: "Concord operates a dedicated service stack for each customer in a Concord-managed cloud account.",
    commonArchitecture: "Per-customer compute and storage with vendor-managed operations.",
    customerProfile: "Enterprise buyers requiring stronger isolation without operating the platform themselves.",
    baseScores: { security: 3, promise: 4, integration: 4, enterprise: 4, operations: 4, performance: 4, tco: 3, timeToValue: 4 },
    advantages: ["Stronger isolation", "Vendor-operated lifecycle", "Customer-specific scaling"],
    limitations: ["Vendor still holds sensitive credentials", "Higher cost to serve than shared SaaS"],
    dataBoundary: "Dedicated, but still vendor-controlled, data and execution boundary.",
  },
  {
    id: "customer_vpc",
    name: "Vendor-managed deployment in the customer VPC",
    shortName: "Customer VPC",
    description: "Concord operates its stack inside a customer-owned cloud network using delegated permissions.",
    commonArchitecture: "Vendor-managed workload, customer network and storage, private connectivity, scoped support access.",
    customerProfile: "Cloud-first enterprises with strict network and data-residency requirements.",
    baseScores: { security: 4, promise: 5, integration: 4, enterprise: 5, operations: 3, performance: 4, tco: 3, timeToValue: 3 },
    advantages: ["Customer network control", "Low-latency access to internal systems", "Supports private endpoints"],
    limitations: ["Complex delegated operations", "Support access and upgrade responsibility require precise contracts"],
    dataBoundary: "Data remains in the customer cloud; vendor operations cross a controlled administrative boundary.",
  },
  {
    id: "customer_hosted",
    name: "Customer-hosted private cloud",
    shortName: "Private cloud",
    description: "The customer deploys and operates the complete Concord stack in its cloud account.",
    commonArchitecture: "Customer-owned compute, persistence, secrets, logging, and update approval.",
    customerProfile: "Regulated enterprises willing to own platform operations.",
    baseScores: { security: 5, promise: 5, integration: 3, enterprise: 5, operations: 2, performance: 3, tco: 2, timeToValue: 2 },
    advantages: ["Maximum customer control", "Strong residency posture", "No standing vendor access required"],
    limitations: ["Slow upgrades", "High customer operational load", "Limited vendor observability"],
    dataBoundary: "All content, credentials, execution, and operational evidence remain customer controlled.",
  },
  {
    id: "hybrid_control_data_plane",
    name: "Hybrid Concord control plane and customer data plane",
    shortName: "Hybrid boundary",
    description: "Concord manages fleet policy and minimized telemetry while a customer-hosted runtime performs sensitive reads, repairs, verification, and evidence capture.",
    commonArchitecture: "Vendor control plane plus outbound-only customer data plane, customer vault, local lineage, local execution, and minimized evidence exchange.",
    customerProfile: "Enterprise AI teams that need fast operations without moving organizational content or credentials outside their environment.",
    baseScores: { security: 5, promise: 5, integration: 5, enterprise: 5, operations: 4, performance: 4, tco: 4, timeToValue: 4 },
    advantages: ["Sensitive actions stay local", "Central policy and fleet management", "Supports private and regulated variants"],
    limitations: ["Requires a signed customer runtime", "Split-plane troubleshooting needs privacy-safe telemetry"],
    dataBoundary: "Content, credentials, lineage payloads, repair execution, and retrieval probes remain in the customer environment by default.",
  },
  {
    id: "on_premises",
    name: "On-premises deployment",
    shortName: "On-premises",
    description: "The customer deploys the Concord stack within its own datacenter or private infrastructure.",
    commonArchitecture: "Customer-operated cluster, local persistence and vault, controlled update channel.",
    customerProfile: "Organizations with mandatory datacenter deployment or restricted cloud use.",
    baseScores: { security: 5, promise: 4, integration: 3, enterprise: 5, operations: 2, performance: 3, tco: 2, timeToValue: 1 },
    advantages: ["Local control", "Supports internal-only systems", "Strong physical and network boundary"],
    limitations: ["Long implementation", "Environment fragmentation", "Customer-owned availability"],
    dataBoundary: "All product data and execution stay within customer infrastructure.",
  },
  {
    id: "air_gapped",
    name: "Air-gapped customer deployment",
    shortName: "Air-gapped",
    description: "The customer runs Concord without network connectivity to the Concord control plane or public services.",
    commonArchitecture: "Offline release bundles, local license policy, customer-only observability and evidence storage.",
    customerProfile: "Defense, critical infrastructure, or other disconnected environments.",
    baseScores: { security: 5, promise: 3, integration: 2, enterprise: 5, operations: 1, performance: 2, tco: 1, timeToValue: 1 },
    advantages: ["No runtime egress", "Customer-only secrets and evidence", "Strong isolation"],
    limitations: ["Manual updates", "Limited support", "External SaaS connectors may be impossible"],
    dataBoundary: "No runtime data leaves the isolated customer environment.",
  },
];

export const deploymentEvidence: EvidenceRecord[] = [
  {
    claim: "PrivateLink-style services can expose services through private endpoints without requiring public internet paths.",
    classification: "verified_fact",
    sourceTitle: "AWS PrivateLink concepts",
    sourceUrl: "https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html",
    sourceType: "official_documentation",
    publishedAt: null,
    accessedAt: RESEARCH_AS_OF,
    confidence: "High",
  },
  {
    claim: "Azure Private Link provides private endpoint connectivity to supported services over the Microsoft backbone.",
    classification: "verified_fact",
    sourceTitle: "Azure Private Link overview",
    sourceUrl: "https://learn.microsoft.com/en-us/azure/private-link/private-link-overview",
    sourceType: "official_documentation",
    publishedAt: null,
    accessedAt: RESEARCH_AS_OF,
    confidence: "High",
  },
  {
    claim: "Microsoft Graph change notifications can notify subscribers about supported resource changes and require lifecycle handling.",
    classification: "verified_fact",
    sourceTitle: "Microsoft Graph change notifications overview",
    sourceUrl: "https://learn.microsoft.com/en-us/graph/change-notifications-overview",
    sourceType: "official_documentation",
    publishedAt: null,
    accessedAt: RESEARCH_AS_OF,
    confidence: "High",
  },
  {
    claim: "Pinecone supports deletion by identifiers and, for supported configurations, metadata filters; repair plans must respect product and index limitations.",
    classification: "vendor_claim",
    sourceTitle: "Pinecone delete data guide",
    sourceUrl: "https://docs.pinecone.io/guides/manage-data/delete-data",
    sourceType: "official_documentation",
    publishedAt: null,
    accessedAt: RESEARCH_AS_OF,
    confidence: "High",
  },
  {
    claim: "Redis DEL removes named keys; Concord still needs application-level read-back and retrieval verification before declaring repair complete.",
    classification: "research_conclusion",
    sourceTitle: "Redis DEL command",
    sourceUrl: "https://redis.io/docs/latest/commands/del/",
    sourceType: "official_documentation",
    publishedAt: null,
    accessedAt: RESEARCH_AS_OF,
    confidence: "High",
  },
  {
    claim: "GDPR data-minimization and storage-limitation principles support keeping organizational content out of the vendor plane when it is not necessary for the service purpose.",
    classification: "research_conclusion",
    sourceTitle: "General Data Protection Regulation",
    sourceUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    sourceType: "regulation",
    publishedAt: "2016-04-27",
    accessedAt: RESEARCH_AS_OF,
    confidence: "High",
  },
  {
    claim: "NIST CSF 2.0 and the NIST AI RMF are voluntary frameworks, not certifications or proof that Concord is compliant.",
    classification: "verified_fact",
    sourceTitle: "NIST Cybersecurity Framework 2.0",
    sourceUrl: "https://www.nist.gov/cyberframework",
    sourceType: "standard",
    publishedAt: "2024-02-26",
    accessedAt: RESEARCH_AS_OF,
    confidence: "High",
  },
];

const defaultIntegrations = ["SharePoint", "Microsoft Entra", "Pinecone", "Redis"];

function stringList(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 16);
}

function boundedText(value: unknown, fallback: string, max = 600) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

function nullableHours(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 720 ? number : null;
}

export function normalizeDeploymentAgentIntake(value: unknown): DeploymentAgentIntake {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const prohibitedDataEgress = stringList(input.prohibitedDataEgress, [
    "Organizational content",
    "Credentials and API tokens",
    "Embeddings and AI-derived payloads",
  ]);
  return {
    targetCustomers: boundedText(input.targetCustomers, "Enterprise AI platform, security, and data teams"),
    industries: stringList(input.industries, ["Enterprise software", "Cybersecurity"]),
    jurisdictions: stringList(input.jurisdictions, ["United States", "European Union", "Israel"]),
    requiredClouds: stringList(input.requiredClouds, ["AWS", "Azure", "Google Cloud"]),
    requireOnPrem: input.requireOnPrem === true,
    airGapped: input.airGapped === true,
    priorityIntegrations: stringList(input.priorityIntegrations, defaultIntegrations),
    prohibitedDataEgress: prohibitedDataEgress.length ? prohibitedDataEgress : ["Organizational content", "Credentials and API tokens"],
    availabilityTarget: boundedText(input.availabilityTarget, "", 80) || null,
    rtoHours: nullableHours(input.rtoHours),
    rpoHours: nullableHours(input.rpoHours),
    supportExpectation: boundedText(input.supportExpectation, "Enterprise business-hours support during the design-partner pilot", 300),
    commercialModel: boundedText(input.commercialModel, "Connected application instances plus organization-level unique protected users; first application fee is $0", 300),
    notes: boundedText(input.notes, "Unknown requirements remain explicit and must be validated with design partners.", 1200),
  };
}

function clampScore(value: number) {
  return Math.max(1, Math.min(5, value));
}

function weightedScore(scores: Record<DeploymentCriterion, number>, weights = deploymentWeights) {
  return Number((Object.entries(weights) as Array<[DeploymentCriterion, number]>).reduce((total, [criterion, weight]) => total + scores[criterion] * weight, 0).toFixed(2));
}

function modelEligibility(model: DeploymentModel, intake: DeploymentAgentIntake) {
  const contraindications: string[] = [];
  if (intake.airGapped && model.id !== "air_gapped") contraindications.push("The intake requires a disconnected runtime.");
  if (intake.requireOnPrem && !["hybrid_control_data_plane", "customer_hosted", "on_premises", "air_gapped"].includes(model.id)) {
    contraindications.push("The intake requires an on-premises-capable data plane.");
  }
  if (intake.prohibitedDataEgress.some((item) => /content|credential|embedding/i.test(item)) && ["multi_tenant_saas", "single_tenant_saas"].includes(model.id)) {
    contraindications.push("The default service boundary conflicts with prohibited data-egress requirements.");
  }
  return contraindications;
}

function dynamicScores(model: DeploymentModel, intake: DeploymentAgentIntake) {
  const scores = { ...model.baseScores };
  if (intake.requireOnPrem && ["hybrid_control_data_plane", "customer_hosted", "on_premises"].includes(model.id)) scores.enterprise = clampScore(scores.enterprise + 0.25);
  if (intake.priorityIntegrations.some((item) => /sharepoint|entra|pinecone|redis/i.test(item)) && model.id === "hybrid_control_data_plane") scores.integration = 5;
  if (intake.jurisdictions.some((item) => /europe|eu|germany|france/i.test(item)) && ["customer_hosted", "hybrid_control_data_plane", "customer_vpc"].includes(model.id)) scores.security = clampScore(scores.security + 0.15);
  return scores;
}

function criterionRationale(model: DeploymentModel, criterion: DeploymentCriterion, score: number) {
  const labels: Record<DeploymentCriterion, string> = {
    security: "data sovereignty and least-privilege boundary",
    promise: "ability to trace, repair, read back, and verify",
    integration: "connector and private-network feasibility",
    enterprise: "procurement, residency, and isolation readiness",
    operations: "upgrade, support, and observability burden",
    performance: "latency and scale near customer systems",
    tco: "combined Concord and customer operating cost",
    timeToValue: "implementation speed and activation complexity",
  };
  return `${score.toFixed(2)}/5 for ${labels[criterion]} in the ${model.shortName} model.`;
}

export function scoreDeploymentOptions(intakeInput: DeploymentAgentIntake, weights = deploymentWeights): ScoredDeploymentModel[] {
  return deploymentModels.map((model) => {
    const contraindications = modelEligibility(model, intakeInput);
    const scores = dynamicScores(model, intakeInput);
    const rationale = Object.fromEntries((Object.keys(scores) as DeploymentCriterion[]).map((criterion) => [criterion, criterionRationale(model, criterion, scores[criterion])])) as Record<DeploymentCriterion, string>;
    return { ...model, eligible: contraindications.length === 0, score: weightedScore(scores, weights), scores, rationale, contraindications };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}

export function runSensitivityAnalysis(intake: DeploymentAgentIntake, baseline: ScoredDeploymentModel[]) {
  const baselineWinner = baseline.find((option) => option.eligible)?.id ?? null;
  const scenarios: Array<{ label: string; winner: string | null; score: number | null }> = [];
  for (const criterion of Object.keys(deploymentWeights) as DeploymentCriterion[]) {
    for (const factor of [0.8, 1.2]) {
      const raw = { ...deploymentWeights, [criterion]: deploymentWeights[criterion] * factor };
      const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
      const normalized = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value / total])) as Record<DeploymentCriterion, number>;
      const winner = scoreDeploymentOptions(intake, normalized).find((option) => option.eligible) ?? null;
      scenarios.push({ label: `${criterion} ${factor === 0.8 ? "−20%" : "+20%"}`, winner: winner?.id ?? null, score: winner?.score ?? null });
    }
  }
  return {
    stable: Boolean(baselineWinner) && scenarios.every((scenario) => scenario.winner === baselineWinner),
    baselineWinner,
    scenarios,
  };
}

export function runDeploymentResearch(intake: DeploymentAgentIntake) {
  return {
    asOf: RESEARCH_AS_OF,
    researchMode: "maintained_primary_source_registry",
    liveDiscoveryConfigured: false,
    limitation: "This deployed release evaluates a dated primary-source evidence registry. A separately approved research provider is required for unattended internet discovery; no live-research claim is made.",
    models: deploymentModels.map((model) => ({ ...model })),
    evidence: deploymentEvidence,
    scope: {
      targetCustomers: intake.targetCustomers,
      jurisdictions: intake.jurisdictions,
      deploymentModelsReviewed: deploymentModels.length,
      materialSources: deploymentEvidence.length,
    },
  };
}

export function runProductAnalysis(intake: DeploymentAgentIntake) {
  const connectors = [...new Set([...defaultIntegrations, ...intake.priorityIntegrations])];
  return {
    productPromise: "When an authoritative source, permission, identity, or validity state changes, Concord traces every registered affected derivative, repairs invalid state, verifies the actual retrieval outcome, and preserves evidence.",
    guaranteeBoundary: "Registered artifacts and supported adapters only; no claim is made for unregistered derivatives.",
    canonicalMvpEvent: "Permission revocation",
    components: [
      { name: "Enterprise connectors", needsContent: "Transiently when the source API requires it", credentials: "Scoped customer credential", failure: "Stop and quarantine" },
      { name: "Event normalizer", needsContent: "No", credentials: "None beyond signed event validation", failure: "Deduplicate and reconcile" },
      { name: "Lineage registry", needsContent: "No by default", credentials: "None", failure: "Coverage gap remains explicit" },
      { name: "Policy and impact engine", needsContent: "Metadata only", credentials: "None", failure: "Fail closed for affected registered state" },
      { name: "Repair executor", needsContent: "Artifact identifiers and repair payload only", credentials: "Destination-scoped write credential", failure: "Retry idempotently; never mark verified" },
      { name: "Verification runner", needsContent: "Synthetic or authorized retrieval response", credentials: "Affected-user or test-principal token", failure: "Classify as partial, inferred, or unsupported" },
      { name: "Evidence store", needsContent: "Hashes, outcomes, references; not source content by default", credentials: "Customer-managed storage role", failure: "Case cannot close" },
    ],
    dataClasses: [
      { name: "Organizational content", defaultBoundary: "Customer environment", control: "Transient processing only when unavoidable" },
      { name: "Credentials and secrets", defaultBoundary: "Customer vault", control: "Never sent to Concord control plane" },
      { name: "ACLs and identities", defaultBoundary: "Customer data plane", control: "Minimized identifiers only when explicitly allowed" },
      { name: "Lineage metadata", defaultBoundary: "Customer data plane", control: "Hashed references may be exported" },
      { name: "Evidence", defaultBoundary: "Customer evidence store", control: "Outcome and integrity metadata may be exported" },
    ],
    connectorContracts: connectors.map((name) => ({
      name,
      instanceRule: "Every workspace, site, tenant, account, or index is an independent application instance.",
      requiredFields: ["authentication", "scopes", "events or polling", "read operations", "repair actions", "rate limits", "token lifecycle", "read-back", "affected-user verification", "idempotency", "evidence", "API version", "residency"],
      verificationClass: /sharepoint|entra|pinecone|redis/i.test(name) ? "Contract required before pilot activation" : "Unsupported until connector contract is validated",
    })),
    assumptionsTested: [
      { assumption: "Out-of-band first phase", result: "Retain", reason: "Reduces inline availability risk during the MVP." },
      { assumption: "Open SDK or sidecar lineage registration", result: "Retain with signing", reason: "Coverage must be registered and attributable." },
      { assumption: "SharePoint + Entra → Pinecone + Redis MVP", result: "Retain as design-partner scope", reason: "It exercises authority, identity, vector, cache, and retrieval proof boundaries." },
      { assumption: "Concord replaces IAM", result: "Reject", reason: "Concord consumes authoritative state; it does not become the identity authority." },
    ],
  };
}

export function buildDeploymentRecommendation(intake: DeploymentAgentIntake) {
  const options = scoreDeploymentOptions(intake);
  const eligible = options.filter((option) => option.eligible);
  const primary = eligible[0];
  if (!primary) throw new Error("No deployment model satisfies the mandatory requirements.");
  const sensitivity = runSensitivityAnalysis(intake, options);
  const alternative = primary.id === "air_gapped"
    ? options.find((option) => option.id === "on_premises")!
    : options.find((option) => option.id === "customer_hosted")!;
  const unknowns = [
    intake.availabilityTarget ? null : "Availability target is not approved.",
    intake.rtoHours === null ? "RTO target is not approved." : null,
    intake.rpoHours === null ? "RPO target is not approved." : null,
  ].filter((item): item is string => Boolean(item));
  const componentPlacement = primary.id === "air_gapped" ? [
    { component: "Complete Concord stack", location: "Air-gapped customer environment", data: "All content, credentials, policy, execution, evidence, and observability" },
    { component: "Release service", location: "Offline signed distribution channel", data: "Versioned binaries, SBOM, signatures, and release notes only" },
  ] : [
    { component: "Fleet and policy control", location: "Concord-managed control plane", data: "Tenant identifiers, policy versions, signed release metadata, health summaries" },
    { component: "Connector and event runtime", location: "Customer execution plane", data: "Source events, ACLs, identities, and scoped credentials" },
    { component: "Lineage and impact engine", location: "Customer data plane", data: "Artifact identifiers, lineage graph, policies, and affected principals" },
    { component: "Repair and verification", location: "Customer data plane", data: "Repair operations, read-back, and affected-user retrieval probes" },
    { component: "Evidence store", location: "Customer-controlled storage", data: "Evidence payloads, hashes, outcomes, and retention policy" },
    { component: "Evidence index", location: "Concord-managed control plane, optional", data: "Minimized outcome, timestamp, pseudonymous reference, integrity hash" },
  ];
  return {
    decisionType: unknowns.length ? "Conditional Recommendation" : "Final Recommendation",
    primary,
    alternative,
    options,
    sensitivity,
    hypothesisResult: primary.id === "hybrid_control_data_plane" ? "Not disproved by the current evidence and mandatory constraints" : "Disproved for this intake",
    confidence: unknowns.length ? "Medium-High" : "High",
    unknowns,
    componentPlacement,
    trustBoundaries: [
      "Concord service boundary",
      "Customer execution and data boundary",
      "Enterprise application boundary",
      "Customer identity and secrets boundary",
      "Optional private-connectivity boundary",
    ],
    allowedControlPlaneData: ["Tenant and application-instance identifiers", "Policy and runtime version", "Aggregated health state", "Minimized evidence outcome and integrity hash", "Billing and entitlement counters"],
    customerOnlyData: intake.prohibitedDataEgress,
    updateModel: "Signed, version-pinned customer runtime releases with staged rollout, SBOM, rollback, and customer-controlled maintenance windows.",
    onboardingModel: "Register tenant → deploy customer runtime → bind customer vault → validate connector contracts → establish baseline → run shadow-mode revocation exercise → approve production repair policy.",
  };
}

export type AuditFinding = {
  severity: "Critical" | "High" | "Medium" | "Low";
  component: string;
  risk: string;
  remediation: string;
  owner: string;
  validationMethod: string;
  status: "open" | "closed_by_design";
};

export function auditDeploymentRecommendation(intake: DeploymentAgentIntake, recommendation: ReturnType<typeof buildDeploymentRecommendation>) {
  const findings: AuditFinding[] = [];
  if (["multi_tenant_saas", "single_tenant_saas"].includes(recommendation.primary.id) && intake.prohibitedDataEgress.some((item) => /content|credential|embedding/i.test(item))) {
    findings.push({ severity: "High", component: "Deployment boundary", risk: "The proposed vendor plane could receive data explicitly prohibited from leaving the customer environment.", remediation: "Move sensitive connectors, credentials, repair, verification, and evidence payloads into a customer-hosted plane.", owner: "Chief Architect", validationMethod: "Data-flow review plus egress-deny integration test", status: "open" });
  }
  if (intake.airGapped && recommendation.primary.id !== "air_gapped") {
    findings.push({ severity: "Critical", component: "Network architecture", risk: "The architecture requires connectivity that the intake prohibits.", remediation: "Use an offline customer deployment and signed release-bundle process.", owner: "Security Architecture", validationMethod: "Disconnected installation and upgrade exercise", status: "open" });
  }
  findings.push({
    severity: "Medium",
    component: "Verification runner",
    risk: "Not every enterprise application can execute a retrieval probe as the affected identity; unsupported connectors could be overstated as fully verified.",
    remediation: "Enforce the four-level verification classification and block case closure when the contracted level is not achieved.",
    owner: "Connector Platform",
    validationMethod: "Connector contract test suite and negative retrieval fixture",
    status: "closed_by_design",
  });
  findings.push({
    severity: "Medium",
    component: "Customer runtime supply chain",
    risk: "A privileged repair runtime creates supply-chain and update-channel risk.",
    remediation: "Require signed artifacts, SBOM, provenance, pinning, staged rollout, rollback, and customer approval windows.",
    owner: "Platform Security",
    validationMethod: "Signature rejection, rollback, and compromised-release tabletop tests",
    status: "closed_by_design",
  });
  if (intake.rtoHours === null || intake.rpoHours === null || !intake.availabilityTarget) {
    findings.push({
      severity: "Medium",
      component: "Reliability",
      risk: "Availability, RTO, or RPO targets are not approved, so disaster-recovery readiness cannot be accepted as final.",
      remediation: "Approve service targets with a design partner, map dependencies, and run restoration evidence before GA.",
      owner: "SRE and Product",
      validationMethod: "Restore test, regional failure exercise, and signed SLO review",
      status: "open",
    });
  }
  findings.push({
    severity: "Low",
    component: "Compliance program",
    risk: "Desk research cannot establish certification or legal compliance.",
    remediation: "Maintain control mappings and evidence, obtain legal review where required, and use an independent auditor for certification.",
    owner: "Security and Legal",
    validationMethod: "Legal sign-off and external audit scope",
    status: "open",
  });
  const blocking = findings.filter((finding) => finding.status === "open" && ["Critical", "High"].includes(finding.severity));
  return {
    outcome: blocking.length ? "Rejected — Revision Required" : findings.some((finding) => finding.status === "open") ? "Approved with Conditions" : "Approved",
    independentGate: true,
    cycle: 0,
    blockingFindings: blocking.length,
    findings,
    complianceStatement: "This is a control mapping and gap analysis. It is not a claim that Concord is compliant or certified.",
  };
}

export function reviseRejectedRecommendation(intake: DeploymentAgentIntake, recommendation: ReturnType<typeof buildDeploymentRecommendation>) {
  const revisedIntake = {
    ...intake,
    requireOnPrem: true,
    airGapped: intake.airGapped,
    prohibitedDataEgress: [...new Set([...intake.prohibitedDataEgress, "Organizational content", "Credentials and API tokens", "Embeddings and AI-derived payloads"])],
  };
  const revised = buildDeploymentRecommendation(revisedIntake);
  return {
    ...revised,
    revisionReason: `The independent gate rejected ${recommendation.primary.name}; sensitive execution and data were moved behind the customer boundary.`,
    revisionCount: 1,
  };
}

export function buildDecisionDossier(
  intake: DeploymentAgentIntake,
  research: ReturnType<typeof runDeploymentResearch>,
  product: ReturnType<typeof runProductAnalysis>,
  recommendation: ReturnType<typeof buildDeploymentRecommendation>,
  audit: ReturnType<typeof auditDeploymentRecommendation>,
) {
  const sections = [
    ["Executive Decision", `${recommendation.decisionType}: ${recommendation.primary.name}. Confidence: ${recommendation.confidence}.`],
    ["Product Scope and Assumptions", `${product.canonicalMvpEvent}; ${product.guaranteeBoundary}`],
    ["Research Methodology", `${research.researchMode}; ${research.limitation}`],
    ["Concord Component Architecture", recommendation.componentPlacement.map((row) => `${row.component}: ${row.location}`).join("; ")],
    ["Data Classification and Data Flows", product.dataClasses.map((row) => `${row.name} → ${row.defaultBoundary}`).join("; ")],
    ["Deployment Models Researched", `${research.models.length} models reviewed: ${research.models.map((model) => model.name).join(", ")}.`],
    ["Market Examples and Deployment Patterns", `Private endpoint, customer-VPC, private-cloud, on-premises, hybrid-plane, and air-gapped patterns were compared.`],
    ["Weighted Comparison Matrix", recommendation.options.map((option) => `${option.shortName} ${option.score.toFixed(2)}/5${option.eligible ? "" : " (ineligible)"}`).join("; ")],
    ["Sensitivity Analysis", recommendation.sensitivity.stable ? "The winner remains unchanged across every ±20% single-weight test." : "The decision is unstable under the defined sensitivity tests."],
    ["Recommended Deployment Architecture", `${recommendation.primary.description} The central hypothesis was ${recommendation.hypothesisResult.toLowerCase()}.`],
    ["Customer-Hosted and Concord-Hosted Components", recommendation.componentPlacement.map((row) => `${row.location}: ${row.component}`).join("; ")],
    ["Trust Boundaries", recommendation.trustBoundaries.join("; ")],
    ["Enterprise Integration Model", "Outbound-only customer runtime where possible; private endpoints or peering when required; every instance has its own contract and health state."],
    ["Connector Contract for Each Application", `${product.connectorContracts.length} connector contracts are required. Unsupported verification is never upgraded to full verification.`],
    ["Identity, Permission, and Verification Model", "Source identity remains authoritative. Verification is fully verified, partially verified, technically inferred, or unsupported."],
    ["Repair Execution Model", "Plan first, enforce approval policy, execute idempotently with scoped credentials, read back destination state, then run retrieval proof."],
    ["Evidence and Audit Model", "Customer evidence store is authoritative; minimized outcomes and integrity hashes may be exported when policy allows."],
    ["Security Architecture and Threat Model", audit.findings.map((finding) => `${finding.severity}: ${finding.component}`).join("; ")],
    ["Privacy, Regulation, and Compliance Mapping", audit.complianceStatement],
    ["Operational Model, Updates, and Customer Support", `${recommendation.updateModel} ${intake.supportExpectation}`],
    ["Scalability, Availability, RTO, and RPO", `Availability ${intake.availabilityTarget ?? "unknown"}; RTO ${intake.rtoHours ?? "unknown"}; RPO ${intake.rpoHours ?? "unknown"}.`],
    ["Estimated TCO and Commercial Implications", `${intake.commercialModel}. Private and air-gapped profiles require separate implementation and support packages.`],
    ["Implementation Roadmap", "1) Contract the MVP connectors. 2) Deploy a customer runtime. 3) Register lineage. 4) run shadow-mode revocation. 5) close verification and recovery gates. 6) expand only with evidence."],
    ["Risks, Gaps, and Open Decisions", [...recommendation.unknowns, ...audit.findings.filter((finding) => finding.status === "open").map((finding) => finding.risk)].join("; ") || "No unresolved decision recorded."],
    ["Independent Audit Result", `${audit.outcome}. ${audit.blockingFindings} unresolved Critical or High findings.`],
    ["Evidence and Sources Appendix", research.evidence.map((item) => `${item.sourceTitle} — ${item.sourceUrl}`).join("\n")],
  ].map(([title, content], index) => ({ number: index + 1, title, content }));
  return {
    title: "Concord Enterprise Deployment & Integration Decision Dossier",
    generatedAt: new Date().toISOString(),
    researchAsOf: research.asOf,
    recommendation: recommendation.primary.name,
    confidence: recommendation.confidence,
    auditOutcome: audit.outcome,
    sections,
  };
}

export function dossierToMarkdown(dossier: ReturnType<typeof buildDecisionDossier>) {
  return `# ${dossier.title}\n\nGenerated: ${dossier.generatedAt}\nResearch as of: ${dossier.researchAsOf}\n\n${dossier.sections.map((section) => `## ${section.number}. ${section.title}\n\n${section.content}`).join("\n\n")}`;
}
