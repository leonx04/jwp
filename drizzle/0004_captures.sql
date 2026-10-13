CREATE TABLE `captures` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`source` text NOT NULL,
	`sender` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`posted_at` integer NOT NULL,
	`type` text,
	`amount` integer,
	`balance_after` integer,
	`content` text DEFAULT '' NOT NULL,
	`counterparty` text,
	`bank_code` text,
	`account_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`transaction_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captures_fingerprint_unique` ON `captures` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `captures_status_idx` ON `captures` (`status`);