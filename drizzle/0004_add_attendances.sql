CREATE TABLE `attendances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`date` text NOT NULL,
	`checked_in_at` text NOT NULL,
	`reservation_time_slot` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendances_member_date_unique` ON `attendances` (`member_id`,`date`);
--> statement-breakpoint
CREATE INDEX `attendances_date_idx` ON `attendances` (`date`);
--> statement-breakpoint
PRAGMA optimize;
