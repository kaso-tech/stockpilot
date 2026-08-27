CREATE TABLE `paymentDueBeneficiaryGroupMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`groupId` int NOT NULL,
	`beneficiaryType` enum('user','agent') NOT NULL,
	`beneficiaryId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentDueBeneficiaryGroupMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_due_group_members_unique` UNIQUE(`groupId`,`beneficiaryType`,`beneficiaryId`)
);
--> statement-breakpoint
CREATE TABLE `paymentDueBeneficiaryGroups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int,
	`name` varchar(120) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentDueBeneficiaryGroups_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_due_groups_company_name_unique` UNIQUE(`companyId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `paymentDueTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int,
	`name` varchar(120) NOT NULL,
	`scheduleType` enum('expense','salary') NOT NULL,
	`expenseCategory` enum('rent','energy','connection','salary','marketing','supplies','taxes','other'),
	`amountCents` int NOT NULL,
	`recurrence` enum('once','monthly') NOT NULL DEFAULT 'monthly',
	`dueDay` int,
	`reminderDaysJson` varchar(80) NOT NULL DEFAULT '[7,3,1]',
	`responsibleUserId` int,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentDueTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_due_templates_company_name_unique` UNIQUE(`companyId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `paymentDueSchedules` ADD `beneficiaryGroupId` int;--> statement-breakpoint
ALTER TABLE `paymentDueSchedules` ADD `templateId` int;--> statement-breakpoint
CREATE INDEX `payment_due_group_members_company_idx` ON `paymentDueBeneficiaryGroupMembers` (`companyId`,`groupId`);--> statement-breakpoint
CREATE INDEX `payment_due_groups_company_warehouse_idx` ON `paymentDueBeneficiaryGroups` (`companyId`,`warehouseId`);--> statement-breakpoint
CREATE INDEX `payment_due_templates_company_type_idx` ON `paymentDueTemplates` (`companyId`,`scheduleType`);