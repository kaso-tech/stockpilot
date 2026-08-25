CREATE TABLE `vatRatePresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`label` varchar(80) NOT NULL,
	`rateBasisPoints` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vatRatePresets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `vat_rate_presets_company_rate_idx` ON `vatRatePresets` (`companyId`,`rateBasisPoints`);