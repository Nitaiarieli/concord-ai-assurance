CREATE TABLE `canonical_change_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connector_deployment_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`source_object_type` text NOT NULL,
	`source_object_id` text NOT NULL,
	`change_type` text NOT NULL,
	`event_timestamp` text NOT NULL,
	`observed_timestamp` text NOT NULL,
	`actor_identity_ref` text,
	`previous_state_ref` text,
	`new_state_ref` text,
	`affected_identities_json` text NOT NULL,
	`affected_groups_json` text NOT NULL,
	`permission_delta_json` text NOT NULL,
	`content_validity_delta_json` text NOT NULL,
	`source_system_version` text,
	`correlation_id` text NOT NULL,
	`evidence_references_json` text NOT NULL,
	`processing_status` text DEFAULT 'detected' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connector_deployment_id`) REFERENCES `connector_deployments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canonical_change_events_deployment_source_uidx` ON `canonical_change_events` (`connector_deployment_id`,`source_event_id`);--> statement-breakpoint
CREATE INDEX `canonical_change_events_org_time_idx` ON `canonical_change_events` (`organization_id`,`event_timestamp`);--> statement-breakpoint
CREATE INDEX `canonical_change_events_org_correlation_idx` ON `canonical_change_events` (`organization_id`,`correlation_id`);--> statement-breakpoint
CREATE TABLE `connector_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`connector_key` text NOT NULL,
	`display_name` text NOT NULL,
	`connector_class` text NOT NULL,
	`phase` text NOT NULL,
	`readiness` text NOT NULL,
	`certification` text NOT NULL,
	`manifest_version` integer DEFAULT 1 NOT NULL,
	`capability_manifest_json` text NOT NULL,
	`limitations_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connector_definitions_key_uidx` ON `connector_definitions` (`connector_key`);--> statement-breakpoint
CREATE TABLE `connector_deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connector_definition_id` text NOT NULL,
	`connected_application_id` text,
	`application_instance_id` text,
	`display_name` text NOT NULL,
	`external_instance_key` text NOT NULL,
	`environment` text NOT NULL,
	`deployment_mode` text NOT NULL,
	`status` text DEFAULT 'enrollment_pending' NOT NULL,
	`health_status` text DEFAULT 'awaiting_runtime' NOT NULL,
	`runtime_version` text,
	`policy_version` text,
	`secret_reference` text NOT NULL,
	`last_heartbeat_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connector_definition_id`) REFERENCES `connector_definitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connected_application_id`) REFERENCES `connected_applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`application_instance_id`) REFERENCES `application_instances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connector_deployments_org_definition_instance_uidx` ON `connector_deployments` (`organization_id`,`connector_definition_id`,`external_instance_key`);--> statement-breakpoint
CREATE INDEX `connector_deployments_org_status_idx` ON `connector_deployments` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `connector_runtime_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connector_deployment_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connector_deployment_id`) REFERENCES `connector_deployments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connector_runtime_credentials_hash_uidx` ON `connector_runtime_credentials` (`token_hash`);--> statement-breakpoint
CREATE INDEX `connector_runtime_credentials_org_deployment_idx` ON `connector_runtime_credentials` (`organization_id`,`connector_deployment_id`);--> statement-breakpoint
CREATE TABLE `lineage_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connector_deployment_id` text NOT NULL,
	`source_object_id` text NOT NULL,
	`source_version_ref` text NOT NULL,
	`derivative_type` text NOT NULL,
	`derivative_stable_id` text NOT NULL,
	`destination_ref` text NOT NULL,
	`transformation_path_json` text NOT NULL,
	`verification_endpoint_ref` text,
	`status` text DEFAULT 'registered' NOT NULL,
	`last_observed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connector_deployment_id`) REFERENCES `connector_deployments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lineage_registrations_org_derivative_uidx` ON `lineage_registrations` (`organization_id`,`derivative_stable_id`);--> statement-breakpoint
CREATE INDEX `lineage_registrations_org_source_idx` ON `lineage_registrations` (`organization_id`,`source_object_id`);--> statement-breakpoint
CREATE TABLE `reconciliation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connector_deployment_id` text NOT NULL,
	`canonical_change_event_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'detected' NOT NULL,
	`repair_action` text DEFAULT 'pending_policy' NOT NULL,
	`approval_state` text DEFAULT 'not_evaluated' NOT NULL,
	`destination_readback` text DEFAULT 'not_started' NOT NULL,
	`verification_classification` text DEFAULT 'unverified' NOT NULL,
	`evidence_hash` text,
	`error_classification` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connector_deployment_id`) REFERENCES `connector_deployments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`canonical_change_event_id`) REFERENCES `canonical_change_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reconciliation_runs_org_idempotency_uidx` ON `reconciliation_runs` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `reconciliation_runs_org_status_idx` ON `reconciliation_runs` (`organization_id`,`status`);