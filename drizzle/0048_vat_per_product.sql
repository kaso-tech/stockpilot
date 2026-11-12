ALTER TABLE `products` ADD `vatRateBasisPoints` int;--> statement-breakpoint
ALTER TABLE `saleItems` ADD `vatRateBasisPoints` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saleItems` ADD `vatCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Lignes existantes : taux de la vente et TVA de la vente répartie au prorata des lignes.
UPDATE `saleItems` si JOIN `sales` s ON si.`saleId` = s.`id` JOIN (SELECT `saleId`, SUM(`lineTotalCents`) AS net FROM `saleItems` GROUP BY `saleId`) t ON t.`saleId` = si.`saleId` SET si.`vatRateBasisPoints` = s.`vatRateBasisPoints`, si.`vatCents` = ROUND(s.`vatCents` * si.`lineTotalCents` / t.net) WHERE s.`vatCents` > 0 AND t.net > 0;
