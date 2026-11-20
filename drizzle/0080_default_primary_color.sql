ALTER TABLE `saleSettings` MODIFY COLUMN `primaryColor` varchar(7) NOT NULL DEFAULT '#0B6E76';--> statement-breakpoint
-- Anciennes couleurs par défaut (bleu de l'ancien thème, pétrole d'origine) remplacées par la couleur du thème « Ardoise & Pétrole ». Les couleurs personnalisées sont conservées.
UPDATE `saleSettings` SET `primaryColor` = '#0B6E76' WHERE UPPER(`primaryColor`) IN ('#2563EB', '#007B8B');
