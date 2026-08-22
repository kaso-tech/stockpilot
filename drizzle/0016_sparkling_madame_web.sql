CREATE TABLE `expenseBudgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`amountCents` int NOT NULL,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenseBudgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `expenseBudgets_yearMonth_unique` UNIQUE(`yearMonth`)
);
