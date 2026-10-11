ALTER TABLE `accounts` ADD `is_credit` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `credit_limit` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `statement_day` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `due_day` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `payment_account_id` text;--> statement-breakpoint
ALTER TABLE `schedules` ADD `kind` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `schedules` ADD `link_transaction_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `external_ref` text;--> statement-breakpoint
CREATE INDEX `transactions_external_ref_idx` ON `transactions` (`external_ref`);