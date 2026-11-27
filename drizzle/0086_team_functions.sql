ALTER TABLE `agents` MODIFY COLUMN `type` enum('sales_agent','cashier','staff') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','seller','accountant','viewer','agent','cashier','storekeeper','purchaser') NOT NULL DEFAULT 'seller';--> statement-breakpoint
ALTER TABLE `agents` ADD `jobTitle` varchar(80);