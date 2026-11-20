ALTER TABLE `saasPaymentIntents` MODIFY COLUMN `billingInterval` enum('monthly','annual','lifetime') NOT NULL DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE `subscriptionPlans` MODIFY COLUMN `billingInterval` enum('monthly','annual','lifetime') NOT NULL DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE `subscriptionPlans` ADD `priceCents` int DEFAULT 0 NOT NULL;