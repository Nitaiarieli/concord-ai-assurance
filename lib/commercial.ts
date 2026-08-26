export type PriceBookStatus = "draft" | "approved" | "retired";

export type PriceBook = {
  id: string;
  version: number;
  status: PriceBookStatus;
  currency: string;
  freeApplicationCount: number;
  includedProtectedUsers: number;
  additionalApplicationFeeMinor: number;
  annualDiscountBps: number;
  protectedUserTiers: Array<{ upTo: number | null; unitFeeMinor: number }>;
  effectiveFrom: string;
  approvedAt: string | null;
};

export type ApplicationMeter = {
  id: string;
  environment: "production" | "sandbox" | "staging";
  status: "connected" | "pending" | "disconnected" | "deleted";
  parentProductionId?: string | null;
};

export type IdentityRecord = {
  applicationId: string;
  externalUserId: string;
  email?: string | null;
  idpSubject?: string | null;
  kind: "human" | "guest" | "bot" | "service_account" | "ai_agent";
  lifecycle: "active" | "inactive" | "deactivated";
  hasEffectiveProtectedAccess: boolean;
  mappingVerified: boolean;
};

export type ValueEvent = {
  id: string;
  classification: "verified_financial" | "estimated_operational" | "cost_avoidance" | "risk_exposure";
  amountMinor: number | null;
  currency: string;
  hoursSaved?: number | null;
  approvedHourlyRateMinor?: number | null;
  evidenceId?: string | null;
  assumptionApproved?: boolean;
};

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer.`);
}

export function countBillableApplications(applications: ApplicationMeter[]) {
  return applications.filter((app) => {
    if (app.status === "deleted" || app.status === "pending") return false;
    if (app.environment === "production") return true;
    return !app.parentProductionId;
  }).length;
}

function tieredUserCharge(users: number, tiers: PriceBook["protectedUserTiers"]) {
  let remaining = users;
  let lowerBound = 0;
  let total = 0;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const tierCapacity = tier.upTo === null ? remaining : Math.max(0, tier.upTo - lowerBound);
    const quantity = Math.min(remaining, tierCapacity);
    total += quantity * tier.unitFeeMinor;
    remaining -= quantity;
    if (tier.upTo !== null) lowerBound = tier.upTo;
  }
  if (remaining > 0) throw new Error("Price book tiers do not cover the protected-user quantity.");
  return total;
}

export function calculateBillingEstimate(args: {
  applications: ApplicationMeter[];
  uniqueProtectedUsers: number;
  cadence: "monthly" | "annual";
  priceBook: PriceBook;
  allowDraft?: boolean;
}) {
  assertNonNegativeInteger(args.uniqueProtectedUsers, "uniqueProtectedUsers");
  if (args.priceBook.status !== "approved" && !args.allowDraft) {
    return {
      available: false as const,
      reason: "No founder-approved public price book is active.",
      firstApplicationFeeMinor: 0,
      currency: args.priceBook.currency,
    };
  }
  const billableApplications = countBillableApplications(args.applications);
  const chargedApplications = Math.max(0, billableApplications - args.priceBook.freeApplicationCount);
  const applicationFeesMinor = chargedApplications * args.priceBook.additionalApplicationFeeMinor;
  const chargeableUsers = Math.max(0, args.uniqueProtectedUsers - args.priceBook.includedProtectedUsers);
  const protectedUserFeesMinor = tieredUserCharge(chargeableUsers, args.priceBook.protectedUserTiers);
  const monthlySubtotalMinor = applicationFeesMinor + protectedUserFeesMinor;
  const annualBeforeDiscountMinor = monthlySubtotalMinor * 12;
  const annualDiscountMinor =
    args.cadence === "annual"
      ? Math.round((annualBeforeDiscountMinor * args.priceBook.annualDiscountBps) / 10_000)
      : 0;
  return {
    available: true as const,
    currency: args.priceBook.currency,
    billableApplications,
    freeApplications: Math.min(billableApplications, args.priceBook.freeApplicationCount),
    chargedApplications,
    uniqueProtectedUsers: args.uniqueProtectedUsers,
    includedProtectedUsers: args.priceBook.includedProtectedUsers,
    chargeableUsers,
    applicationFeesMinor,
    protectedUserFeesMinor,
    monthlySubtotalMinor,
    annualBeforeDiscountMinor,
    annualDiscountMinor,
    estimatedAnnualTotalMinor: annualBeforeDiscountMinor - annualDiscountMinor,
    priceBookVersion: args.priceBook.version,
    hypothesis: args.priceBook.status !== "approved",
  };
}

export function deduplicateProtectedIdentities(records: IdentityRecord[]) {
  const counted = new Map<string, IdentityRecord>();
  const excluded: Array<{ record: IdentityRecord; reason: string }> = [];
  const duplicates: Array<{ record: IdentityRecord; matchedKey: string }> = [];

  for (const record of records) {
    if (!["human", "guest"].includes(record.kind)) {
      excluded.push({ record, reason: `${record.kind} is metered separately and is not a protected human.` });
      continue;
    }
    if (record.lifecycle === "deactivated" || !record.hasEffectiveProtectedAccess) {
      excluded.push({ record, reason: "No effective protected access exists in this billing period." });
      continue;
    }
    const normalizedEmail = record.email?.trim().toLowerCase();
    const key = record.mappingVerified && record.idpSubject
      ? `idp:${record.idpSubject}`
      : record.mappingVerified && normalizedEmail
        ? `email:${normalizedEmail}`
        : `source:${record.applicationId}:${record.externalUserId}`;
    if (counted.has(key)) duplicates.push({ record, matchedKey: key });
    else counted.set(key, record);
  }

  return {
    uniqueProtectedUsers: counted.size,
    counted: [...counted.entries()].map(([identityKey, record]) => ({ identityKey, record })),
    duplicates,
    excluded,
    methodology:
      "Verified IdP subject first, verified normalized email second, source-specific identity otherwise. Humans and guests with effective protected access count once; deactivated identities, bots, service accounts, and AI agents do not.",
  };
}

export function calculateFinOpsValue(args: {
  events: ValueEvent[];
  concordFeesMinor: number | null;
  concordOperatingCostMinor: number | null;
  currency: string;
}) {
  const sameCurrency = args.events.filter((event) => event.currency === args.currency);
  const verified = sameCurrency.filter(
    (event) => event.classification === "verified_financial" && event.amountMinor !== null && Boolean(event.evidenceId),
  );
  const operational = sameCurrency.filter(
    (event) =>
      event.classification === "estimated_operational" &&
      event.assumptionApproved &&
      event.hoursSaved != null &&
      event.approvedHourlyRateMinor != null,
  );
  const avoidance = sameCurrency.filter(
    (event) => event.classification === "cost_avoidance" && event.amountMinor !== null && Boolean(event.evidenceId),
  );
  const risk = sameCurrency.filter((event) => event.classification === "risk_exposure");
  const verifiedFinancialValueMinor = verified.reduce((sum, event) => sum + (event.amountMinor ?? 0), 0);
  const estimatedOperationalValueMinor = operational.reduce(
    (sum, event) => sum + Math.round((event.hoursSaved ?? 0) * (event.approvedHourlyRateMinor ?? 0)),
    0,
  );
  const costAvoidanceMinor = avoidance.reduce((sum, event) => sum + (event.amountMinor ?? 0), 0);
  const costsAvailable = args.concordFeesMinor !== null && args.concordOperatingCostMinor !== null;
  const totalConcordCostMinor = costsAvailable
    ? (args.concordFeesMinor ?? 0) + (args.concordOperatingCostMinor ?? 0)
    : null;
  const netVerifiedValueMinor = totalConcordCostMinor === null
    ? null
    : verifiedFinancialValueMinor - totalConcordCostMinor;
  const roiPercent = totalConcordCostMinor && netVerifiedValueMinor !== null
    ? (netVerifiedValueMinor / totalConcordCostMinor) * 100
    : null;

  return {
    currency: args.currency,
    verifiedFinancialValueMinor: verified.length ? verifiedFinancialValueMinor : null,
    estimatedOperationalValueMinor: operational.length ? estimatedOperationalValueMinor : null,
    costAvoidanceMinor: avoidance.length ? costAvoidanceMinor : null,
    riskScenarioCount: risk.length,
    totalConcordCostMinor,
    netVerifiedValueMinor,
    roiPercent,
    evidenceCoverage: {
      verifiedEvents: verified.length,
      eligibleEvents: sameCurrency.length,
      percent: sameCurrency.length ? Math.round((verified.length / sameCurrency.length) * 100) : 0,
    },
  };
}

export const connectedApplicationPolicy = {
  definition:
    "A customer-controlled workspace, site, tenant, account, or organizational instance registered with Concord.",
  freeApplication:
    "The earliest eligible production instance is free. Reconnection preserves its designation; replacement requires an organization-owner decision and an audit event.",
  nonProduction:
    "A sandbox or staging instance linked to a production instance is tracked for cost-to-serve but is not a separate application unit unless contracted as standalone coverage.",
  deletion:
    "Deleted instances stop future metering but retain historical billing and evidence records.",
  mergers:
    "Organization mergers require identity and application re-baselining before consolidated billing begins.",
  abuse:
    "Repeated connect-delete cycles, false environment labels, or workspace rotation trigger manual review; they never trigger an undisclosed fee.",
} as const;
