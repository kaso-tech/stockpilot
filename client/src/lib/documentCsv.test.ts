import { describe, expect, it } from "vitest";
import { buildCommercialDocumentsCsv } from "./documentCsv";

describe("buildCommercialDocumentsCsv", () => {
  it("conserve les colonnes comptables et protège les cellules CSV interprétables", () => {
    const csv = buildCommercialDocumentsCsv([{ reference: "FAC-001", date: "2026-08-25T10:00:00.000Z", client: "=Client", statut: "À encaisser", agent: "Caissier", totalCents: 150000, encaisseCents: 50000 }]);
    expect(csv).toContain("Solde (centimes)");
    expect(csv).toContain("'=Client");
    expect(csv).toContain('"100000"');
  });
});
