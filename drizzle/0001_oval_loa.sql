ALTER TABLE `members` ADD `tc_hash` text;--> statement-breakpoint
ALTER TABLE `members` ADD `tc_last4` text;--> statement-breakpoint
ALTER TABLE `members` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `members` ADD `password_salt` text;--> statement-breakpoint
ALTER TABLE `members` ADD `must_change_password` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `members_tc_hash_unique` ON `members` (`tc_hash`);