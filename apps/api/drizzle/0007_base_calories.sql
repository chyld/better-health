-- Each user's base burn per day, from a start date until their next change. Past days keep
-- the base in effect on their date. Existing calories out were whole burns, with no base.
CREATE TABLE `base_calories` (
	`user_id` integer NOT NULL,
	`starts_on` text NOT NULL,
	`calories` integer NOT NULL,
	PRIMARY KEY(`user_id`, `starts_on`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
