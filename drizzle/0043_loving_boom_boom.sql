ALTER TABLE `sales` MODIFY COLUMN `channel` enum('pos','invoice','quote') NOT NULL DEFAULT 'invoice';--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `printerName` varchar(120) DEFAULT 'Imprimante système' NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `printerType` enum('browser','thermal') DEFAULT 'browser' NOT NULL;