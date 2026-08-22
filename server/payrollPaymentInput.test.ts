import { describe, expect, it } from "vitest";
import { payrollPaymentInput } from "./routers/payroll";

describe("payroll payment input", () => {
  it("accepts a payment with its receipt metadata", () => {
    expect(payrollPaymentInput.parse({ beneficiaryType: "agent", beneficiaryId: 4, amountCents: 25_000, periodLabel: "2026-08", note: "Commission août", receiptUrl: "/manus-storage/payroll/receipt.pdf", receiptName: "reçu-août.pdf", receiptMimeType: "application/pdf" })).toMatchObject({ receiptName: "reçu-août.pdf", amountCents: 25_000 });
  });

  it("rejects an invalid payment amount", () => {
    expect(() => payrollPaymentInput.parse({ beneficiaryType: "agent", beneficiaryId: 4, amountCents: 0, note: null })).toThrow();
  });
});
