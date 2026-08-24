import { describe, expect, it } from "vitest";
import { parseBackupPayload } from "./backups";

function asDataUrl(payload: unknown) {
  return `data:application/json;base64,${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
}

describe("archives de sauvegarde StockPilot", () => {
  it("accepte une archive locale versionnée, scoped et compte les tables", () => {
    const payload = parseBackupPayload(asDataUrl({
      schemaVersion: 1,
      exportedAt: "2026-08-21T00:00:00.000Z",
      source: "StockPilot",
      companyId: 12,
      tables: { products: [{ id: 1, companyId: 12 }], sales: [] },
    }));
    expect(payload.tables.products).toHaveLength(1);
    expect(payload.source).toBe("StockPilot");
    expect(payload.companyId).toBe(12);
  });

  it("refuse un fichier JSON qui ne correspond pas à une archive StockPilot", () => {
    expect(() => parseBackupPayload(asDataUrl({ schemaVersion: 2, source: "Autre", tables: {} }))).toThrow("invalide");
  });

  it("refuse une ligne d’enfant dont le parent est absent", () => {
    expect(() => parseBackupPayload(asDataUrl({
      schemaVersion: 1,
      exportedAt: "2026-08-21T00:00:00.000Z",
      source: "StockPilot",
      companyId: 12,
      tables: { saleItems: [{ id: 1, saleId: 999 }] },
    }))).toThrow("vente absente");
  });
});
