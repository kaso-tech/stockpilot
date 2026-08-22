ALTER TABLE `saleSettings` ADD `paymentCashEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `paymentCardEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `paymentMobileMoneyEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `paymentBankTransferEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `paymentCreditEnabled` boolean DEFAULT true NOT NULL;