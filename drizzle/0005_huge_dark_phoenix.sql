CREATE TABLE `sellerCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(80) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sellerCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `sellerCredentials_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `sellerCredentials_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;