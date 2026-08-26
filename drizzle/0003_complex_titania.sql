CREATE TABLE `consistency_engine_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`event_id` text NOT NULL,
	`node_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text NOT NULL,
	`action_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `consistency_engine_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`node_id`) REFERENCES `consistency_engine_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consistency_engine_actions_org_idempotency_uidx` ON `consistency_engine_actions` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `consistency_engine_actions_org_event_idx` ON `consistency_engine_actions` (`organization_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `consistency_engine_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`destination_node_id` text NOT NULL,
	`dependency_type` text NOT NULL,
	`contract_json` text NOT NULL,
	`edge_version` integer NOT NULL,
	`evidence_type` text NOT NULL,
	`confidence` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_node_id`) REFERENCES `consistency_engine_nodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_node_id`) REFERENCES `consistency_engine_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consistency_engine_edges_org_source_idx` ON `consistency_engine_edges` (`organization_id`,`source_node_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `consistency_engine_edges_org_id_version_uidx` ON `consistency_engine_edges` (`organization_id`,`id`,`edge_version`);--> statement-breakpoint
CREATE TABLE `consistency_engine_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`authority` text NOT NULL,
	`object_id` text NOT NULL,
	`mutation_type` text NOT NULL,
	`source_sequence` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`logical_timestamp` integer NOT NULL,
	`event_json` text NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consistency_engine_events_org_idempotency_uidx` ON `consistency_engine_events` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `consistency_engine_events_org_authority_sequence_idx` ON `consistency_engine_events` (`organization_id`,`authority`,`source_sequence`);--> statement-breakpoint
CREATE TABLE `consistency_engine_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`node_type` text NOT NULL,
	`authoritative` integer DEFAULT false NOT NULL,
	`source_version_json` text,
	`effective_state_hash` text NOT NULL,
	`validity_state` text NOT NULL,
	`policy_class` text NOT NULL,
	`security_epoch` integer DEFAULT 0 NOT NULL,
	`provenance_json` text NOT NULL,
	`required_authorities_json` text NOT NULL,
	`dependency_coverage` text NOT NULL,
	`last_verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consistency_engine_nodes_org_state_idx` ON `consistency_engine_nodes` (`organization_id`,`validity_state`);--> statement-breakpoint
CREATE TABLE `consistency_engine_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`event_id` text NOT NULL,
	`artifact_id` text NOT NULL,
	`policy_version` text NOT NULL,
	`security_epoch` integer NOT NULL,
	`result` text NOT NULL,
	`proof_hash` text NOT NULL,
	`proof_json` text NOT NULL,
	`verified_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `consistency_engine_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artifact_id`) REFERENCES `consistency_engine_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `consistency_engine_proofs_hash_uidx` ON `consistency_engine_proofs` (`proof_hash`);--> statement-breakpoint
CREATE INDEX `consistency_engine_proofs_org_artifact_time_idx` ON `consistency_engine_proofs` (`organization_id`,`artifact_id`,`verified_at`);--> statement-breakpoint
CREATE TABLE `consistency_engine_security_epochs` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`current_epoch` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
