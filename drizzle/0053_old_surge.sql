CREATE TABLE `salesAgentWarehouseAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`agentId` int NOT NULL,
	`warehouseId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `salesAgentWarehouseAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_agent_warehouse_assignments_unique` UNIQUE(`companyId`,`agentId`,`warehouseId`)
);
--> statement-breakpoint
ALTER TABLE `agents` ADD `warehouseScope` enum('all','selected','attribution_only') DEFAULT 'all' NOT NULL;--> statement-breakpoint
CREATE INDEX `sales_agent_warehouse_assignments_company_warehouse_idx` ON `salesAgentWarehouseAssignments` (`companyId`,`warehouseId`);