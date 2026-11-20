ALTER TABLE `saleSettings` ADD `customerSuggestionsEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `customerSuggestionsLimit` int DEFAULT 4 NOT NULL;