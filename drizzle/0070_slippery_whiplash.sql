ALTER TABLE `users` ADD `emailNormalized` varchar(320);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_emailNormalized_unique` UNIQUE(`emailNormalized`);