CREATE INDEX `audit_logs_company_created_idx` ON `auditLogs` (`companyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_company_entity_idx` ON `auditLogs` (`companyId`,`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `saleItems` (`saleId`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `saleItems` (`productId`);--> statement-breakpoint
CREATE INDEX `sale_payments_sale_idx` ON `salePayments` (`saleId`);--> statement-breakpoint
CREATE INDEX `sale_payments_offline_idx` ON `salePayments` (`offlineOperationId`);--> statement-breakpoint
CREATE INDEX `sales_company_created_idx` ON `sales` (`companyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `sales_company_status_idx` ON `sales` (`companyId`,`status`);--> statement-breakpoint
CREATE INDEX `sales_offline_user_idx` ON `sales` (`offlineOperationId`,`sellerUserId`);--> statement-breakpoint
CREATE INDEX `stock_movements_company_product_idx` ON `stockMovements` (`companyId`,`productId`);--> statement-breakpoint
CREATE INDEX `stock_movements_company_occurred_idx` ON `stockMovements` (`companyId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `users_company_active_idx` ON `users` (`companyId`,`active`);