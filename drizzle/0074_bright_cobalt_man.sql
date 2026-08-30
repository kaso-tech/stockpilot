CREATE TABLE `saasPaymentIntents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`planId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`requestKey` varchar(64) NOT NULL,
	`reference` varchar(180) NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL,
	`billingInterval` enum('monthly') NOT NULL DEFAULT 'monthly',
	`provider` enum('yengapay') NOT NULL DEFAULT 'yengapay',
	`providerIntentId` varchar(180),
	`providerPaymentId` varchar(180),
	`providerStatus` varchar(80),
	`status` enum('created','pending','confirmed','failed','expired','cancelled','reconciliation_required') NOT NULL DEFAULT 'created',
	`paymentEventId` int,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saasPaymentIntents_id` PRIMARY KEY(`id`),
	CONSTRAINT `saasPaymentIntents_reference_unique` UNIQUE(`reference`),
	CONSTRAINT `saas_payment_intents_company_request_unique` UNIQUE(`companyId`,`requestKey`)
);
--> statement-breakpoint
ALTER TABLE `subscriptionPlans` ADD `monthlyPriceCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptionPlans` ADD `currency` varchar(3) DEFAULT 'XOF' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptionPlans` ADD `billingInterval` enum('monthly') DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
CREATE INDEX `saas_payment_intents_company_status_created_idx` ON `saasPaymentIntents` (`companyId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `saas_payment_intents_provider_intent_idx` ON `saasPaymentIntents` (`provider`,`providerIntentId`);