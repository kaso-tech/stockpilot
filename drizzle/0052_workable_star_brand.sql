CREATE TABLE `sellerWarehouseAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`sellerUserId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sellerWarehouseAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `seller_warehouse_assignments_unique` UNIQUE(`companyId`,`sellerUserId`,`warehouseId`)
);
--> statement-breakpoint
CREATE INDEX `seller_warehouse_assignments_company_warehouse_idx` ON `sellerWarehouseAssignments` (`companyId`,`warehouseId`);--> statement-breakpoint
INSERT INTO `sellerWarehouseAssignments` (`companyId`, `sellerUserId`, `warehouseId`, `createdByUserId`)
SELECT u.`companyId`, u.`id`, w.`id`, u.`id`
FROM `users` u
INNER JOIN `warehouses` w ON w.`companyId` = u.`companyId` AND w.`active` = 1
WHERE u.`role` = 'seller' AND u.`active` = 1 AND u.`companyId` IS NOT NULL;
