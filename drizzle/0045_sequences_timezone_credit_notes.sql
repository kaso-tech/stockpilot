CREATE TABLE `documentSequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`series` varchar(10) NOT NULL,
	`year` int NOT NULL,
	`lastValue` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentSequences_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_sequences_company_series_year_unique` UNIQUE(`companyId`,`series`,`year`)
);
--> statement-breakpoint
ALTER TABLE `purchaseOrders` DROP INDEX `purchaseOrders_orderNumber_unique`;--> statement-breakpoint
ALTER TABLE `sales` DROP INDEX `sales_invoiceNumber_unique`;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `timezone` varchar(64) DEFAULT 'Africa/Abidjan' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `creditNoteNumber` varchar(60);--> statement-breakpoint
ALTER TABLE `sales` ADD `refundedAt` timestamp;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD CONSTRAINT `purchase_orders_company_number_unique` UNIQUE(`companyId`,`orderNumber`);--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_company_invoice_number_unique` UNIQUE(`companyId`,`invoiceNumber`);