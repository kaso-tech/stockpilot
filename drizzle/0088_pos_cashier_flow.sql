ALTER TABLE `sales` ADD `voidReason` varchar(300);--> statement-breakpoint
ALTER TABLE `sales` ADD `posStage` enum('parked','queued');--> statement-breakpoint
ALTER TABLE `sales` ADD `queueNumber` int;--> statement-breakpoint
ALTER TABLE `sales` ADD `queueDay` varchar(10);--> statement-breakpoint
ALTER TABLE `sales` ADD `queuedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sales` ADD `holdLabel` varchar(80);--> statement-breakpoint
ALTER TABLE `sales` ADD `returnedReason` varchar(300);--> statement-breakpoint
ALTER TABLE `sales` ADD `checkoutLockedBy` int;--> statement-breakpoint
ALTER TABLE `sales` ADD `checkoutLockedAt` timestamp;--> statement-breakpoint
UPDATE `sales` SET `posStage` = 'queued' WHERE `channel` = 'pos' AND `status` IN ('draft', 'partial');