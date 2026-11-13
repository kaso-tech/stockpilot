ALTER TABLE `companies` ADD `plan` enum('trial','starter','pro') DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `trialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `planRenewsAt` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `status` enum('active','suspended') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `suspendedReason` varchar(300);--> statement-breakpoint
-- Entreprises existantes : plan Pro, pour ne rien restreindre lors du déploiement.
UPDATE `companies` SET `plan` = 'pro';
