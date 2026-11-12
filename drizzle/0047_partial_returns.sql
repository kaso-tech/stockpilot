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
	`companyId` int,
	`saleId` int NOT NULL,
	`creditNoteNumber` varchar(60) NOT NULL,
	`refundCents` int NOT NULL,
	`costCents` int NOT NULL DEFAULT 0,
	`method` enum('cash','card','mobile_money','bank_transfer','credit') NOT NULL,
	`reason` varchar(500),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saleReturns_id` PRIMARY KEY(`id`),
	CONSTRAINT `sale_returns_company_number_unique` UNIQUE(`companyId`,`creditNoteNumber`)
);
--> statement-breakpoint
ALTER TABLE `saleItems` ADD `returnedQuantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `returnedCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `returnedCostCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `sale_return_items_return_idx` ON `saleReturnItems` (`returnId`);--> statement-breakpoint
CREATE INDEX `sale_returns_company_sale_idx` ON `saleReturns` (`companyId`,`saleId`);