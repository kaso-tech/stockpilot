-- Lot 4 (audit 2026-10-12) : réparation des données avant les contraintes par entreprise.
-- 1. Les entrées d'audit écrites sans companyId (bogue S4) sont rattachées à l'entreprise de leur auteur.
UPDATE `auditLogs` a JOIN `users` u ON a.`actorUserId` = u.`id` SET a.`companyId` = u.`companyId` WHERE a.`companyId` IS NULL AND u.`companyId` IS NOT NULL;--> statement-breakpoint
-- 2. Le locataire historique (companyId NULL) devient une vraie entreprise (S5).
INSERT INTO `companies` (`name`, `onboardingCompletedAt`) SELECT COALESCE((SELECT `companyName` FROM `saleSettings` WHERE `companyId` IS NULL ORDER BY `id` LIMIT 1), 'Entreprise historique'), NOW() FROM DUAL WHERE EXISTS (SELECT 1 FROM `users` WHERE `companyId` IS NULL);--> statement-breakpoint
SET @legacy_company_id = IF(ROW_COUNT() > 0, LAST_INSERT_ID(), NULL);--> statement-breakpoint
UPDATE `users` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `suppliers` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `purchaseOrders` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `products` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `productCategories` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `productUnits` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `customers` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `agents` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `remunerationProfiles` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `saleSettings` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `sales` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `expenses` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `expenseBudgets` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `agentPayments` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `inventorySessions` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `stockMovements` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `stockAlerts` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `auditLogs` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `backupSettings` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `backupArchives` SET `companyId` = @legacy_company_id WHERE `companyId` IS NULL AND @legacy_company_id IS NOT NULL;--> statement-breakpoint
UPDATE `companies` SET `ownerUserId` = (SELECT `id` FROM `users` WHERE `companyId` = @legacy_company_id AND `role` = 'admin' ORDER BY `id` LIMIT 1) WHERE `id` = @legacy_company_id;--> statement-breakpoint
-- 3. Un seul jeu de réglages par entreprise (le plus ancien est conservé).
DELETE s1 FROM `saleSettings` s1 JOIN `saleSettings` s2 ON s1.`companyId` <=> s2.`companyId` AND s1.`id` > s2.`id`;--> statement-breakpoint
DELETE b1 FROM `backupSettings` b1 JOIN `backupSettings` b2 ON b1.`companyId` <=> b2.`companyId` AND b1.`id` > b2.`id`;--> statement-breakpoint
ALTER TABLE `expenseBudgets` DROP INDEX `expenseBudgets_yearMonth_unique`;--> statement-breakpoint
ALTER TABLE `productCategories` DROP INDEX `productCategories_name_unique`;--> statement-breakpoint
ALTER TABLE `productUnits` DROP INDEX `productUnits_name_unique`;--> statement-breakpoint
ALTER TABLE `products` DROP INDEX `products_reference_unique`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP INDEX `suppliers_name_unique`;--> statement-breakpoint
ALTER TABLE `backupSettings` ADD CONSTRAINT `backup_settings_company_unique` UNIQUE(`companyId`);--> statement-breakpoint
ALTER TABLE `expenseBudgets` ADD CONSTRAINT `expense_budgets_company_month_unique` UNIQUE(`companyId`,`yearMonth`);--> statement-breakpoint
ALTER TABLE `productCategories` ADD CONSTRAINT `product_categories_company_name_unique` UNIQUE(`companyId`,`name`);--> statement-breakpoint
ALTER TABLE `productUnits` ADD CONSTRAINT `product_units_company_name_unique` UNIQUE(`companyId`,`name`);--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_company_reference_unique` UNIQUE(`companyId`,`reference`);--> statement-breakpoint
ALTER TABLE `saleSettings` ADD CONSTRAINT `sale_settings_company_unique` UNIQUE(`companyId`);--> statement-breakpoint
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_company_name_unique` UNIQUE(`companyId`,`name`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `agent_payments_company_beneficiary_idx` ON `agentPayments` (`companyId`,`beneficiaryType`,`beneficiaryId`);--> statement-breakpoint
CREATE INDEX `customers_company_idx` ON `customers` (`companyId`);--> statement-breakpoint
CREATE INDEX `expenses_company_spent_idx` ON `expenses` (`companyId`,`spentAt`);--> statement-breakpoint
CREATE INDEX `inventory_items_session_idx` ON `inventoryItems` (`inventorySessionId`);--> statement-breakpoint
CREATE INDEX `product_price_tiers_product_idx` ON `productPriceTiers` (`productId`);--> statement-breakpoint
CREATE INDEX `purchase_order_items_order_idx` ON `purchaseOrderItems` (`purchaseOrderId`);--> statement-breakpoint
CREATE INDEX `purchase_orders_company_created_idx` ON `purchaseOrders` (`companyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `sale_commissions_sale_idx` ON `saleCommissions` (`saleId`);--> statement-breakpoint
CREATE INDEX `sale_commissions_beneficiary_idx` ON `saleCommissions` (`beneficiaryType`,`beneficiaryId`);