CREATE TABLE `productPriceTiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`minQuantity` int NOT NULL,
	`unitPriceCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productPriceTiers_id` PRIMARY KEY(`id`)
);
