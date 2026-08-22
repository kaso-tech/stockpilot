ALTER TABLE `saleSettings` ADD `sellerCanOverridePrice` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanSellBelowPrice` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerMaxDiscountPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanCancelInvoice` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanRefund` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanCorrectStock` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `sellerCanEditPurchasePrice` boolean DEFAULT false NOT NULL;