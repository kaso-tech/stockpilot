ALTER TABLE `agents` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `backupArchives` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `backupSettings` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `customers` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `expenseBudgets` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `inventorySessions` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `productCategories` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `productUnits` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `purchaseOrders` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `remunerationProfiles` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `sales` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `stockAlerts` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `stockMovements` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `companyId` int;