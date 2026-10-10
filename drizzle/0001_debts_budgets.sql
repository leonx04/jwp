CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`category_ids` text,
	`account_ids` text,
	`order_num` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "budgets_amount_non_negative" CHECK("budgets"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE `debt_records` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`date` integer NOT NULL,
	`note` text,
	`account_id` text,
	`transaction_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "debt_records_amount_non_negative" CHECK("debt_records"."amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX `debt_records_debt_idx` ON `debt_records` (`debt_id`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`direction` text NOT NULL,
	`amount` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`date` integer NOT NULL,
	`due_date` text,
	`note` text,
	`account_id` text,
	`transaction_id` text,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "debts_amount_non_negative" CHECK("debts"."amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX `debts_person_idx` ON `debts` (`person_id`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text DEFAULT '' NOT NULL,
	`phone` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `debt_id` text REFERENCES debts(id) ON DELETE set null;