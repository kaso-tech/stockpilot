ALTER TABLE `agentPayments` ADD `warehouseId` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `warehouseId` int;--> statement-breakpoint
UPDATE `expenses` e INNER JOIN `warehouses` w ON w.`companyId` = e.`companyId` AND w.`isDefault` = 1 SET e.`warehouseId` = w.`id` WHERE e.`warehouseId` IS NULL;--> statement-breakpoint
UPDATE `agentPayments` p INNER JOIN `warehouses` w ON w.`companyId` = p.`companyId` AND w.`isDefault` = 1 SET p.`warehouseId` = w.`id` WHERE p.`warehouseId` IS NULL;--> statement-breakpoint
CREATE INDEX `agent_payments_company_warehouse_paid_idx` ON `agentPayments` (`companyId`,`warehouseId`,`paidAt`);--> statement-breakpoint
CREATE INDEX `expenses_company_warehouse_spent_idx` ON `expenses` (`companyId`,`warehouseId`,`spentAt`);
