CREATE TABLE `cashClosures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int,
	`businessDay` varchar(10) NOT NULL,
	`openingFloatCents` int NOT NULL DEFAULT 0,
	`cashSalesCents` int NOT NULL DEFAULT 0,
	`expectedCashCents` int NOT NULL,
	`countedCashCents` int NOT NULL,
	`differenceCents` int NOT NULL,
	`totalsByMethodJson` text NOT NULL,
	`documentCount` int NOT NULL DEFAULT 0,
	`note` varchar(500),
	`closedByUserId` int NOT NULL,
	`closedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashClosures_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_closures_company_day_unique` UNIQUE(`companyId`,`businessDay`)
);
