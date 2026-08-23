CREATE TABLE `adminFallbackPasswords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adminFallbackPasswords_id` PRIMARY KEY(`id`),
	CONSTRAINT `adminFallbackPasswords_ownerOpenId_unique` UNIQUE(`ownerOpenId`)
);
