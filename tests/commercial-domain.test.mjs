import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateBillingEstimate,
  calculateFinOpsValue,
  countBillableApplications,
  deduplicateProtectedIdentities,
} from "../lib/commercial.ts";

const hypothesisPriceBook = {
  id: "pb-hypothesis",
  version: 3,
  status: "draft",
  currency: "USD",
  freeApplicationCount: 1,
  includedProtectedUsers: 100,
  additionalApplicationFeeMinor: 25_000,
  annualDiscountBps: 1_000,
  protectedUserTiers: [
    { upTo: 900, unitFeeMinor: 100 },
    { upTo: null, unitFeeMinor: 75 },
  ],
  effectiveFrom: "2026-08-20",
  approvedAt: null,
};

test("first eligible production application has a zero application fee and the second is charged once", () => {
  const one = calculateBillingEstimate({
    applications: [{ id: "jira", environment: "production", status: "connected" }],
    uniqueProtectedUsers: 100,
    cadence: "monthly",
    priceBook: hypothesisPriceBook,
    allowDraft: true,
  });
  assert.equal(one.available, true);
  assert.equal(one.freeApplications, 1);
  assert.equal(one.applicationFeesMinor, 0);
  assert.equal(one.protectedUserFeesMinor, 0);

  const two = calculateBillingEstimate({
    applications: [
      { id: "jira", environment: "production", status: "connected" },
      { id: "confluence", environment: "production", status: "connected" },
    ],
    uniqueProtectedUsers: 250,
    cadence: "monthly",
    priceBook: hypothesisPriceBook,
    allowDraft: true,
  });
  assert.equal(two.available, true);
  assert.equal(two.chargedApplications, 1);
  assert.equal(two.applicationFeesMinor, 25_000);
  assert.equal(two.chargeableUsers, 150);
});

test("linked non-production instances and deleted or pending instances do not inflate application billing", () => {
  assert.equal(countBillableApplications([
    { id: "prod", environment: "production", status: "connected" },
    { id: "sandbox", environment: "sandbox", status: "connected", parentProductionId: "prod" },
    { id: "standalone-stage", environment: "staging", status: "connected" },
    { id: "deleted", environment: "production", status: "deleted" },
    { id: "pending", environment: "production", status: "pending" },
  ]), 2);
});

test("protected humans are deduplicated across applications while bots, service accounts, and deactivated users are excluded", () => {
  const result = deduplicateProtectedIdentities([
    { applicationId: "jira", externalUserId: "1", email: "Alex@example.com", idpSubject: "idp-alex", kind: "human", lifecycle: "active", hasEffectiveProtectedAccess: true, mappingVerified: true },
    { applicationId: "slack", externalUserId: "A1", email: "alex@example.com", idpSubject: "idp-alex", kind: "human", lifecycle: "active", hasEffectiveProtectedAccess: true, mappingVerified: true },
    { applicationId: "jira", externalUserId: "guest-1", email: "guest@example.com", kind: "guest", lifecycle: "inactive", hasEffectiveProtectedAccess: true, mappingVerified: true },
    { applicationId: "jira", externalUserId: "bot-1", kind: "bot", lifecycle: "active", hasEffectiveProtectedAccess: true, mappingVerified: false },
    { applicationId: "jira", externalUserId: "svc-1", kind: "service_account", lifecycle: "active", hasEffectiveProtectedAccess: true, mappingVerified: false },
    { applicationId: "jira", externalUserId: "old-1", kind: "human", lifecycle: "deactivated", hasEffectiveProtectedAccess: false, mappingVerified: false },
  ]);
  assert.equal(result.uniqueProtectedUsers, 2);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.excluded.length, 3);
});

test("unapproved price books are locked in production calculations", () => {
  const result = calculateBillingEstimate({
    applications: [{ id: "jira", environment: "production", status: "connected" }],
    uniqueProtectedUsers: 100,
    cadence: "annual",
    priceBook: hypothesisPriceBook,
  });
  assert.deepEqual(result.available, false);
  assert.equal(result.firstApplicationFeeMinor, 0);
});

test("FinOps calculation keeps verified, estimated, avoidance, and risk values separate and returns honest missing states", () => {
  const complete = calculateFinOpsValue({
    currency: "USD",
    concordFeesMinor: 40_000,
    concordOperatingCostMinor: 10_000,
    events: [
      { id: "v", classification: "verified_financial", amountMinor: 120_000, currency: "USD", evidenceId: "e1" },
      { id: "o", classification: "estimated_operational", amountMinor: null, currency: "USD", hoursSaved: 4, approvedHourlyRateMinor: 8_000, assumptionApproved: true },
      { id: "a", classification: "cost_avoidance", amountMinor: 90_000, currency: "USD", evidenceId: "e2" },
      { id: "r", classification: "risk_exposure", amountMinor: 1_000_000, currency: "USD" },
    ],
  });
  assert.equal(complete.verifiedFinancialValueMinor, 120_000);
  assert.equal(complete.estimatedOperationalValueMinor, 32_000);
  assert.equal(complete.costAvoidanceMinor, 90_000);
  assert.equal(complete.netVerifiedValueMinor, 70_000);
  assert.equal(complete.riskScenarioCount, 1);

  const empty = calculateFinOpsValue({ currency: "USD", concordFeesMinor: null, concordOperatingCostMinor: null, events: [] });
  assert.equal(empty.verifiedFinancialValueMinor, null);
  assert.equal(empty.netVerifiedValueMinor, null);
  assert.equal(empty.roiPercent, null);
});

test("tenant-owned operational tables carry organization scope and idempotency constraints", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  for (const table of ["connectedApplications", "applicationInstances", "protectedIdentities", "identityMappings", "subscriptions", "meteringEvents", "usageSummaries", "valueEvents", "calculationEvidence", "analyticsEvents", "auditEvents"]) {
    const start = schema.indexOf(`export const ${table}`);
    assert.notEqual(start, -1, `${table} must exist`);
    const next = schema.indexOf("export const ", start + 14);
    const definition = schema.slice(start, next === -1 ? undefined : next);
    assert.match(definition, /organizationId:/, `${table} must be tenant-scoped`);
  }
  assert.match(schema, /metering_events_org_idempotency_uidx/);
  assert.match(schema, /value_events_org_idempotency_uidx/);
});
