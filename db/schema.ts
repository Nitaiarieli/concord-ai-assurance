import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const auditColumns = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),
  status: text("status").notNull().default("active"),
  ...auditColumns,
}, (table) => [uniqueIndex("organizations_slug_uidx").on(table.slug)]);

export const organizationMembers = sqliteTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  userEmail: text("user_email").notNull(),
  role: text("role").notNull().default("owner"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("organization_members_org_email_uidx").on(table.organizationId, table.userEmail),
  index("organization_members_email_idx").on(table.userEmail),
]);

export const connectedApplications = sqliteTable("connected_applications", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  provider: text("provider").notNull(),
  displayName: text("display_name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  freeApplication: integer("free_application", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("pending_authorization"),
  disconnectedAt: text("disconnected_at"),
  deletedAt: text("deleted_at"),
  ...auditColumns,
}, (table) => [index("connected_applications_org_idx").on(table.organizationId)]);

export const applicationInstances = sqliteTable("application_instances", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectedApplicationId: text("connected_application_id").notNull().references(() => connectedApplications.id),
  provider: text("provider").notNull(),
  externalInstanceKey: text("external_instance_key").notNull(),
  environment: text("environment").notNull().default("production"),
  parentProductionInstanceId: text("parent_production_instance_id"),
  billingStatus: text("billing_status").notNull().default("pending"),
  connectionStatus: text("connection_status").notNull().default("pending_authorization"),
  lastObservedAt: text("last_observed_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("application_instances_org_provider_key_uidx").on(table.organizationId, table.provider, table.externalInstanceKey),
  index("application_instances_org_idx").on(table.organizationId),
]);

export const protectedIdentities = sqliteTable("protected_identities", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  canonicalKey: text("canonical_key").notNull(),
  primaryEmail: text("primary_email"),
  idpSubject: text("idp_subject"),
  identityKind: text("identity_kind").notNull(),
  lifecycleStatus: text("lifecycle_status").notNull(),
  hasEffectiveProtectedAccess: integer("has_effective_protected_access", { mode: "boolean" }).notNull().default(false),
  billable: integer("billable", { mode: "boolean" }).notNull().default(false),
  disputedAt: text("disputed_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("protected_identities_org_key_uidx").on(table.organizationId, table.canonicalKey),
  index("protected_identities_org_billable_idx").on(table.organizationId, table.billable),
]);

export const identityMappings = sqliteTable("identity_mappings", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  protectedIdentityId: text("protected_identity_id").notNull().references(() => protectedIdentities.id),
  applicationInstanceId: text("application_instance_id").notNull().references(() => applicationInstances.id),
  externalUserId: text("external_user_id").notNull(),
  externalEmail: text("external_email"),
  matchMethod: text("match_method").notNull(),
  confidence: text("confidence").notNull(),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("identity_mappings_instance_external_uidx").on(table.applicationInstanceId, table.externalUserId),
  index("identity_mappings_org_idx").on(table.organizationId),
]);

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  entitlementsJson: text("entitlements_json").notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("plans_code_uidx").on(table.code)]);

export const priceBooks = sqliteTable("price_books", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  currency: text("currency").notNull(),
  freeApplicationCount: integer("free_application_count").notNull().default(1),
  includedProtectedUsers: integer("included_protected_users").notNull(),
  additionalApplicationFeeMinor: integer("additional_application_fee_minor").notNull(),
  protectedUserTiersJson: text("protected_user_tiers_json").notNull(),
  annualDiscountBps: integer("annual_discount_bps").notNull().default(0),
  entitlementsJson: text("entitlements_json").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
  ...auditColumns,
}, (table) => [uniqueIndex("price_books_version_uidx").on(table.version)]);

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  planId: text("plan_id").notNull().references(() => plans.id),
  priceBookId: text("price_book_id").references(() => priceBooks.id),
  status: text("status").notNull().default("pilot"),
  cadence: text("cadence").notNull().default("annual"),
  startAt: text("start_at").notNull(),
  endAt: text("end_at"),
  ...auditColumns,
}, (table) => [index("subscriptions_org_idx").on(table.organizationId)]);

