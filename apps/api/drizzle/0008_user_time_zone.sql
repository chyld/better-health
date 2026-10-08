-- The zone whose date decides which days a user can still change; set on the Profile page.
ALTER TABLE `users` ADD `time_zone` text DEFAULT 'UTC' NOT NULL;