CREATE TABLE `automationJobRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`jobType` enum('backup','payment_due_reminders') NOT NULL,
	`periodKey` varchar(48) NOT NULL,
	`correlationId` varchar(64) NOT NULL,
	`status` enum('running','success','failed','skipped') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int,
	`errorCode` varchar(80),
	CONSTRAINT `automationJobRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `automation_job_runs_idempotency_unique` UNIQUE(`jobType`,`companyId`,`periodKey`)
);
--> statement-breakpoint
CREATE INDEX `automation_job_runs_status_started_idx` ON `automationJobRuns` (`status`,`startedAt`);--> statement-breakpoint
CREATE INDEX `automation_job_runs_company_started_idx` ON `automationJobRuns` (`companyId`,`startedAt`);