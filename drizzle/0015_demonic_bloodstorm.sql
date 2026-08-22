CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('rent','energy','connection','salary','marketing','supplies','taxes','other') NOT NULL,
	`description` varchar(300) NOT NULL,
	`amountCents` int NOT NULL,
	`spentAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
