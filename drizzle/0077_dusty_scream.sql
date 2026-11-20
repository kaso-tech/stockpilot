CREATE TABLE `authTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('password_reset','email_verification') NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`emailHash` varchar(64),
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `authTokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `cashClosures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`businessDay` varchar(10) NOT NULL,
	`openingFloatCents` int NOT NULL DEFAULT 0,
	`cashSalesCents` int NOT NULL DEFAULT 0,
	`expectedCashCents` int NOT NULL,
	`countedCashCents` int NOT NULL,
	`differenceCents` int NOT NULL,
	`totalsByMethodJson` text NOT NULL,
	`documentCount` int NOT NULL DEFAULT 0,
	`note` varchar(500),
	`closedByUserId` int NOT NULL,
	`closedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashClosures_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_closures_company_warehouse_day_unique` UNIQUE(`companyId`,`warehouseId`,`businessDay`)
);
--> statement-breakpoint
CREATE TABLE `documentSequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`series` enum('FAC','POS','DEV','AV','BC') NOT NULL,
	`year` int NOT NULL,
	`lastValue` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentSequences_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_sequences_company_series_year_unique` UNIQUE(`companyId`,`series`,`year`)
);
--> statement-breakpoint
CREATE TABLE `saleReturnItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`returnId` int NOT NULL,
	`saleItemId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`restocked` boolean NOT NULL DEFAULT true,
	`refundCents` int NOT NULL,
	CONSTRAINT `saleReturnItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saleReturns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`saleId` int NOT NULL,
	`requestKey` varchar(80) NOT NULL,
	`requestFingerprint` varchar(64) NOT NULL,
	`creditNoteNumber` varchar(60) NOT NULL,
	`refundCents` int NOT NULL,
	`costCents` int NOT NULL DEFAULT 0,
	`method` enum('cash','card','mobile_money','bank_transfer','credit') NOT NULL,
	`reason` varchar(500),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saleReturns_id` PRIMARY KEY(`id`),
	CONSTRAINT `sale_returns_company_request_unique` UNIQUE(`companyId`,`requestKey`),
	CONSTRAINT `sale_returns_company_credit_note_unique` UNIQUE(`companyId`,`creditNoteNumber`)
);
--> statement-breakpoint
CREATE TABLE `stockLots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`productId` int NOT NULL,
	`lotNumber` varchar(80) NOT NULL,
	`expiryDate` varchar(10),
	`quantity` int NOT NULL,
	`unitCostCents` int NOT NULL DEFAULT 0,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockLots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `productCategories` DROP INDEX `productCategories_name_unique`;--> statement-breakpoint
ALTER TABLE `productUnits` DROP INDEX `productUnits_name_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','seller','accountant','viewer') NOT NULL DEFAULT 'seller';--> statement-breakpoint
ALTER TABLE `products` ADD `categoryId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `unitId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `vatRateBasisPoints` int;--> statement-breakpoint
ALTER TABLE `saleItems` ADD `returnedQuantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleItems` ADD `vatRateBasisPoints` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleItems` ADD `vatCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `timezone` varchar(64) DEFAULT 'Africa/Abidjan' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `creditNoteNumber` varchar(60);--> statement-breakpoint
ALTER TABLE `sales` ADD `refundedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sales` ADD `returnedCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `returnedCostCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stockTransferItems` ADD `lotsJson` text;--> statement-breakpoint
ALTER TABLE `stockTransferItems` ADD `unitCostCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `warehouseStocks` ADD `averageCostCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `productCategories` ADD CONSTRAINT `product_categories_company_name_unique` UNIQUE(`companyId`,`name`);--> statement-breakpoint
ALTER TABLE `productUnits` ADD CONSTRAINT `product_units_company_name_unique` UNIQUE(`companyId`,`name`);--> statement-breakpoint
CREATE INDEX `auth_tokens_user_type_idx` ON `authTokens` (`userId`,`type`);--> statement-breakpoint
CREATE INDEX `cash_closures_company_warehouse_day_idx` ON `cashClosures` (`companyId`,`warehouseId`,`businessDay`);--> statement-breakpoint
CREATE INDEX `sale_return_items_return_idx` ON `saleReturnItems` (`returnId`);--> statement-breakpoint
CREATE INDEX `sale_returns_company_sale_idx` ON `saleReturns` (`companyId`,`saleId`);--> statement-breakpoint
CREATE INDEX `stock_lots_company_warehouse_product_idx` ON `stockLots` (`companyId`,`warehouseId`,`productId`);--> statement-breakpoint
CREATE INDEX `stock_lots_company_expiry_idx` ON `stockLots` (`companyId`,`expiryDate`);--> statement-breakpoint
CREATE INDEX `products_company_category_ref_idx` ON `products` (`companyId`,`categoryId`);--> statement-breakpoint
CREATE INDEX `products_company_unit_ref_idx` ON `products` (`companyId`,`unitId`);