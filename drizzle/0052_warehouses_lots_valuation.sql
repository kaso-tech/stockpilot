CREATE TABLE `productStocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	CONSTRAINT `productStocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_stocks_product_warehouse_unique` UNIQUE(`productId`,`warehouseId`)
);
--> statement-breakpoint
CREATE TABLE `stockLots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`productId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`lotNumber` varchar(80) NOT NULL,
	`expiryDate` varchar(10),
	`quantity` int NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockLots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`name` varchar(120) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouses_company_name_unique` UNIQUE(`companyId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `stockMovements` ADD `warehouseId` int;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD `unitCostCents` int;--> statement-breakpoint
CREATE INDEX `stock_lots_product_idx` ON `stockLots` (`productId`,`warehouseId`);--> statement-breakpoint
CREATE INDEX `stock_lots_company_expiry_idx` ON `stockLots` (`companyId`,`expiryDate`);--> statement-breakpoint
-- Un dépôt principal par entreprise, qui reprend tout le stock existant.
INSERT INTO `warehouses` (`companyId`, `name`, `isDefault`) SELECT `id`, 'Dépôt principal', true FROM `companies`;--> statement-breakpoint
INSERT INTO `productStocks` (`productId`, `warehouseId`, `quantity`) SELECT p.`id`, w.`id`, p.`quantity` FROM `products` p JOIN `warehouses` w ON w.`companyId` = p.`companyId` AND w.`isDefault` = true;
