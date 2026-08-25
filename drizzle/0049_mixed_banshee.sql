CREATE TABLE `userWarehousePreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userWarehousePreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_warehouse_preferences_user_company_unique` UNIQUE(`userId`,`companyId`)
);
--> statement-breakpoint
CREATE INDEX `user_warehouse_preferences_company_warehouse_idx` ON `userWarehousePreferences` (`companyId`,`warehouseId`);