ALTER TABLE `backupSettings` MODIFY COLUMN `frequencyHours` int NOT NULL DEFAULT 6;--> statement-breakpoint
ALTER TABLE `backupSettings` MODIFY COLUMN `retentionCount` int NOT NULL DEFAULT 30;--> statement-breakpoint
ALTER TABLE `backupArchives` ADD `contentSha256` varchar(64);--> statement-breakpoint
ALTER TABLE `backupArchives` ADD `encryptionVersion` int DEFAULT 1 NOT NULL;