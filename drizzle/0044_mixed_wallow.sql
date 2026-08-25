ALTER TABLE `saleSettings` ADD `sellerCanToggleVat` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanLineDiscount` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerMaxLineDiscountPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanInvoiceDiscount` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerMaxInvoiceDiscountPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanCartDiscount` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerMaxCartDiscountPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanEditInvoiceItemPrice` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerMaxInvoiceItemPriceChangePercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanEditCartItemPrice` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerMaxCartItemPriceChangePercent` int DEFAULT 0 NOT NULL;