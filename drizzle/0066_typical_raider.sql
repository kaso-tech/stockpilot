CREATE TABLE `platformNotificationReads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platformUserId` int NOT NULL,
	`notificationKey` varchar(180) NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platformNotificationReads_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_notification_reads_user_key_unique` UNIQUE(`platformUserId`,`notificationKey`)
);
--> statement-breakpoint
CREATE INDEX `platform_notification_reads_user_read_idx` ON `platformNotificationReads` (`platformUserId`,`readAt`);