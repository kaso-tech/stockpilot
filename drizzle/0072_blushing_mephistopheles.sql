ALTER TABLE `agentPayments` ADD `operationId` varchar(80);--> statement-breakpoint
ALTER TABLE `paymentDueSettlements` ADD `operationId` varchar(80);--> statement-breakpoint
ALTER TABLE `agentPayments` ADD CONSTRAINT `agent_payments_company_operation_unique` UNIQUE(`companyId`,`operationId`);--> statement-breakpoint
ALTER TABLE `paymentDueSettlements` ADD CONSTRAINT `payment_due_settlements_company_operation_unique` UNIQUE(`companyId`,`operationId`);--> statement-breakpoint
ALTER TABLE `paymentDueSettlements` ADD CONSTRAINT `payment_due_settlements_expense_unique` UNIQUE(`expenseId`);--> statement-breakpoint
ALTER TABLE `paymentDueSettlements` ADD CONSTRAINT `payment_due_settlements_agent_payment_unique` UNIQUE(`agentPaymentId`);