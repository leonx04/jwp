CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_amount` integer NOT NULL,
	`account_id` text,
	`saved_amount` integer DEFAULT 0 NOT NULL,
	`deadline` text,
	`icon` text,
	`color` text DEFAULT '#7C3AED' NOT NULL,
	`note` text,
	`order_num` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "goals_target_positive" CHECK("goals"."target_amount" > 0)
);