export const applicationEntitlements = sqliteTable("application_entitlements", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectedApplicationId: text("connected_application_id").notNull().references(() => connectedApplications.id),
  subscriptionId: text("subscription_id").references(() => subscriptions.id),
  entitlementCode: text("entitlement_code").notNull(),
  limitValue: integer("limit_value"),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  ...auditColumns,
}, (table) => [index("application_entitlements_org_idx").on(table.organizationId)]);

export const meteringEvents = sqliteTable("metering_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  idempotencyKey: text("idempotency_key").notNull(),
  eventType: text("event_type").notNull(),
  applicationInstanceId: text("application_instance_id"),
  protectedIdentityId: text("protected_identity_id"),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  occurredAt: text("occurred_at").notNull(),
  dimensionsJson: text("dimensions_json").notNull(),
  ...auditColumns,
}, (table) => [
  uniqueIndex("metering_events_org_idempotency_uidx").on(table.organizationId, table.idempotencyKey),
  index("metering_events_org_time_idx").on(table.organizationId, table.occurredAt),
]);

export const usageSummaries = sqliteTable("usage_summaries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  connectedApplications: integer("connected_applications").notNull(),
  uniqueProtectedUsers: integer("unique_protected_users").notNull(),
  successfulRepairs: integer("successful_repairs").notNull().default(0),
  completedVerifications: integer("completed_verifications").notNull().default(0),
  sourceEventCount: integer("source_event_count").notNull().default(0),
  calculationVersion: text("calculation_version").notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("usage_summaries_org_period_uidx").on(table.organizationId, table.periodStart, table.periodEnd)]);

export const costCenters = sqliteTable("cost_centers", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email"),
  ...auditColumns,
}, (table) => [uniqueIndex("cost_centers_org_code_uidx").on(table.organizationId, table.code)]);

export const costRates = sqliteTable("cost_rates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  costCenterId: text("cost_center_id").references(() => costCenters.id),
  rateType: text("rate_type").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  unit: text("unit").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  ...auditColumns,
}, (table) => [index("cost_rates_org_idx").on(table.organizationId)]);

export const baselineSnapshots = sqliteTable("baseline_snapshots", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  applicationInstanceId: text("application_instance_id"),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  metricsJson: text("metrics_json").notNull(),
  evidenceCoverage: real("evidence_coverage").notNull(),
  capturedAt: text("captured_at").notNull(),
  ...auditColumns,
}, (table) => [index("baseline_snapshots_org_idx").on(table.organizationId)]);

export const financialAssumptions = sqliteTable("financial_assumptions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  valueJson: text("value_json").notNull(),
  currency: text("currency"),
  status: text("status").notNull().default("proposed"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  source: text("source").notNull(),
  ...auditColumns,
}, (table) => [index("financial_assumptions_org_idx").on(table.organizationId)]);

export const valueEvents = sqliteTable("value_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  idempotencyKey: text("idempotency_key").notNull(),
  applicationInstanceId: text("application_instance_id"),
  costCenterId: text("cost_center_id"),
  classification: text("classification").notNull(),
  eventType: text("event_type").notNull(),
  amountMinor: integer("amount_minor"),
  currency: text("currency").notNull(),
  formula: text("formula").notNull(),
  baselineId: text("baseline_id"),
  confidence: text("confidence").notNull(),
  occurredAt: text("occurred_at").notNull(),
  ...auditColumns,
}, (table) => [
  uniqueIndex("value_events_org_idempotency_uidx").on(table.organizationId, table.idempotencyKey),
  index("value_events_org_time_idx").on(table.organizationId, table.occurredAt),
]);

export const calculationEvidence = sqliteTable("calculation_evidence", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  valueEventId: text("value_event_id").notNull().references(() => valueEvents.id),
  evidenceType: text("evidence_type").notNull(),
  sourceReference: text("source_reference").notNull(),
  sourceTimestamp: text("source_timestamp").notNull(),
  hash: text("hash"),
  metadataJson: text("metadata_json").notNull(),
  ...auditColumns,
}, (table) => [index("calculation_evidence_org_event_idx").on(table.organizationId, table.valueEventId)]);

export const confidenceClassifications = sqliteTable("confidence_classifications", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  criteriaJson: text("criteria_json").notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("confidence_classifications_code_uidx").on(table.code)]);

