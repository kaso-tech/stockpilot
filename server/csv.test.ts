import { describe, expect, it } from "vitest";
import { escapeCsvCell, parseCsv, parsePriceTiers } from "../client/src/lib/csv";

describe("parseCsv", () => {
  it("gère les en-têtes normalisés et les valeurs contenant une virgule", () => {
    expect(parseCsv('Nom,Notes\n"Client A","Note, avec virgule"')).toEqual([{ nom: "Client A", notes: "Note, avec virgule" }]);
  });

  it("convertit les paliers de quantité détail ou grossiste", () => {
    expect(parsePriceTiers("5:115000|10:110000")).toEqual([{ minQuantity: 5, unitPriceCents: 11500000 }, { minQuantity: 10, unitPriceCents: 11000000 }]);
    expect(() => parsePriceTiers("5:115000|5:110000")).toThrow("Paliers invalides");
  });
});

describe("protection des exports CSV", () => {
  it("neutralise les préfixes de formule sans altérer les valeurs ordinaires", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("\"'=SUM(A1:A2)\"");
    expect(escapeCsvCell("  +cmd")).toBe("\"'  +cmd\"");
    expect(escapeCsvCell("Entreprise sûre")).toBe("\"Entreprise sûre\"");
  });
});
