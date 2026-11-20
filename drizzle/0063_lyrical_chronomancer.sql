CREATE TABLE `paymentDueOccurrences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int,
	`dueAt` timestamp NOT NULL,
	`periodLabel` varchar(7) NOT NULL,
	`amountCents` int NOT NULL,
	`paidCents` int NOT NULL DEFAULT 0,
	`status` enum('upcoming','due','overdue','partially_paid','paid','cancelled') NOT NULL DEFAULT 'upcoming',
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentDueOccurrences_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_due_occurrences_schedule_due_unique` UNIQUE(`scheduleId`,`dueAt`)
);
--> statement-breakpoint
CREATE TABLE `paymentDueReminderEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`occurrenceId` int NOT NULL,
	`companyId` int NOT NULL,
	`reminderKind` enum('upcoming','due','overdue') NOT NULL,
	`triggeredForDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentDueReminderEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_due_reminder_occurrence_kind_date_unique` UNIQUE(`occurrenceId`,`reminderKind`,`triggeredForDate`)
);
--> statement-breakpoint
CREATE TABLE `paymentDueReminderJobSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`enabled` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`lastRunStatus` enum('success','failed') DEFAULT 'success',
	`lastRunError` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentDueReminderJobSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymentDueReminderJobSettings_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `paymentDueSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`warehouseId` int,
	`scheduleType` enum('expense','salary') NOT NULL,
	`title` varchar(180) NOT NULL,
	`expenseCategory` enum('rent','energy','connection','salary','marketing','supplies','taxes','other'),
	`beneficiaryType` enum('user','agent'),
	`beneficiaryId` int,
	`amountCents` int NOT NULL,
	`recurrence` enum('once','monthly') NOT NULL DEFAULT 'once',
	`dueDay` int,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`reminderDaysJson` varchar(80) NOT NULL DEFAULT '[7,3,1]',
	`responsibleUserId` int,
	`status` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentDueSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paymentDueSettlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`occurrenceId` int NOT NULL,
	`companyId` int NOT NULL,
	`amountCents` int NOT NULL,
	`expenseId` int,
	`agentPaymentId` int,
	`settledByUserId` int NOT NULL,
	`settledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentDueSettlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `payment_due_occurrences_company_status_due_idx` ON `paymentDueOccurrences` (`companyId`,`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `payment_due_reminder_company_created_idx` ON `paymentDueReminderEvents` (`companyId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `payment_due_schedules_company_status_idx` ON `paymentDueSchedules` (`companyId`,`status`);--> statement-breakpoint
CREATE INDEX `payment_due_schedules_company_warehouse_idx` ON `paymentDueSchedules` (`companyId`,`warehouseId`);--> statement-breakpoint
CREATE INDEX `payment_due_settlements_occurrence_idx` ON `paymentDueSettlements` (`occurrenceId`);--> statement-breakpoint
CREATE INDEX `payment_due_settlements_company_idx` ON `paymentDueSettlements` (`companyId`);