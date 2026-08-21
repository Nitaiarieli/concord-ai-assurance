import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applicationInstances,
  analyticsEvents,
  auditEvents,
  connectedApplications,
  organizationMembers,
  organizations,
  priceBooks,
  protectedIdentities,
  valueEvents,
} from "@/db/schema";

export const applicationProviders = [
  "bookstack",
  "zulip",
  "jira",
  "confluence",
  "slack",
  "monday",
  "linear",
  "microsoft_teams",
  "sharepoint",
  "google_workspace",
] as const;

export type ApplicationProvider = (typeof applicationProviders)[number];

function now() {
  return new Date().toISOString();
}

function organizationName(displayName: string) {
  const first = displayName.includes("@") ? displayName.split("@")[0] : displayName;
  return `${first.trim() || "Concord"}'s organization`;
}

function slugify(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${normalized || "organization"}-${crypto.randomUUID().slice(0, 8)}`;
}

async function membershipForEmail(email: string) {
  const db = await getDb();
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userEmail, email.toLowerCase()))
    .limit(1);
  return membership ?? null;
}

export async function getOrCreateOrganization(email: string, displayName: string) {
  const normalizedEmail = email.toLowerCase();
  const existing = await membershipForEmail(normalizedEmail);
  if (existing) return existing.organizationId;

  const db = await getDb();
  const timestamp = now();
  const organizationId = crypto.randomUUID();
  await db.insert(organizations).values({
    id: organizationId,
    name: organizationName(displayName),
    slug: slugify(displayName),
    currency: "USD",
    timezone: "Asia/Jerusalem",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(organizationMembers).values({
    id: crypto.randomUUID(),
    organizationId,
    userEmail: normalizedEmail,
    role: "owner",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId,
    actorEmail: normalizedEmail,
    action: "organization.created",
    entityType: "organization",
    entityId: organizationId,
    afterJson: JSON.stringify({ name: organizationName(displayName), currency: "USD", timezone: "Asia/Jerusalem" }),
    occurredAt: timestamp,
  });
  return organizationId;
}

async function authorizedOrganization(email: string) {
  const membership = await membershipForEmail(email.toLowerCase());
  if (!membership) throw new Error("No organization membership was found.");
  return membership;
}

export async function requireOrganizationMembership(email: string) {
  return authorizedOrganization(email);
}

export async function getWorkspaceSnapshot(email: string, displayName: string) {
  const organizationId = await getOrCreateOrganization(email, displayName);
  const db = await getDb();
  const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const applications = await db
    .select({
      id: connectedApplications.id,
      provider: connectedApplications.provider,
      displayName: connectedApplications.displayName,
      freeApplication: connectedApplications.freeApplication,
      status: connectedApplications.status,
      externalInstanceKey: applicationInstances.externalInstanceKey,
      environment: applicationInstances.environment,
      connectionStatus: applicationInstances.connectionStatus,
    })
    .from(connectedApplications)
    .innerJoin(applicationInstances, eq(applicationInstances.connectedApplicationId, connectedApplications.id))
    .where(and(eq(connectedApplications.organizationId, organizationId), isNull(connectedApplications.deletedAt)))
    .orderBy(asc(connectedApplications.createdAt));
  const identities = await db
    .select({ id: protectedIdentities.id })
    .from(protectedIdentities)
    .where(and(eq(protectedIdentities.organizationId, organizationId), eq(protectedIdentities.billable, true)));
  const approvedPriceBook = await db
    .select({ id: priceBooks.id, version: priceBooks.version, currency: priceBooks.currency })
    .from(priceBooks)
    .where(eq(priceBooks.status, "approved"))
    .orderBy(desc(priceBooks.version))
    .limit(1);
  const values = await db
    .select({ id: valueEvents.id, classification: valueEvents.classification, amountMinor: valueEvents.amountMinor })
    .from(valueEvents)
    .where(eq(valueEvents.organizationId, organizationId));

  return {
    organization,
    applications,
    uniqueProtectedUsers: identities.length,
    approvedPriceBook: approvedPriceBook[0] ?? null,
    valueEventCount: values.length,
    pricingStatus: approvedPriceBook.length ? "approved" : "awaiting_founder_approval",
  };
}

export async function registerApplication(
  email: string,
  input: { provider: ApplicationProvider; displayName: string; externalInstanceKey: string; environment: "production" | "sandbox" | "staging" },
) {
  const membership = await authorizedOrganization(email);
  if (!applicationProviders.includes(input.provider)) throw new Error("Unsupported application provider.");
  const displayName = input.displayName.trim();
  const externalInstanceKey = input.externalInstanceKey.trim();
  if (!displayName || displayName.length > 100) throw new Error("Application name must contain 1 to 100 characters.");
  if (!externalInstanceKey || externalInstanceKey.length > 180) throw new Error("Instance identifier must contain 1 to 180 characters.");
  if (!["production", "sandbox", "staging"].includes(input.environment)) throw new Error("Unsupported environment.");
  if (input.environment !== "production") throw new Error("The first self-service release accepts production instances only; non-production linking requires an existing production instance.");

  const db = await getDb();
  const activeApplications = await db
    .select({ id: connectedApplications.id })
    .from(connectedApplications)
    .where(and(eq(connectedApplications.organizationId, membership.organizationId), isNull(connectedApplications.deletedAt)));
  const applicationId = crypto.randomUUID();
  const instanceId = crypto.randomUUID();
  const timestamp = now();
  const isFirst = activeApplications.length === 0;

  await db.insert(connectedApplications).values({
    id: applicationId,
    organizationId: membership.organizationId,
    provider: input.provider,
    displayName,
    ownerEmail: email.toLowerCase(),
    freeApplication: isFirst,
    status: "pending_authorization",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  try {
    await db.insert(applicationInstances).values({
      id: instanceId,
      organizationId: membership.organizationId,
      connectedApplicationId: applicationId,
      provider: input.provider,
      externalInstanceKey,
      environment: input.environment,
      billingStatus: isFirst ? "free_application" : "awaiting_price_book",
      connectionStatus: "pending_authorization",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } catch (error) {
    await db.delete(connectedApplications).where(eq(connectedApplications.id, applicationId));
    throw error;
  }
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: membership.organizationId,
    actorEmail: email.toLowerCase(),
    action: "application.registered",
    entityType: "connected_application",
    entityId: applicationId,
    afterJson: JSON.stringify({ provider: input.provider, displayName, environment: input.environment, freeApplication: isFirst, connectionStatus: "pending_authorization" }),
    occurredAt: timestamp,
  });
  await db.insert(analyticsEvents).values({
    id: crypto.randomUUID(),
    organizationId: membership.organizationId,
    actorEmail: email.toLowerCase(),
    eventName: isFirst ? "first_application_registered" : "additional_application_registered",
    route: "/workspace",
    propertiesJson: JSON.stringify({ provider: input.provider, environment: input.environment, freeApplication: isFirst }),
    occurredAt: timestamp,
  });
  return { id: applicationId, instanceId, freeApplication: isFirst, applicationFeeMinor: isFirst ? 0 : null, connectionStatus: "pending_authorization" };
}

const analyticsEventNames = [
  "pricing_calculator_used",
  "finops_methodology_viewed",
  "executive_report_exported",
  "identity_count_disputed",
] as const;

export async function recordAnalyticsEvent(
  email: string,
  input: { eventName: (typeof analyticsEventNames)[number]; route: string; properties?: Record<string, string | number | boolean> },
) {
  if (!analyticsEventNames.includes(input.eventName)) throw new Error("Unsupported analytics event.");
  if (!input.route.startsWith("/") || input.route.length > 120) throw new Error("Invalid analytics route.");
  const membership = await authorizedOrganization(email);
  const propertiesJson = JSON.stringify(input.properties ?? {});
  if (propertiesJson.length > 2000) throw new Error("Analytics properties are too large.");
  await (await getDb()).insert(analyticsEvents).values({
    id: crypto.randomUUID(),
    organizationId: membership.organizationId,
    actorEmail: email.toLowerCase(),
    eventName: input.eventName,
    route: input.route,
    propertiesJson,
    occurredAt: now(),
  });
}
