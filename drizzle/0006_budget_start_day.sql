PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`category_ids` text,
	`account_ids` text,
	`start_day` integer,
	`order_num` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "budgets_amount_non_negative" CHECK("__new_budgets"."amount" >= 0),
	CONSTRAINT "budgets_start_day_range" CHECK("__new_budgets"."start_day" is null or "__new_budgets"."start_day" between 1 and 31)
);
--> statement-breakpoint
INSERT INTO `__new_budgets`("id", "name", "amount", "category_ids", "account_ids", "order_num", "created_at", "updated_at") SELECT "id", "name", "amount", "category_ids", "account_ids", "order_num", "created_at", "updated_at" FROM `budgets`;--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;