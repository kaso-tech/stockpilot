ALTER TABLE `warehouseStockAlerts` ADD `coverageDays` decimal(10,1);--> statement-breakpoint
ALTER TABLE `warehouseStockAlerts` ADD `urgency` enum('critical','high','medium') DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouseStockAlerts` ADD `acknowledgedAt` timestamp;--> statement-breakpoint
ALTER TABLE `warehouseStockAlerts` ADD `acknowledgedByUserId` int;