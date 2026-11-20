CREATE TABLE `supportRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`requesterUserId` int NOT NULL,
	`warehouseId` int,
	`subject` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`status` enum('open','in_progress','closed') NOT NULL DEFAULT 'open',
	`attachmentKey` varchar(720),
	`attachmentUrl` varchar(1024),
	`attachmentName` varchar(180),
	`attachmentMimeType` varchar(80),
	`handledByUserId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supportRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `support_requests_company_status_created_idx` ON `supportRequests` (`companyId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `support_requests_requester_created_idx` ON `supportRequests` (`requesterUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `support_requests_company_warehouse_idx` ON `supportRequests` (`companyId`,`warehouseId`);