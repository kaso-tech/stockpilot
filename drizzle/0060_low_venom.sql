CREATE TABLE `supportAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supportRequestId` int NOT NULL,
	`priority` enum('low','normal','high','critical') NOT NULL DEFAULT 'normal',
	`assignedPlatformUserId` int,
	`dueAt` timestamp,
	`firstRespondedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supportAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `supportAssignments_supportRequestId_unique` UNIQUE(`supportRequestId`)
);
--> statement-breakpoint
CREATE TABLE `supportPlatformEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supportRequestId` int NOT NULL,
	`actorPlatformUserId` int NOT NULL,
	`action` enum('assigned','priority_changed','status_changed','due_date_changed') NOT NULL,
	`metadataJson` varchar(600),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supportPlatformEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `support_assignments_priority_due_idx` ON `supportAssignments` (`priority`,`dueAt`);--> statement-breakpoint
CREATE INDEX `support_platform_events_request_created_idx` ON `supportPlatformEvents` (`supportRequestId`,`createdAt`);