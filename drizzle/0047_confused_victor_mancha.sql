ALTER TABLE `saleSettings` ADD `invoiceTemplate` enum('classic','modern','minimal') DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `invoiceShowLogo` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `invoiceShowSignature` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `invoiceShowPaymentDetails` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `invoiceShowDelivery` boolean DEFAULT true NOT NULL;