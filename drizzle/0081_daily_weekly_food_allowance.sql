-- Échéances journalières et hebdomadaires, prime d’alimentation des agents, catégorie de dépense « Alimentation ».
-- Ajouts de valeurs en fin de liste uniquement : aucune donnée existante n’est modifiée.
ALTER TABLE `agentPayments` MODIFY COLUMN `paymentKind` enum('commission','salary','mixed','food_allowance') NOT NULL DEFAULT 'mixed';--> statement-breakpoint
ALTER TABLE `expenses` MODIFY COLUMN `category` enum('rent','energy','connection','salary','marketing','supplies','taxes','other','food') NOT NULL;--> statement-breakpoint
ALTER TABLE `paymentDueSchedules` MODIFY COLUMN `scheduleType` enum('expense','salary','food_allowance') NOT NULL;--> statement-breakpoint
ALTER TABLE `paymentDueSchedules` MODIFY COLUMN `expenseCategory` enum('rent','energy','connection','salary','marketing','supplies','taxes','other','food');--> statement-breakpoint
ALTER TABLE `paymentDueSchedules` MODIFY COLUMN `recurrence` enum('once','monthly','daily','weekly') NOT NULL DEFAULT 'once';--> statement-breakpoint
ALTER TABLE `paymentDueTemplates` MODIFY COLUMN `scheduleType` enum('expense','salary','food_allowance') NOT NULL;--> statement-breakpoint
ALTER TABLE `paymentDueTemplates` MODIFY COLUMN `expenseCategory` enum('rent','energy','connection','salary','marketing','supplies','taxes','other','food');--> statement-breakpoint
ALTER TABLE `paymentDueTemplates` MODIFY COLUMN `recurrence` enum('once','monthly','daily','weekly') NOT NULL DEFAULT 'monthly';