CREATE TABLE `stockAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`threshold` int NOT NULL,
	`observedQuantity` int NOT NULL,
	`status` enum('active','resolved') NOT NULL DEFAULT 'active',
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stockAlerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `stockAlerts_productId_unique` UNIQUE(`productId`)
);
