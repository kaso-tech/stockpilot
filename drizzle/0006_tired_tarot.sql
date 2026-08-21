ALTER TABLE `saleSettings` ADD `companyName` varchar(200) DEFAULT 'StockPilot' NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `companyLogoUrl` text;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `companyAddress` text;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `companyPhone` varchar(50);--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `companyEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `companyFooter` text;