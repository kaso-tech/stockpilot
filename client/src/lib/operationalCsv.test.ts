import { describe, expect, it } from "vitest";
import { buildInventoryCsv, buildSalesReportCsv, escapeOperationalCsvCell } from "./operationalCsv";

describe("operationalCsv", () => {
  it("neutralise les formules CSV injectables", () => {
    expect(escapeOperationalCsvCell("=SUM(A1:A2)")).toBe("\"'=SUM(A1:A2)\"");
    expect(escapeOperationalCsvCell("-2")).toBe("\"'-2\"");
  });

  it("calcule l’écart d’inventaire dans l’export", () => {
    const csv = buildInventoryCsv("Comptage", [{ productName: "Produit A", reference: "A-1", expectedQuantity: 8, countedQuantity: 6 }]);
    expect(csv).toContain("\"'-2\"");
    expect(csv).toContain("\"quantite_theorique\"");
  });

  it("calcule le solde des ventes dans le rapport", () => {
    const csv = buildSalesReportCsv([{ reference: "FAC-1", date: "2026-08-26", channel: "invoice", customerName: "Client", status: "partial", totalCents: 150000, amountPaidCents: 50000 }]);
    expect(csv).toContain("\"1000\"");
    expect(csv).toContain("\"Facture\"");
  });
});
