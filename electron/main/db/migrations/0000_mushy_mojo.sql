CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`type` text NOT NULL,
	`institution` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`plaid_account_id` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`condition_json` text NOT NULL,
	`last_triggered_at` integer
);
--> statement-breakpoint
CREATE TABLE `balance_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`balance_cents` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `balance_snapshots_account_recorded` ON `balance_snapshots` (`account_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`agent_token` text NOT NULL,
	`last_seen_at` integer,
	`last_metrics_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_agent_token_unique` ON `devices` (`agent_token`);--> statement-breakpoint
CREATE TABLE `home_value_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`value_cents` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `home_value_snapshots_property_recorded` ON `home_value_snapshots` (`property_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `monthly_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`due_day` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mortgage_extra_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`mortgage_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`applied_date` integer NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`mortgage_id`) REFERENCES `mortgages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mortgages` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`property_id` text,
	`original_principal_cents` integer NOT NULL,
	`interest_rate_bps` integer NOT NULL,
	`term_months` integer NOT NULL,
	`start_date` integer NOT NULL,
	`payment_day_of_month` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`purchase_price_cents` integer NOT NULL,
	`purchase_date` integer NOT NULL,
	`beds` real,
	`baths` real,
	`sqft` integer,
	`year_built` integer,
	`zillow_zpid` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`checked_at` integer NOT NULL,
	`status_code` integer,
	`response_ms` integer,
	`ok` integer NOT NULL,
	`error_message` text,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `site_checks_site_checked` ON `site_checks` (`site_id`,`checked_at`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`check_interval_seconds` integer DEFAULT 300 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`alert_on_down` integer DEFAULT true NOT NULL,
	`alert_on_slow_ms` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`posted_at` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`merchant` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`plaid_transaction_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_plaid_transaction_id_unique` ON `transactions` (`plaid_transaction_id`);--> statement-breakpoint
CREATE INDEX `transactions_account_posted` ON `transactions` (`account_id`,`posted_at`);