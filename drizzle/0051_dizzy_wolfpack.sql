ALTER TABLE `expenseBudgets` DROP INDEX `expenseBudgets_yearMonth_unique`;--> statement-breakpoint
ALTER TABLE `expenseBudgets` ADD `warehouseId` int;--> statement-breakpoint
UPDATE `expenseBudgets` b INNER JOIN `warehouses` w ON w.`companyId` = b.`companyId` AND w.`isDefault` = 1 SET b.`warehouseId` = w.`id` WHERE b.`warehouseId` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `expense_budgets_company_warehouse_month_unique` ON `expenseBudgets` (`companyId`,`warehouseId`,`yearMonth`);
ALTER TABLE `expenseBudgets` ADD CONSTRAINT `expense_budgets_company_warehouse_month_unique` UNIQUE(`companyId`,`warehouseId`,`yearMonth`);
