CREATE TABLE `saasPaymentEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('yengapay') NOT NULL DEFAULT 'yengapay',
	`companyId` int,
	`eventType` varchar(96) NOT NULL,
	`providerReference` varchar(180),
	`payloadSha256` varchar(64) NOT NULL,
	`signatureVerified` boolean NOT NULL DEFAULT false,
	`status` enum('received','ignored','processed','rejected') NOT NULL DEFAULT 'received',
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `saasPaymentEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_payment_events_provider_payload_unique` UNIQUE(`provider`,`payloadSha256`)
);
--> statement-breakpoint
CREATE INDEX `saas_payment_events_status_received_idx` ON `saasPaymentEvents` (`status`,`receivedAt`);--> statement-breakpoint
CREATE INDEX `saas_payment_events_company_received_idx` ON `saasPaymentEvents` (`companyId`,`receivedAt`);