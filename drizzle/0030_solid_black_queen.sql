ALTER TABLE `purchaseOrderItems` ADD `receivedQuantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `cancellationReason` text;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `receivedAt` timestamp;