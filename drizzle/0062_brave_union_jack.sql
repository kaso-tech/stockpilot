CREATE TABLE `companySubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`planId` int,
	`status` enum('trial','active','past_due','suspended','cancelled','manual') NOT NULL DEFAULT 'manual',
	`trialEndsAt` timestamp,
	`currentPeriodEndsAt` timestamp,
	`graceEndsAt` timestamp,
	`cancelledAt` timestamp,
	`updatedByPlatformUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companySubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `companySubscriptions_companyId_unique` UNIQUE(`companyId`)
);
--> statement-breakpoint
CREATE TABLE `subscriptionPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(48) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`trialDays` int NOT NULL DEFAULT 0,
	`limitsJson` varchar(4000) NOT NULL DEFAULT '{}',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptionPlans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptionPlans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE INDEX `company_subscriptions_status_ends_idx` ON `companySubscriptions` (`status`,`currentPeriodEndsAt`);--> statement-breakpoint
CREATE INDEX `subscription_plans_active_sort_idx` ON `subscriptionPlans` (`active`,`sortOrder`);