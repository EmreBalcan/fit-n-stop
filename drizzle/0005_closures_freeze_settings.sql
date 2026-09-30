ALTER TABLE `members` ADD `freeze_used` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `members` ADD `frozen_until` text;
--> statement-breakpoint
CREATE TABLE `closed_days` (
	`date` text PRIMARY KEY NOT NULL,
	`reason` text DEFAULT 'Salon kapalı' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gym_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
