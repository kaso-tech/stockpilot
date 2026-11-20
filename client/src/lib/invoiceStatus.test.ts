import { describe, expect, it } from "vitest";
import { invoiceStatusMeta } from "../pages/Invoices";

describe("badges de statut des factures", () => {
  it("distingue les factures non totalement réglées avec la tonalité d’avertissement du thème", () => {
    expect(invoiceStatusMeta.draft[1]).toContain("text-warning");
    expect(invoiceStatusMeta.partial[1]).toContain("text-warning");
    expect(invoiceStatusMeta.paid[1]).toContain("text-success");
  });
});
