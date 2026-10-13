CREATE TABLE `capture_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern` text NOT NULL,
	`type` text,
	`category_id` text NOT NULL,
	`auto_accept` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "capture_rules_pattern_not_empty" CHECK(length(trim("capture_rules"."pattern")) > 0)
);
