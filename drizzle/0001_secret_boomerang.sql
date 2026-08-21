CREATE TABLE `deployment_agent_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`run_id` text NOT NULL,
	`skill` text NOT NULL,
	`cycle` integer DEFAULT 0 NOT NULL,
	`sequence` integer NOT NULL,
	`status` text NOT NULL,
	`input_json` text NOT NULL,
	`output_json` text NOT NULL,
	`source_count` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `deployment_agent_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_agent_events_run_skill_cycle_uidx` ON `deployment_agent_events` (`run_id`,`skill`,`cycle`);--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_agent_events_run_sequence_uidx` ON `deployment_agent_events` (`run_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `deployment_agent_events_org_run_idx` ON `deployment_agent_events` (`organization_id`,`run_id`);--> statement-breakpoint
CREATE TABLE `deployment_agent_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`run_id` text NOT NULL,
	`skill` text NOT NULL,
	`claim` text NOT NULL,
	`classification` text NOT NULL,
	`source_title` text NOT NULL,
	`source_url` text NOT NULL,
	`source_type` text NOT NULL,
	`published_at` text,
	`accessed_at` text NOT NULL,
	`confidence` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `deployment_agent_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deployment_agent_evidence_org_run_idx` ON `deployment_agent_evidence` (`organization_id`,`run_id`);--> statement-breakpoint
CREATE TABLE `deployment_agent_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`run_id` text NOT NULL,
	`cycle` integer DEFAULT 0 NOT NULL,
	`severity` text NOT NULL,
	`component` text NOT NULL,
	`risk` text NOT NULL,
	`remediation` text NOT NULL,
	`owner` text NOT NULL,
	`validation_method` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `deployment_agent_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deployment_agent_findings_org_run_idx` ON `deployment_agent_findings` (`organization_id`,`run_id`);--> statement-breakpoint
CREATE TABLE `deployment_agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`request_key` text NOT NULL,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`current_stage` text DEFAULT 'research' NOT NULL,
	`hypothesis` text NOT NULL,
	`intake_json` text NOT NULL,
	`recommendation_json` text,
	`audit_json` text,
	`dossier_json` text,
	`revision_count` integer DEFAULT 0 NOT NULL,
	`research_as_of` text NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_agent_runs_org_request_uidx` ON `deployment_agent_runs` (`organization_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `deployment_agent_runs_org_time_idx` ON `deployment_agent_runs` (`organization_id`,`created_at`);