CREATE TABLE `backupArchives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(220) NOT NULL,
	`trigger` enum('manual','scheduled') NOT NULL,
	`status` enum('completed','failed') NOT NULL DEFAULT 'completed',
	`storageKey` text,
	`storageUrl` text,
	`sizeBytes` int NOT NULL DEFAULT 0,
	`recordCount` int NOT NULL DEFAULT 0,
	`googleDriveFileId` varchar(180),
	`googleDriveUrl` text,
	`createdByUserId` int,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backupArchives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backupSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automaticEnabled` boolean NOT NULL DEFAULT true,
	`frequencyHours` int NOT NULL DEFAULT 24,
	`retentionCount` int NOT NULL DEFAULT 14,
	`scheduleCronTaskUid` varchar(65),
	`scheduleNextAt` timestamp,
	`googleDriveFolderId` varchar(180),
	`googleDriveAccessTokenEncrypted` text,
	`googleDriveRefreshTokenEncrypted` text,
	`googleDriveTokenExpiresAt` timestamp,
	`googleDriveOauthState` varchar(120),
	`lastBackupAt` timestamp,
	`lastBackupStatus` enum('idle','success','failed') NOT NULL DEFAULT 'idle',
	`lastBackupError` text,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backupSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `backupSettings_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
