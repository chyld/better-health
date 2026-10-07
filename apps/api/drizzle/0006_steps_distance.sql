-- Daily step count and distance walked or run, logged like calories and weight.
ALTER TABLE `daily_logs` ADD `steps` integer;--> statement-breakpoint
ALTER TABLE `daily_logs` ADD `distance_miles` real;