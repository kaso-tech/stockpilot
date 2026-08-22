CREATE TABLE `productUnits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(30) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productUnits_id` PRIMARY KEY(`id`),
	CONSTRAINT `productUnits_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
INSERT IGNORE INTO `productUnits` (`name`)
SELECT DISTINCT `unit` FROM `products` WHERE `unit` IS NOT NULL AND `unit` <> '';
