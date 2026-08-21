CREATE TABLE `agentPayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`beneficiaryType` enum('user','agent') NOT NULL,
	`beneficiaryId` int NOT NULL,
	`amountCents` int NOT NULL,
	`paidAt` timestamp NOT NULL DEFAULT (now()),
	`periodLabel` varchar(40),
	`note` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentPayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`type` enum('sales_agent','cashier') NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`type` enum('ordinary','wholesale') NOT NULL DEFAULT 'ordinary',
	`contactName` varchar(160),
	`email` varchar(320),
	`phone` varchar(50),
	`address` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventorySessionId` int NOT NULL,
	`productId` int NOT NULL,
	`expectedQuantity` int NOT NULL,
	`countedQuantity` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventorySessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` enum('draft','validated') NOT NULL DEFAULT 'draft',
	`createdByUserId` int NOT NULL,
	`validatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`validatedAt` timestamp,
	CONSTRAINT `inventorySessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `remunerationProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`beneficiaryType` enum('user','agent') NOT NULL,
	`beneficiaryId` int NOT NULL,
	`remunerationMode` enum('fixed','commission','fixed_plus_commission') NOT NULL DEFAULT 'commission',
	`fixedMonthlyCents` int NOT NULL DEFAULT 0,
	`commissionBasis` enum('revenue','net_profit') NOT NULL DEFAULT 'revenue',
	`rateBasisPoints` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `remunerationProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleCommissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`beneficiaryType` enum('user','agent') NOT NULL,
	`beneficiaryId` int NOT NULL,
	`commissionBasis` enum('revenue','net_profit') NOT NULL,
	`rateBasisPoints` int NOT NULL,
	`commissionCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saleCommissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(200) NOT NULL,
	`productReference` varchar(80) NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceCents` int NOT NULL,
	`purchasePriceCents` int NOT NULL,
	`lineTotalCents` int NOT NULL,
	`lineCostCents` int NOT NULL,
	CONSTRAINT `saleItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`defaultSalesAgentId` int,
	`defaultCashierId` int,
	`requireSalesAgent` boolean NOT NULL DEFAULT false,
	`requireCashier` boolean NOT NULL DEFAULT false,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saleSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(60) NOT NULL,
	`customerId` int NOT NULL,
	`sellerUserId` int NOT NULL,
	`salesAgentId` int,
	`cashierId` int,
	`status` enum('paid','void') NOT NULL DEFAULT 'paid',
	`paymentMethod` enum('cash','card','mobile_money','bank_transfer','credit') NOT NULL DEFAULT 'cash',
	`subtotalCents` int NOT NULL,
	`totalCents` int NOT NULL,
	`totalCostCents` int NOT NULL,
	`netProfitCents` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`voidedAt` timestamp,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','user','seller') NOT NULL DEFAULT 'seller';--> statement-breakpoint
UPDATE `users` SET `role` = 'seller' WHERE `role` = 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','seller') NOT NULL DEFAULT 'seller';--> statement-breakpoint
ALTER TABLE `products` ADD `retailPriceCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `wholesalePriceCents` int DEFAULT 0 NOT NULL;
