import { describe, expect, it } from "vitest";
import { payrollPaymentInput } from "./routers/payroll";

describe("payroll payment input", () => {
  it("accepts a payment with its receipt metadata", () => {
    expect(payrollPaymentInput.parse({ beneficiaryType: "agent", beneficiaryId: 4, operationId: "payroll-9b4baef9-ec0d-4597-83d2-5f0469d5d5e2", amountCents: 25_000, periodLabel: "2026-08", note: "Commission août", receiptUrl: "/manus-storage/payroll/receipt.pdf", receiptName: "reçu-août.pdf", receiptMimeType: "application/pdf" })).toMatchObject({ receiptName: "reçu-août.pdf", amountCents: 25_000 });
  });

  it("rejects an invalid payment amount", () => {
    expect(() => payrollPaymentInput.parse({ beneficiaryType: "agent", beneficiaryId: 4, operationId: "payroll-9b4baef9-ec0d-4597-83d2-5f0469d5d5e2", amountCents: 0, note: null })).toThrow();
  });

  it("requires an idempotency key for a financial payment", () => {
    expect(() => payrollPaymentInput.parse({ beneficiaryType: "agent", beneficiaryId: 4, amountCents: 25_000, note: null })).toThrow();
  });
});