export const competitorCandidates = sqliteTable("competitor_candidates", {
  id: text("id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  officialUrl: text("official_url"),
  crunchbaseUrl: text("crunchbase_url"),
  discoverySource: text("discovery_source").notNull(),
  verificationStatus: text("verification_status").notNull(),
  lastVerifiedAt: text("last_verified_at").notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("competitor_candidates_name_uidx").on(table.canonicalName)]);

export const competitorEvidence = sqliteTable("competitor_evidence", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull().references(() => competitorCandidates.id),
  classification: text("classification").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceTitle: text("source_title").notNull(),
  publishedAt: text("published_at"),
  accessedAt: text("accessed_at").notNull(),
  claim: text("claim").notNull(),
  confidence: text("confidence").notNull(),
  ...auditColumns,
}, (table) => [index("competitor_evidence_candidate_idx").on(table.candidateId)]);

export const competitorClassifications = sqliteTable("competitor_classifications", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull().references(() => competitorCandidates.id),
  primaryClass: text("primary_class").notNull(),
  capabilityOverlap: real("capability_overlap"),
  enterpriseReadiness: real("enterprise_readiness"),
  strategicThreat: real("strategic_threat"),
  documentedCoverage: real("documented_coverage"),
  rationale: text("rationale").notNull(),
  assessedAt: text("assessed_at").notNull(),
  ...auditColumns,
}, (table) => [index("competitor_classifications_candidate_idx").on(table.candidateId)]);

export const watchlists = sqliteTable("watchlists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  researchCutoff: text("research_cutoff").notNull(),
  scopeJson: text("scope_json").notNull(),
  ...auditColumns,
});

export const watchlistTriggers = sqliteTable("watchlist_triggers", {
  id: text("id").primaryKey(),
  watchlistId: text("watchlist_id").notNull().references(() => watchlists.id),
  candidateId: text("candidate_id").notNull().references(() => competitorCandidates.id),
  priority: text("priority").notNull(),
  triggerText: text("trigger_text").notNull(),
  status: text("status").notNull().default("open"),
  lastCheckedAt: text("last_checked_at").notNull(),
  ...auditColumns,
}, (table) => [index("watchlist_triggers_watchlist_idx").on(table.watchlistId)]);

export const researchSnapshots = sqliteTable("research_snapshots", {
  id: text("id").primaryKey(),
  asOf: text("as_of").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  evidenceLedgerHash: text("evidence_ledger_hash"),
  ...auditColumns,
}, (table) => [uniqueIndex("research_snapshots_as_of_uidx").on(table.asOf)]);

export const generatedReports = sqliteTable("generated_reports", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organizations.id),
  reportType: text("report_type").notNull(),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  status: text("status").notNull(),
  outputFormat: text("output_format").notNull(),
  storageKey: text("storage_key"),
  generatedBy: text("generated_by").notNull(),
  ...auditColumns,
}, (table) => [index("generated_reports_org_idx").on(table.organizationId)]);

export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  actorEmail: text("actor_email"),
  eventName: text("event_name").notNull(),
  route: text("route").notNull(),
  propertiesJson: text("properties_json").notNull(),
  occurredAt: text("occurred_at").notNull(),
}, (table) => [index("analytics_events_org_time_idx").on(table.organizationId, table.occurredAt)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  occurredAt: text("occurred_at").notNull(),
}, (table) => [index("audit_events_org_time_idx").on(table.organizationId, table.occurredAt)]);

export const connectorDefinitions = sqliteTable("connector_definitions", {
  id: text("id").primaryKey(),
  connectorKey: text("connector_key").notNull(),
  displayName: text("display_name").notNull(),
  connectorClass: text("connector_class").notNull(),
  phase: text("phase").notNull(),
  readiness: text("readiness").notNull(),
  certification: text("certification").notNull(),
  manifestVersion: integer("manifest_version").notNull().default(1),
  capabilityManifestJson: text("capability_manifest_json").notNull(),
  limitationsJson: text("limitations_json").notNull(),
  ...auditColumns,
}, (table) => [uniqueIndex("connector_definitions_key_uidx").on(table.connectorKey)]);

