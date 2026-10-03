-- Per-user rules that colour calendar cells, such as "weight < 200 → green".
CREATE TABLE `highlight_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`metric` text NOT NULL,
	`exercise_type_id` integer,
	`operator` text NOT NULL,
	`target` real NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_type_id`) REFERENCES `exercise_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `highlight_rules_user_idx` ON `highlight_rules` (`user_id`);