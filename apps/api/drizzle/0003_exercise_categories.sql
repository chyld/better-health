-- Labels gain a category; existing labels get an empty one, to be filled in on the Labels page.
ALTER TABLE `exercise_types` ADD `category` text DEFAULT '' NOT NULL;
