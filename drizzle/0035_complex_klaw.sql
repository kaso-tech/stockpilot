CREATE TABLE `userSessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`deviceLabel` varchar(160) NOT NULL,
	`userAgent` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	CONSTRAINT `userSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `userSessions` (`userId`);