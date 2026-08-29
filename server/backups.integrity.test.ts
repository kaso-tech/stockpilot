import { describe, expect, it } from "vitest";
import { backupContentSha256, summarizeBackupPayload } from "./backups";

describe("intégrité des archives de sauvegarde", () => {
  it("produit une empreinte SHA-256 déterministe du contenu archivé", () => {
    expect(backupContentSha256("archive-stockpilot")).toBe(backupContentSha256(Buffer.from("archive-stockpilot")));
    expect(backupContentSha256("archive-stockpilot")).not.toBe(backupContentSha256("archive-modifiée"));
  });

  it("résume les tables métier sans inspecter ni révéler leurs lignes", () => {
    const summary = summarizeBackupPayload({
      schemaVersion: 1,
      source: "StockPilot",
      exportedAt: "2026-08-29T00:00:00.000Z",
      companyId: 1,
      tables: { warehouses: [{ id: 1 }], warehouseStocks: [{ id: 1 }, { id: 2 }], saleItems: [] },
    } as any);
    expect(summary).toMatchObject({ total: 3, counts: { warehouses: 1, warehouseStocks: 2, saleItems: 0 } });
  });
});
