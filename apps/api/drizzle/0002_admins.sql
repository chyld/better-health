-- Users gain an admin flag, off for everyone; granted with `bun run user:admin <username>`.
ALTER TABLE `users` ADD `is_admin` integer DEFAULT false NOT NULL;
