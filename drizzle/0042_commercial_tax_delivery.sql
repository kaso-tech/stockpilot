ALTER TABLE `purchaseOrders` ADD `subtotalCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `vatRateBasisPoints` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `vatCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `deliveryFeeCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `vatEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `vatRateBasisPoints` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `vatRateBasisPoints` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `vatCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `deliveryFeeCents` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `sales` MODIFY `channel` enum('pos','invoice','quote') DEFAULT 'invoice' NOT NULL;
