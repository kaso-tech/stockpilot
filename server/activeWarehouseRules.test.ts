import { describe, expect, it } from "vitest";
import { resolveActiveWarehouse } from "./activeWarehouseRules";

describe("entrepôt actif administrateur", () => {
  const warehouses = [
    { id: 2, name: "Secondaire", code: "SEC", isDefault: false },
    { id: 1, name: "Principal", code: "PRI", isDefault: true },
  ];

  it("conserve une préférence valide", () => {
    expect(resolveActiveWarehouse(2, warehouses)?.id).toBe(2);
  });

  it("revient au dépôt principal si la préférence n’est plus disponible", () => {
    expect(resolveActiveWarehouse(99, warehouses)?.id).toBe(1);
  });

  it("ne sélectionne aucun dépôt quand l’entreprise ne possède aucun entrepôt actif", () => {
    expect(resolveActiveWarehouse(undefined, [])).toBeNull();
  });
});
