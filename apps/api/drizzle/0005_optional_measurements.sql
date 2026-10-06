-- Labels lose their unit; units move to optional measurements on each logged exercise,
-- so "Running" can be logged with no amount, or with miles and/or minutes.
CREATE TABLE `exercise_measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`unit` text NOT NULL,
	`amount` real NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `exercise_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_measurements_entry_unit_unique` ON `exercise_measurements` (`entry_id`,`unit`);--> statement-breakpoint
-- Each entry's amount becomes a measurement in its label's unit; labels from before units
-- count "reps". An amount of 0 (a note that held no number) becomes no measurement.
INSERT INTO `exercise_measurements` (`entry_id`, `unit`, `amount`)
SELECT e.`id`, coalesce(nullif(lower(trim(t.`unit`)), ''), 'reps'), e.`amount`
FROM `exercise_entries` e JOIN `exercise_types` t ON t.`id` = e.`exercise_type_id`
WHERE e.`amount` > 0;--> statement-breakpoint
-- Exercise highlight rules keep comparing the unit their label had.
ALTER TABLE `highlight_rules` ADD `unit` text;--> statement-breakpoint
UPDATE `highlight_rules` SET `unit` = (
	SELECT coalesce(nullif(lower(trim(t.`unit`)), ''), 'reps') FROM `exercise_types` t
	WHERE t.`id` = `highlight_rules`.`exercise_type_id`
) WHERE `exercise_type_id` IS NOT NULL;--> statement-breakpoint
-- Labels that differed only by unit ("Walking (miles)", "Walking (minutes)") merge into the
-- one with the most entries, preferring an active one; entries and rules move to it.
CREATE TEMP TABLE `label_merge` AS
SELECT t.`id` AS `old_id`, (
	SELECT k.`id` FROM `exercise_types` k
	WHERE k.`user_id` = t.`user_id` AND lower(k.`name`) = lower(t.`name`)
	ORDER BY (SELECT count(*) FROM `exercise_entries` e WHERE e.`exercise_type_id` = k.`id`) DESC,
		k.`archived_at` IS NOT NULL, k.`sort_order`, k.`id`
	LIMIT 1
) AS `keep_id`
FROM `exercise_types` t;--> statement-breakpoint
UPDATE `exercise_entries` SET `exercise_type_id` = (
	SELECT `keep_id` FROM `label_merge` WHERE `old_id` = `exercise_entries`.`exercise_type_id`
);--> statement-breakpoint
UPDATE `highlight_rules` SET `exercise_type_id` = (
	SELECT `keep_id` FROM `label_merge` WHERE `old_id` = `highlight_rules`.`exercise_type_id`
) WHERE `exercise_type_id` IS NOT NULL;--> statement-breakpoint
-- A kept label without a category takes one from a merged label.
UPDATE `exercise_types` SET `category` = coalesce((
	SELECT min(o.`category`) FROM `label_merge` m JOIN `exercise_types` o ON o.`id` = m.`old_id`
	WHERE m.`keep_id` = `exercise_types`.`id` AND o.`category` <> ''
), '') WHERE `category` = '';--> statement-breakpoint
-- The merged label stays active if any of its parts was.
UPDATE `exercise_types` SET `archived_at` = NULL WHERE `id` IN (
	SELECT m.`keep_id` FROM `label_merge` m JOIN `exercise_types` o ON o.`id` = m.`old_id`
	WHERE o.`archived_at` IS NULL
);--> statement-breakpoint
DELETE FROM `exercise_types` WHERE `id` NOT IN (SELECT `keep_id` FROM `label_merge`);--> statement-breakpoint
DROP TABLE `label_merge`;--> statement-breakpoint
DROP INDEX `exercise_types_user_name_unit_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `exercise_types_user_name_unique` ON `exercise_types` (`user_id`,lower("name"));--> statement-breakpoint
ALTER TABLE `exercise_types` DROP COLUMN `unit`;--> statement-breakpoint
ALTER TABLE `exercise_entries` DROP COLUMN `amount`;
