CREATE TABLE `ai_destination_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connector_deployment_id` text NOT NULL,
	`destination_type` text NOT NULL,
	`display_name` text NOT NULL,
	`configuration_json` text NOT NULL,
	`secret_reference` text,
	`verification_mode` text DEFAULT 'identity_retrieval' NOT NULL,
	`status` text DEFAULT 'configuration_pending' NOT NULL,
	`last_verified_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connector_deployment_id`) REFERENCES `connector_deployments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_destination_configurations_deployment_uidx` ON `ai_destination_configurations` (`connector_deployment_id`);--> statement-breakpoint
CREATE INDEX `ai_destination_configurations_org_status_idx` ON `ai_destination_configurations` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `integration_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`connector_deployment_id` text NOT NULL,
	`application_type` text NOT NULL,
	`api_endpoint` text,
	`authentication_method` text NOT NULL,
	`credential_reference` text NOT NULL,
	`required_permissions_json` text NOT NULL,
	`monitored_scopes_json` text NOT NULL,
	`verification_identity_ref` text,
	`policy_version` text NOT NULL,
	`connection_status` text DEFAULT 'awaiting_credentials' NOT NULL,
	`last_synchronization_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connector_deployment_id`) REFERENCES `connector_deployments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_configurations_deployment_uidx` ON `integration_configurations` (`connector_deployment_id`);--> statement-breakpoint
CREATE INDEX `integration_configurations_org_status_idx` ON `integration_configurations` (`organization_id`,`connection_status`);