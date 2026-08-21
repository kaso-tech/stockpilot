ALTER TABLE `saleSettings` ADD `companySignatureUrl` text;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `companySignatureLabel` varchar(120) DEFAULT 'Signature & cachet' NOT NULL;