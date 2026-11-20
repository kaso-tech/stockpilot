CREATE TABLE `stockTransferItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stockTransferId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(200) NOT NULL,
	`productReference` varchar(80) NOT NULL,
	`unit` varchar(30) NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockTransferItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_transfer_items_transfer_product_unique` UNIQUE(`stockTransferId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `stockTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`transferNumber` varchar(60) NOT NULL,
	`sourceWarehouseId` int NOT NULL,
	`destinationWarehouseId` int NOT NULL,
	`status` enum('draft','in_transit','received','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`cancellationReason` text,
	`createdByUserId` int NOT NULL,
	`dispatchedByUserId` int,
	`receivedByUserId` int,
	`cancelledByUserId` int,
	`dispatchedAt` timestamp,
	`receivedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stockTransfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `stockTransfers_transferNumber_unique` UNIQUE(`transferNumber`)
);
--> statement-breakpoint
CREATE TABLE `warehouseStocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`warehouseId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouseStocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouse_stocks_warehouse_product_unique` UNIQUE(`warehouseId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(160) NOT NULL,
	`code` varchar(40) NOT NULL,
	`address` text,
	`active` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouses_company_code_unique` UNIQUE(`companyId`,`code`)
);
--> statement-breakpoint
ALTER TABLE `inventorySessions` ADD `warehouseId` int;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `warehouseId` int;--> statement-breakpoint
ALTER TABLE `sales` ADD `warehouseId` int;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD `warehouseId` int;--> statement-breakpoint
CREATE INDEX `stock_transfer_items_transfer_idx` ON `stockTransferItems` (`stockTransferId`);--> statement-breakpoint
CREATE INDEX `stock_transfers_company_status_idx` ON `stockTransfers` (`companyId`,`status`);--> statement-breakpoint
CREATE INDEX `stock_transfers_company_created_idx` ON `stockTransfers` (`companyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `stock_transfers_source_idx` ON `stockTransfers` (`sourceWarehouseId`);--> statement-breakpoint
CREATE INDEX `stock_transfers_destination_idx` ON `stockTransfers` (`destinationWarehouseId`);--> statement-breakpoint
CREATE INDEX `warehouse_stocks_company_warehouse_idx` ON `warehouseStocks` (`companyId`,`warehouseId`);--> statement-breakpoint
CREATE INDEX `warehouse_stocks_company_product_idx` ON `warehouseStocks` (`companyId`,`productId`);--> statement-breakpoint
CREATE INDEX `warehouses_company_active_idx` ON `warehouses` (`companyId`,`active`);
--> statement-breakpoint
INSERT INTO `warehouses` (`companyId`, `name`, `code`, `active`, `isDefault`)
SELECT `companies`.`id`, 'Entrepôt principal', 'PRINCIPAL', true, true
FROM `companies`
WHERE NOT EXISTS (
  SELECT 1 FROM `warehouses`
  WHERE `warehouses`.`companyId` = `companies`.`id`
    AND `warehouses`.`isDefault` = true
);
--> statement-breakpoint
INSERT INTO `warehouses` (`companyId`, `name`, `code`, `active`, `isDefault`)
SELECT NULL, 'Entrepôt principal', 'PRINCIPAL', true, true
WHERE (EXISTS (SELECT 1 FROM `products` WHERE `products`.`companyId` IS NULL)
  OR EXISTS (SELECT 1 FROM `users` WHERE `users`.`companyId` IS NULL))
  AND NOT EXISTS (
    SELECT 1 FROM `warehouses`
    WHERE `warehouses`.`companyId` IS NULL
      AND `warehouses`.`isDefault` = true
  );
--> statement-breakpoint
INSERT INTO `warehouseStocks` (`companyId`, `warehouseId`, `productId`, `quantity`)
SELECT `products`.`companyId`, `warehouses`.`id`, `products`.`id`, `products`.`quantity`
FROM `products`
INNER JOIN `warehouses`
  ON ((`warehouses`.`companyId` = `products`.`companyId`) OR (`warehouses`.`companyId` IS NULL AND `products`.`companyId` IS NULL))
  AND `warehouses`.`isDefault` = true
LEFT JOIN `warehouseStocks`
  ON `warehouseStocks`.`warehouseId` = `warehouses`.`id`
  AND `warehouseStocks`.`productId` = `products`.`id`
WHERE `warehouseStocks`.`id` IS NULL;
--> statement-breakpoint
UPDATE `sales`
INNER JOIN `warehouses`
  ON ((`warehouses`.`companyId` = `sales`.`companyId`) OR (`warehouses`.`companyId` IS NULL AND `sales`.`companyId` IS NULL))
  AND `warehouses`.`isDefault` = true
SET `sales`.`warehouseId` = `warehouses`.`id`
WHERE `sales`.`warehouseId` IS NULL;
--> statement-breakpoint
UPDATE `stockMovements`
INNER JOIN `warehouses`
  ON ((`warehouses`.`companyId` = `stockMovements`.`companyId`) OR (`warehouses`.`companyId` IS NULL AND `stockMovements`.`companyId` IS NULL))
  AND `warehouses`.`isDefault` = true
SET `stockMovements`.`warehouseId` = `warehouses`.`id`
WHERE `stockMovements`.`warehouseId` IS NULL;
--> statement-breakpoint
UPDATE `inventorySessions`
INNER JOIN `warehouses`
  ON ((`warehouses`.`companyId` = `inventorySessions`.`companyId`) OR (`warehouses`.`companyId` IS NULL AND `inventorySessions`.`companyId` IS NULL))
  AND `warehouses`.`isDefault` = true
SET `inventorySessions`.`warehouseId` = `warehouses`.`id`
WHERE `inventorySessions`.`warehouseId` IS NULL;
--> statement-breakpoint
UPDATE `purchaseOrders`
INNER JOIN `warehouses`
  ON ((`warehouses`.`companyId` = `purchaseOrders`.`companyId`) OR (`warehouses`.`companyId` IS NULL AND `purchaseOrders`.`companyId` IS NULL))
  AND `warehouses`.`isDefault` = true
SET `purchaseOrders`.`warehouseId` = `warehouses`.`id`
WHERE `purchaseOrders`.`warehouseId` IS NULL;
