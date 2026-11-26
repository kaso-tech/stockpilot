ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','seller','accountant','viewer','agent') NOT NULL DEFAULT 'seller';--> statement-breakpoint
ALTER TABLE `agents` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `agents` ADD CONSTRAINT `agents_userId_unique` UNIQUE(`userId`);