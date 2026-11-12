ALTER TABLE `products` ADD `categoryId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `unitId` int;--> statement-breakpoint
-- Catégories et unités utilisées par des produits mais absentes du catalogue de leur entreprise.
INSERT INTO `productCategories` (`companyId`, `name`) SELECT DISTINCT p.`companyId`, p.`category` FROM `products` p LEFT JOIN `productCategories` c ON c.`companyId` <=> p.`companyId` AND c.`name` = p.`category` WHERE c.`id` IS NULL AND p.`category` <> '';--> statement-breakpoint
INSERT INTO `productUnits` (`companyId`, `name`) SELECT DISTINCT p.`companyId`, p.`unit` FROM `products` p LEFT JOIN `productUnits` u ON u.`companyId` <=> p.`companyId` AND u.`name` = p.`unit` WHERE u.`id` IS NULL AND p.`unit` <> '';--> statement-breakpoint
UPDATE `products` p JOIN `productCategories` c ON c.`companyId` <=> p.`companyId` AND c.`name` = p.`category` SET p.`categoryId` = c.`id`;--> statement-breakpoint
UPDATE `products` p JOIN `productUnits` u ON u.`companyId` <=> p.`companyId` AND u.`name` = p.`unit` SET p.`unitId` = u.`id`;
