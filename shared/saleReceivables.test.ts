import { describe, expect, it } from "vitest";
import { isReceivableInvoice } from "./saleReceivables";
describe("créances facture", () => {
  it("retient uniquement les factures non réglées ou partiellement encaissées", () => {
    expect(isReceivableInvoice({ channel: "invoice", status: "draft" })).toBe(true);
    expect(isReceivableInvoice({ channel: "invoice", status: "partial" })).toBe(true);
    for (const status of ["paid", "void", "voided", "refunded"]) expect(isReceivableInvoice({ channel: "invoice", status })).toBe(false);
    expect(isReceivableInvoice({ channel: "pos", status: "draft" })).toBe(false);
    expect(isReceivableInvoice({ channel: "quote", status: "draft" })).toBe(false);
  });
});
