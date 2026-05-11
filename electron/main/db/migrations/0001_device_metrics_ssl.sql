CREATE TABLE `device_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`cpu` real NOT NULL,
	`ram` real NOT NULL,
	`disk` real NOT NULL,
	`battery` real,
	`network` real,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `device_metrics_device_recorded` ON `device_metrics` (`device_id`,`recorded_at`);
--> statement-breakpoint
ALTER TABLE `sites` ADD COLUMN `ssl_expires_at` integer;
