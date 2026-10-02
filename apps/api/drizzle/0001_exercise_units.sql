-- Labels gain a unit; existing labels get an empty one, to be filled in on the Labels page.
ALTER TABLE `exercise_types` ADD `unit` text DEFAULT '' NOT NULL;--> statement-breakpoint
DROP INDEX `exercise_types_user_name_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_types_user_name_unit_unique` ON `exercise_types` (`user_id`,lower("name"),lower("unit"));--> statement-breakpoint
-- Entries trade the free-text note for an amount. A note like "3 miles" keeps its
-- leading number; anything else becomes 0.
ALTER TABLE `exercise_entries` ADD `amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `exercise_entries` SET `amount` = max(0, coalesce(cast(`note` AS real), 0));--> statement-breakpoint
ALTER TABLE `exercise_entries` DROP COLUMN `note`;
