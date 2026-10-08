-- What each user's calendar cells show, in order. Existing users start with the four values
-- cells always showed: net, weight, exercise count and steps.
CREATE TABLE `cell_fields` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`metric` text NOT NULL,
	`exercise_type_id` integer,
	`unit` text,
	`caption` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_type_id`) REFERENCES `exercise_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cell_fields_user_idx` ON `cell_fields` (`user_id`);--> statement-breakpoint
INSERT INTO `cell_fields` (`user_id`, `metric`, `caption`, `sort_order`)
SELECT `id`, 'net', 'N', 0 FROM `users`
UNION ALL SELECT `id`, 'weight', 'lb', 1 FROM `users`
UNION ALL SELECT `id`, 'exercises', 'Ex', 2 FROM `users`
UNION ALL SELECT `id`, 'steps', 'St', 3 FROM `users`;