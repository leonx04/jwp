CREATE TABLE `debt_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`annual_rate` real NOT NULL,
	`months` integer NOT NULL,
	`method` text NOT NULL,
	`day_count` text DEFAULT 'monthly' NOT NULL,
	`start_date` text NOT NULL,
	`grace_months` integer DEFAULT 0 NOT NULL,
	`monthly_fee` integer DEFAULT 0 NOT NULL,
	`rate_steps` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "debt_terms_months_positive" CHECK("debt_terms"."months" > 0),
	CONSTRAINT "debt_terms_rate_non_negative" CHECK("debt_terms"."annual_rate" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `debt_terms_debt_unique` ON `debt_terms` (`debt_id`);--> statement-breakpoint
ALTER TABLE `debt_records` ADD `period` integer;--> statement-breakpoint
ALTER TABLE `debt_records` ADD `interest_transaction_id` text REFERENCES transactions(id) ON DELETE set null;