ALTER TABLE `sellerCredentials` DROP INDEX `sellerCredentials_username_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_emailNormalized_unique`;--> statement-breakpoint
ALTER TABLE `companies` ADD `loginCode` varchar(32);--> statement-breakpoint
ALTER TABLE `sellerCredentials` ADD `companyId` int;--> statement-breakpoint
UPDATE `sellerCredentials` JOIN `users` ON `users`.`id` = `sellerCredentials`.`userId` SET `sellerCredentials`.`companyId` = `users`.`companyId`;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_loginCode_unique` UNIQUE(`loginCode`);--> statement-breakpoint
ALTER TABLE `sellerCredentials` ADD CONSTRAINT `seller_credentials_company_username_unique` UNIQUE(`companyId`,`username`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_company_email_unique` UNIQUE(`companyId`,`emailNormalized`);