ALTER TABLE `saleItems` ADD `discountType` enum('none','percent','fixed') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `saleItems` ADD `discountValue` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleItems` ADD `discountCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleItems` ADD `lineSubtotalCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `invoiceDiscountType` enum('none','percent','fixed') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `invoiceDiscountValue` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `invoiceDiscountCents` int DEFAULT 0 NOT NULL;