export const connectorDeployments = sqliteTable("connector_deployments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectorDefinitionId: text("connector_definition_id").notNull().references(() => connectorDefinitions.id),
  connectedApplicationId: text("connected_application_id").references(() => connectedApplications.id),
  applicationInstanceId: text("application_instance_id").references(() => applicationInstances.id),
  displayName: text("display_name").notNull(),
  externalInstanceKey: text("external_instance_key").notNull(),
  environment: text("environment").notNull(),
  deploymentMode: text("deployment_mode").notNull(),
  status: text("status").notNull().default("enrollment_pending"),
  healthStatus: text("health_status").notNull().default("awaiting_runtime"),
  runtimeVersion: text("runtime_version"),
  policyVersion: text("policy_version"),
  secretReference: text("secret_reference").notNull(),
  lastHeartbeatAt: text("last_heartbeat_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("connector_deployments_org_definition_instance_uidx").on(table.organizationId, table.connectorDefinitionId, table.externalInstanceKey),
  index("connector_deployments_org_status_idx").on(table.organizationId, table.status),
]);

export const aiDestinationConfigurations = sqliteTable("ai_destination_configurations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectorDeploymentId: text("connector_deployment_id").notNull().references(() => connectorDeployments.id),
  destinationType: text("destination_type").notNull(),
  displayName: text("display_name").notNull(),
  configurationJson: text("configuration_json").notNull(),
  secretReference: text("secret_reference"),
  verificationMode: text("verification_mode").notNull().default("identity_retrieval"),
  status: text("status").notNull().default("configuration_pending"),
  lastVerifiedAt: text("last_verified_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("ai_destination_configurations_deployment_uidx").on(table.connectorDeploymentId),
  index("ai_destination_configurations_org_status_idx").on(table.organizationId, table.status),
]);

export const integrationConfigurations = sqliteTable("integration_configurations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectorDeploymentId: text("connector_deployment_id").notNull().references(() => connectorDeployments.id),
  applicationType: text("application_type").notNull(),
  apiEndpoint: text("api_endpoint"),
  authenticationMethod: text("authentication_method").notNull(),
  credentialReference: text("credential_reference").notNull(),
  requiredPermissionsJson: text("required_permissions_json").notNull(),
  monitoredScopesJson: text("monitored_scopes_json").notNull(),
  verificationIdentityRef: text("verification_identity_ref"),
  policyVersion: text("policy_version").notNull(),
  connectionStatus: text("connection_status").notNull().default("awaiting_credentials"),
  lastSynchronizationAt: text("last_synchronization_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("integration_configurations_deployment_uidx").on(table.connectorDeploymentId),
  index("integration_configurations_org_status_idx").on(table.organizationId, table.connectionStatus),
]);

export const connectorRuntimeCredentials = sqliteTable("connector_runtime_credentials", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectorDeploymentId: text("connector_deployment_id").notNull().references(() => connectorDeployments.id),
  tokenHash: text("token_hash").notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  status: text("status").notNull().default("active"),
  expiresAt: text("expires_at"),
  lastUsedAt: text("last_used_at"),
  revokedAt: text("revoked_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("connector_runtime_credentials_hash_uidx").on(table.tokenHash),
  index("connector_runtime_credentials_org_deployment_idx").on(table.organizationId, table.connectorDeploymentId),
]);

export const canonicalChangeEvents = sqliteTable("canonical_change_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectorDeploymentId: text("connector_deployment_id").notNull().references(() => connectorDeployments.id),
  sourceEventId: text("source_event_id").notNull(),
  sourceObjectType: text("source_object_type").notNull(),
  sourceObjectId: text("source_object_id").notNull(),
  changeType: text("change_type").notNull(),
  eventTimestamp: text("event_timestamp").notNull(),
  observedTimestamp: text("observed_timestamp").notNull(),
  actorIdentityRef: text("actor_identity_ref"),
  previousStateRef: text("previous_state_ref"),
  newStateRef: text("new_state_ref"),
  affectedIdentitiesJson: text("affected_identities_json").notNull(),
  affectedGroupsJson: text("affected_groups_json").notNull(),
  permissionDeltaJson: text("permission_delta_json").notNull(),
  contentValidityDeltaJson: text("content_validity_delta_json").notNull(),
  sourceSystemVersion: text("source_system_version"),
  correlationId: text("correlation_id").notNull(),
  evidenceReferencesJson: text("evidence_references_json").notNull(),
  processingStatus: text("processing_status").notNull().default("detected"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("canonical_change_events_deployment_source_uidx").on(table.connectorDeploymentId, table.sourceEventId),
  index("canonical_change_events_org_time_idx").on(table.organizationId, table.eventTimestamp),
  index("canonical_change_events_org_correlation_idx").on(table.organizationId, table.correlationId),
]);

