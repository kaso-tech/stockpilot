ALTER TABLE `saleSettings` ADD `ticketHeader` varchar(160) DEFAULT 'Merci de votre achat' NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `ticketFooter` varchar(240) DEFAULT 'À bientôt' NOT NULL;--> statement-breakpoint
ALTER TABLE `saleSettings` ADD `ticketWidthMm` enum('58','80') DEFAULT '80' NOT NULL;