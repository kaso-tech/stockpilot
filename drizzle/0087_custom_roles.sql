CREATE TABLE `customRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(300),
	`permissions` text NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customRoles_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_roles_company_name_unique` UNIQUE(`companyId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','seller','accountant','viewer','agent','cashier','storekeeper','purchaser','custom') NOT NULL DEFAULT 'seller';--> statement-breakpoint
ALTER TABLE `users` ADD `customRoleId` int;