export const lineageRegistrations = sqliteTable("lineage_registrations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectorDeploymentId: text("connector_deployment_id").notNull().references(() => connectorDeployments.id),
  sourceObjectId: text("source_object_id").notNull(),
  sourceVersionRef: text("source_version_ref").notNull(),
  derivativeType: text("derivative_type").notNull(),
  derivativeStableId: text("derivative_stable_id").notNull(),
  destinationRef: text("destination_ref").notNull(),
  transformationPathJson: text("transformation_path_json").notNull(),
  verificationEndpointRef: text("verification_endpoint_ref"),
  status: text("status").notNull().default("registered"),
  lastObservedAt: text("last_observed_at").notNull(),
  ...auditColumns,
}, (table) => [
  uniqueIndex("lineage_registrations_org_derivative_uidx").on(table.organizationId, table.derivativeStableId),
  index("lineage_registrations_org_source_idx").on(table.organizationId, table.sourceObjectId),
]);

export const reconciliationRuns = sqliteTable("reconciliation_runs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  connectorDeploymentId: text("connector_deployment_id").notNull().references(() => connectorDeployments.id),
  canonicalChangeEventId: text("canonical_change_event_id").notNull().references(() => canonicalChangeEvents.id),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("detected"),
  repairAction: text("repair_action").notNull().default("pending_policy"),
  approvalState: text("approval_state").notNull().default("not_evaluated"),
  destinationReadback: text("destination_readback").notNull().default("not_started"),
  verificationClassification: text("verification_classification").notNull().default("unverified"),
  evidenceHash: text("evidence_hash"),
  errorClassification: text("error_classification"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("reconciliation_runs_org_idempotency_uidx").on(table.organizationId, table.idempotencyKey),
  index("reconciliation_runs_org_status_idx").on(table.organizationId, table.status),
]);

export const deploymentAgentRuns = sqliteTable("deployment_agent_runs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  requestKey: text("request_key").notNull(),
  createdBy: text("created_by").notNull(),
  status: text("status").notNull().default("running"),
  currentStage: text("current_stage").notNull().default("research"),
  hypothesis: text("hypothesis").notNull(),
  intakeJson: text("intake_json").notNull(),
  recommendationJson: text("recommendation_json"),
  auditJson: text("audit_json"),
  dossierJson: text("dossier_json"),
  revisionCount: integer("revision_count").notNull().default(0),
  researchAsOf: text("research_as_of").notNull(),
  completedAt: text("completed_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("deployment_agent_runs_org_request_uidx").on(table.organizationId, table.requestKey),
  index("deployment_agent_runs_org_time_idx").on(table.organizationId, table.createdAt),
]);

export const deploymentAgentEvents = sqliteTable("deployment_agent_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  runId: text("run_id").notNull().references(() => deploymentAgentRuns.id),
  skill: text("skill").notNull(),
  cycle: integer("cycle").notNull().default(0),
  sequence: integer("sequence").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json").notNull(),
  sourceCount: integer("source_count").notNull().default(0),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  ...auditColumns,
}, (table) => [
  uniqueIndex("deployment_agent_events_run_skill_cycle_uidx").on(table.runId, table.skill, table.cycle),
  uniqueIndex("deployment_agent_events_run_sequence_uidx").on(table.runId, table.sequence),
  index("deployment_agent_events_org_run_idx").on(table.organizationId, table.runId),
]);

export const deploymentAgentEvidence = sqliteTable("deployment_agent_evidence", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  runId: text("run_id").notNull().references(() => deploymentAgentRuns.id),
  skill: text("skill").notNull(),
  claim: text("claim").notNull(),
  classification: text("classification").notNull(),
  sourceTitle: text("source_title").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type").notNull(),
  publishedAt: text("published_at"),
  accessedAt: text("accessed_at").notNull(),
  confidence: text("confidence").notNull(),
  ...auditColumns,
}, (table) => [
  index("deployment_agent_evidence_org_run_idx").on(table.organizationId, table.runId),
]);

