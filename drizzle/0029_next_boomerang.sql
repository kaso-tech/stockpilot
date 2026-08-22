CREATE TABLE `purchaseOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(200) NOT NULL,
	`productReference` varchar(80) NOT NULL,
	`unit` varchar(30) NOT NULL,
	`quantity` int NOT NULL,
	`purchasePriceCents` int NOT NULL,
	`lineTotalCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(60) NOT NULL,
	`supplierId` int NOT NULL,
	`status` enum('draft','sent','received','cancelled') NOT NULL DEFAULT 'draft',
	`totalCents` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseOrders_orderNumber_unique` UNIQUE(`orderNumber`)
);
