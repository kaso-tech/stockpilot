CREATE TABLE `authTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('password_reset','email_verification') NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_tokens_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
CREATE INDEX `auth_tokens_user_type_idx` ON `authTokens` (`userId`,`type`);--> statement-breakpoint
-- Les comptes existants sont considérés comme vérifiés : la vérification ne concerne que les nouvelles inscriptions.
UPDATE `users` SET `emailVerifiedAt` = NOW() WHERE `emailVerifiedAt` IS NULL;
