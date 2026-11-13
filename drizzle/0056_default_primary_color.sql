ALTER TABLE `saleSettings` MODIFY COLUMN `primaryColor` varchar(7) NOT NULL DEFAULT '#0B6E76';--> statement-breakpoint
-- Anciennes couleurs par défaut (pétrole d'origine et bleu de l'ancien thème) remplacées par la couleur du thème « Ardoise & Pétrole ».
UPDATE `saleSettings` SET `primaryColor` = '#0B6E76' WHERE UPPER(`primaryColor`) IN ('#007B8B', '#2563EB');
