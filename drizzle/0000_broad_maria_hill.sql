CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`actor_email` text,
	`event_name` text NOT NULL,
	`route` text NOT NULL,
	`properties_json` text NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_events_org_time_idx` ON `analytics_events` (`organization_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `application_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connected_application_id` text NOT NULL,
	`subscription_id` text,
	`entitlement_code` text NOT NULL,
	`limit_value` integer,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connected_application_id`) REFERENCES `connected_applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `application_entitlements_org_idx` ON `application_entitlements` (`organization_id`);--> statement-breakpoint
CREATE TABLE `application_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connected_application_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_instance_key` text NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`parent_production_instance_id` text,
	`billing_status` text DEFAULT 'pending' NOT NULL,
	`connection_status` text DEFAULT 'pending_authorization' NOT NULL,
	`last_observed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connected_application_id`) REFERENCES `connected_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_instances_org_provider_key_uidx` ON `application_instances` (`organization_id`,`provider`,`external_instance_key`);--> statement-breakpoint
CREATE INDEX `application_instances_org_idx` ON `application_instances` (`organization_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_org_time_idx` ON `audit_events` (`organization_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `baseline_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`application_instance_id` text,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`metrics_json` text NOT NULL,
	`evidence_coverage` real NOT NULL,
	`captured_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `baseline_snapshots_org_idx` ON `baseline_snapshots` (`organization_id`);--> statement-breakpoint
CREATE TABLE `calculation_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`value_event_id` text NOT NULL,
	`evidence_type` text NOT NULL,
	`source_reference` text NOT NULL,
	`source_timestamp` text NOT NULL,
	`hash` text,
	`metadata_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`value_event_id`) REFERENCES `value_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `calculation_evidence_org_event_idx` ON `calculation_evidence` (`organization_id`,`value_event_id`);--> statement-breakpoint
CREATE TABLE `competitor_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`official_url` text,
	`crunchbase_url` text,
	`discovery_source` text NOT NULL,
	`verification_status` text NOT NULL,
	`last_verified_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitor_candidates_name_uidx` ON `competitor_candidates` (`canonical_name`);--> statement-breakpoint
CREATE TABLE `competitor_classifications` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`primary_class` text NOT NULL,
	`capability_overlap` real,
	`enterprise_readiness` real,
	`strategic_threat` real,
	`documented_coverage` real,
	`rationale` text NOT NULL,
	`assessed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `competitor_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `competitor_classifications_candidate_idx` ON `competitor_classifications` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `competitor_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`classification` text NOT NULL,
	`source_url` text NOT NULL,
	`source_title` text NOT NULL,
	`published_at` text,
	`accessed_at` text NOT NULL,
	`claim` text NOT NULL,
	`confidence` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `competitor_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `competitor_evidence_candidate_idx` ON `competitor_evidence` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `confidence_classifications` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`criteria_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `confidence_classifications_code_uidx` ON `confidence_classifications` (`code`);--> statement-breakpoint
CREATE TABLE `connected_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`owner_email` text NOT NULL,
	`free_application` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending_authorization' NOT NULL,
	`disconnected_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `connected_applications_org_idx` ON `connected_applications` (`organization_id`);--> statement-breakpoint
CREATE TABLE `cost_centers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`owner_email` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cost_centers_org_code_uidx` ON `cost_centers` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `cost_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`cost_center_id` text,
	`rate_type` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`unit` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cost_rates_org_idx` ON `cost_rates` (`organization_id`);--> statement-breakpoint
CREATE TABLE `financial_assumptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`value_json` text NOT NULL,
	`currency` text,
	`status` text DEFAULT 'proposed' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `financial_assumptions_org_idx` ON `financial_assumptions` (`organization_id`);--> statement-breakpoint
CREATE TABLE `generated_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`report_type` text NOT NULL,
	`period_start` text,
	`period_end` text,
	`status` text NOT NULL,
	`output_format` text NOT NULL,
	`storage_key` text,
	`generated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `generated_reports_org_idx` ON `generated_reports` (`organization_id`);--> statement-breakpoint
CREATE TABLE `identity_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`protected_identity_id` text NOT NULL,
	`application_instance_id` text NOT NULL,
	`external_user_id` text NOT NULL,
	`external_email` text,
	`match_method` text NOT NULL,
	`confidence` text NOT NULL,
	`verified_by` text,
	`verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`protected_identity_id`) REFERENCES `protected_identities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`application_instance_id`) REFERENCES `application_instances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_mappings_instance_external_uidx` ON `identity_mappings` (`application_instance_id`,`external_user_id`);--> statement-breakpoint
CREATE INDEX `identity_mappings_org_idx` ON `identity_mappings` (`organization_id`);--> statement-breakpoint
CREATE TABLE `metering_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`event_type` text NOT NULL,
	`application_instance_id` text,
	`protected_identity_id` text,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`occurred_at` text NOT NULL,
	`dimensions_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metering_events_org_idempotency_uidx` ON `metering_events` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `metering_events_org_time_idx` ON `metering_events` (`organization_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_email` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_members_org_email_uidx` ON `organization_members` (`organization_id`,`user_email`);--> statement-breakpoint
CREATE INDEX `organization_members_email_idx` ON `organization_members` (`user_email`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_uidx` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`entitlements_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_code_uidx` ON `plans` (`code`);--> statement-breakpoint
CREATE TABLE `price_books` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`currency` text NOT NULL,
	`free_application_count` integer DEFAULT 1 NOT NULL,
	`included_protected_users` integer NOT NULL,
	`additional_application_fee_minor` integer NOT NULL,
	`protected_user_tiers_json` text NOT NULL,
	`annual_discount_bps` integer DEFAULT 0 NOT NULL,
	`entitlements_json` text NOT NULL,
	`effective_from` text NOT NULL,
	`approved_at` text,
	`approved_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_books_version_uidx` ON `price_books` (`version`);--> statement-breakpoint
CREATE TABLE `protected_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`canonical_key` text NOT NULL,
	`primary_email` text,
	`idp_subject` text,
	`identity_kind` text NOT NULL,
	`lifecycle_status` text NOT NULL,
	`has_effective_protected_access` integer DEFAULT false NOT NULL,
	`billable` integer DEFAULT false NOT NULL,
	`disputed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `protected_identities_org_key_uidx` ON `protected_identities` (`organization_id`,`canonical_key`);--> statement-breakpoint
CREATE INDEX `protected_identities_org_billable_idx` ON `protected_identities` (`organization_id`,`billable`);--> statement-breakpoint
CREATE TABLE `research_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`as_of` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`evidence_ledger_hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_snapshots_as_of_uidx` ON `research_snapshots` (`as_of`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`price_book_id` text,
	`status` text DEFAULT 'pilot' NOT NULL,
	`cadence` text DEFAULT 'annual' NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`price_book_id`) REFERENCES `price_books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscriptions_org_idx` ON `subscriptions` (`organization_id`);--> statement-breakpoint
CREATE TABLE `usage_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`connected_applications` integer NOT NULL,
	`unique_protected_users` integer NOT NULL,
	`successful_repairs` integer DEFAULT 0 NOT NULL,
	`completed_verifications` integer DEFAULT 0 NOT NULL,
	`source_event_count` integer DEFAULT 0 NOT NULL,
	`calculation_version` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_summaries_org_period_uidx` ON `usage_summaries` (`organization_id`,`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `value_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`application_instance_id` text,
	`cost_center_id` text,
	`classification` text NOT NULL,
	`event_type` text NOT NULL,
	`amount_minor` integer,
	`currency` text NOT NULL,
	`formula` text NOT NULL,
	`baseline_id` text,
	`confidence` text NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `value_events_org_idempotency_uidx` ON `value_events` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `value_events_org_time_idx` ON `value_events` (`organization_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `watchlist_triggers` (
	`id` text PRIMARY KEY NOT NULL,
	`watchlist_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`priority` text NOT NULL,
	`trigger_text` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`last_checked_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`watchlist_id`) REFERENCES `watchlists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `competitor_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `watchlist_triggers_watchlist_idx` ON `watchlist_triggers` (`watchlist_id`);--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`research_cutoff` text NOT NULL,
	`scope_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
