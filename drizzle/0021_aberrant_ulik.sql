CREATE TABLE `userDashboardPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`preferencesJson` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userDashboardPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `userDashboardPreferences_userId_unique` UNIQUE(`userId`)
);
