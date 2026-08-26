CREATE TABLE `warehouseReorderThresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`productId` int NOT NULL,
	`threshold` int NOT NULL DEFAULT 0,
	`updatedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouseReorderThresholds_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouse_reorder_thresholds_unique` UNIQUE(`companyId`,`warehouseId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `warehouseStockAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`productId` int NOT NULL,
	`threshold` int NOT NULL,
	`observedQuantity` int NOT NULL,
	`status` enum('active','resolved') NOT NULL DEFAULT 'active',
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouseStockAlerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouse_stock_alerts_unique` UNIQUE(`companyId`,`warehouseId`,`productId`)
);
--> statement-breakpoint
ALTER TABLE `sellerWarehouseAssignments` ADD `warehouseRole` enum('manager','cashier','seller') DEFAULT 'seller' NOT NULL;--> statement-breakpoint
CREATE INDEX `warehouse_reorder_thresholds_company_warehouse_idx` ON `warehouseReorderThresholds` (`companyId`,`warehouseId`);--> statement-breakpoint
CREATE INDEX `warehouse_stock_alerts_company_warehouse_status_idx` ON `warehouseStockAlerts` (`companyId`,`warehouseId`,`status`);
--> statement-breakpoint
INSERT INTO `warehouseReorderThresholds` (`companyId`, `warehouseId`, `productId`, `threshold`, `updatedByUserId`)
SELECT `warehouseStocks`.`companyId`, `warehouseStocks`.`warehouseId`, `warehouseStocks`.`productId`, `products`.`minimumQuantity`, COALESCE(`warehouses`.`createdByUserId`, 0)
FROM `warehouseStocks`
INNER JOIN `products` ON `products`.`id` = `warehouseStocks`.`productId`
INNER JOIN `warehouses` ON `warehouses`.`id` = `warehouseStocks`.`warehouseId`
WHERE `warehouseStocks`.`companyId` IS NOT NULL
ON DUPLICATE KEY UPDATE `threshold` = VALUES(`threshold`), `updatedByUserId` = VALUES(`updatedByUserId`);
--> statement-breakpoint
INSERT INTO `warehouseStockAlerts` (`companyId`, `warehouseId`, `productId`, `threshold`, `observedQuantity`, `status`)
SELECT `warehouseStocks`.`companyId`, `warehouseStocks`.`warehouseId`, `warehouseStocks`.`productId`, `warehouseReorderThresholds`.`threshold`, `warehouseStocks`.`quantity`, 'active'
FROM `warehouseStocks`
INNER JOIN `warehouseReorderThresholds` ON `warehouseReorderThresholds`.`companyId` = `warehouseStocks`.`companyId` AND `warehouseReorderThresholds`.`warehouseId` = `warehouseStocks`.`warehouseId` AND `warehouseReorderThresholds`.`productId` = `warehouseStocks`.`productId`
WHERE `warehouseReorderThresholds`.`threshold` > 0 AND `warehouseStocks`.`quantity` <= `warehouseReorderThresholds`.`threshold`
ON DUPLICATE KEY UPDATE `threshold` = VALUES(`threshold`), `observedQuantity` = VALUES(`observedQuantity`), `status` = 'active', `resolvedAt` = NULL;
