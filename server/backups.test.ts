import { describe, expect, it } from "vitest";
import { parseBackupPayload } from "./backups";

function asDataUrl(payload: unknown) {
  return `data:application/json;base64,${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
}

describe("archives de sauvegarde StockPilot", () => {
  it("accepte une archive locale versionnée et compte les tables", () => {
    const payload = parseBackupPayload(asDataUrl({
      schemaVersion: 1,
      exportedAt: "2026-08-21T00:00:00.000Z",
      source: "StockPilot",
      tables: { products: [{ id: 1 }], sales: [] },
    }));
    expect(payload.tables.products).toHaveLength(1);
    expect(payload.source).toBe("StockPilot");
  });

  it("refuse un fichier JSON qui ne correspond pas à une archive StockPilot", () => {
    expect(() => parseBackupPayload(asDataUrl({ schemaVersion: 2, source: "Autre", tables: {} }))).toThrow("invalide");
  });
});