export const deploymentAgentFindings = sqliteTable("deployment_agent_findings", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  runId: text("run_id").notNull().references(() => deploymentAgentRuns.id),
  cycle: integer("cycle").notNull().default(0),
  severity: text("severity").notNull(),
  component: text("component").notNull(),
  risk: text("risk").notNull(),
  remediation: text("remediation").notNull(),
  owner: text("owner").notNull(),
  validationMethod: text("validation_method").notNull(),
  status: text("status").notNull().default("open"),
  ...auditColumns,
}, (table) => [
  index("deployment_agent_findings_org_run_idx").on(table.organizationId, table.runId),
]);

export const consistencyEngineNodes = sqliteTable("consistency_engine_nodes", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  nodeType: text("node_type").notNull(),
  authoritative: integer("authoritative", { mode: "boolean" }).notNull().default(false),
  sourceVersionJson: text("source_version_json"),
  effectiveStateHash: text("effective_state_hash").notNull(),
  validityState: text("validity_state").notNull(),
  policyClass: text("policy_class").notNull(),
  securityEpoch: integer("security_epoch").notNull().default(0),
  provenanceJson: text("provenance_json").notNull(),
  requiredAuthoritiesJson: text("required_authorities_json").notNull(),
  dependencyCoverage: text("dependency_coverage").notNull(),
  lastVerifiedAt: text("last_verified_at"),
  ...auditColumns,
}, (table) => [
  index("consistency_engine_nodes_org_state_idx").on(table.organizationId, table.validityState),
]);

export const consistencyEngineSecurityEpochs = sqliteTable("consistency_engine_security_epochs", {
  organizationId: text("organization_id").primaryKey().references(() => organizations.id),
  currentEpoch: integer("current_epoch").notNull().default(0),
  ...auditColumns,
});

export const consistencyEngineEdges = sqliteTable("consistency_engine_edges", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  sourceNodeId: text("source_node_id").notNull().references(() => consistencyEngineNodes.id),
  destinationNodeId: text("destination_node_id").notNull().references(() => consistencyEngineNodes.id),
  dependencyType: text("dependency_type").notNull(),
  contractJson: text("contract_json").notNull(),
  edgeVersion: integer("edge_version").notNull(),
  evidenceType: text("evidence_type").notNull(),
  confidence: real("confidence"),
  ...auditColumns,
}, (table) => [
  index("consistency_engine_edges_org_source_idx").on(table.organizationId, table.sourceNodeId),
  uniqueIndex("consistency_engine_edges_org_id_version_uidx").on(table.organizationId, table.id, table.edgeVersion),
]);

export const consistencyEngineEvents = sqliteTable("consistency_engine_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  authority: text("authority").notNull(),
  objectId: text("object_id").notNull(),
  mutationType: text("mutation_type").notNull(),
  sourceSequence: integer("source_sequence").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  logicalTimestamp: integer("logical_timestamp").notNull(),
  eventJson: text("event_json").notNull(),
  receivedAt: text("received_at").notNull(),
}, (table) => [
  uniqueIndex("consistency_engine_events_org_idempotency_uidx").on(table.organizationId, table.idempotencyKey),
  index("consistency_engine_events_org_authority_sequence_idx").on(table.organizationId, table.authority, table.sourceSequence),
]);

export const consistencyEngineActions = sqliteTable("consistency_engine_actions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  eventId: text("event_id").notNull().references(() => consistencyEngineEvents.id),
  nodeId: text("node_id").notNull().references(() => consistencyEngineNodes.id),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull(),
  actionJson: text("action_json").notNull(),
  ...auditColumns,
}, (table) => [
  uniqueIndex("consistency_engine_actions_org_idempotency_uidx").on(table.organizationId, table.idempotencyKey),
  index("consistency_engine_actions_org_event_idx").on(table.organizationId, table.eventId),
]);

export const consistencyEngineProofs = sqliteTable("consistency_engine_proofs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  eventId: text("event_id").notNull().references(() => consistencyEngineEvents.id),
  artifactId: text("artifact_id").notNull().references(() => consistencyEngineNodes.id),
  policyVersion: text("policy_version").notNull(),
  securityEpoch: integer("security_epoch").notNull(),
  result: text("result").notNull(),
  proofHash: text("proof_hash").notNull(),
  proofJson: text("proof_json").notNull(),
  verifiedAt: text("verified_at").notNull(),
}, (table) => [
  uniqueIndex("consistency_engine_proofs_hash_uidx").on(table.proofHash),
  index("consistency_engine_proofs_org_artifact_time_idx").on(table.organizationId, table.artifactId, table.verifiedAt),
]);
