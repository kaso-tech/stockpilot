ALTER TABLE `salePayments` ADD `offlineOperationId` varchar(80);--> statement-breakpoint
ALTER TABLE `sales` ADD `offlineOperationId` varchar(80);--> statement-breakpoint
ALTER TABLE `salePayments` ADD CONSTRAINT `salePayments_offlineOperationId_unique` UNIQUE(`offlineOperationId`);--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_offlineOperationId_unique` UNIQUE(`offlineOperationId`);