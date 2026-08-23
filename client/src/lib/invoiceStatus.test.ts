import { describe, expect, it } from "vitest";
import { invoiceStatusMeta } from "../pages/Invoices";

describe("badges de statut des factures", () => {
  it("distingue les factures non totalement réglées avec une tonalité orange", () => {
    expect(invoiceStatusMeta.draft[1]).toContain("orange");
    expect(invoiceStatusMeta.partial[1]).toContain("orange");
    expect(invoiceStatusMeta.paid[1]).toContain("emerald");
  });
});
