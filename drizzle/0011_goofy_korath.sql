CREATE TABLE `salePayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`method` enum('cash','card','mobile_money','bank_transfer','credit') NOT NULL,
	`amountCents` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salePayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sales` MODIFY COLUMN `customerId` int;--> statement-breakpoint
ALTER TABLE `sales` MODIFY COLUMN `status` enum('draft','partial','paid','void') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `sales` ADD `channel` enum('pos','invoice') DEFAULT 'invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `amountPaidCents` int DEFAULT 0 NOT NULL;