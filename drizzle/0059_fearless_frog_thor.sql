CREATE TABLE `companySyncHealth` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`status` enum('healthy','pending','failed','offline') NOT NULL DEFAULT 'healthy',
	`pendingOperations` int NOT NULL DEFAULT 0,
	`failedOperations` int NOT NULL DEFAULT 0,
	`lastSyncedAt` timestamp,
	`reportedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companySyncHealth_id` PRIMARY KEY(`id`),
	CONSTRAINT `companySyncHealth_companyId_unique` UNIQUE(`companyId`)
);
--> statement-breakpoint
CREATE INDEX `company_sync_health_status_updated_idx` ON `companySyncHealth` (`status`,`updatedAt`);