ALTER TABLE `expenseBudgets` ADD `warningPercent` int DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `receiptUrl` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `receiptName` varchar(180);--> statement-breakpoint
ALTER TABLE `expenses` ADD `receiptMimeType` varchar(80);