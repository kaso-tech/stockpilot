CREATE TABLE `companyLifecycleEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`action` enum('activated','suspended') NOT NULL,
	`reason` varchar(400),
	`actorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companyLifecycleEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platformAdminUsers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platformRole` enum('super_admin','operator') NOT NULL DEFAULT 'operator',
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platformAdminUsers_id` PRIMARY KEY(`id`),
	CONSTRAINT `platformAdminUsers_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `platformAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`companyId` int,
	`reason` varchar(400),
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platformAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `platformStatus` enum('active','suspended') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `suspendedAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `suspensionReason` varchar(400);--> statement-breakpoint
CREATE INDEX `company_lifecycle_company_created_idx` ON `companyLifecycleEvents` (`companyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `platform_audit_company_created_idx` ON `platformAuditLogs` (`companyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `platform_audit_actor_created_idx` ON `platformAuditLogs` (`actorUserId`,`createdAt`);