import { describe, expect, it } from "vitest";
import { can, permissionsOf, ROLES } from "./permissions";

describe("matrice des droits", () => {
  it("donne tous les droits à l'administrateur et aucun droit d'écriture à la lecture seule", () => {
    expect(permissionsOf("admin")).toHaveLength(18);
    expect(permissionsOf("viewer")).toEqual([]);
  });

  it("sépare vente, gestion et comptabilité", () => {
    expect(can("seller", "sales.create")).toBe(true);
    expect(can("seller", "catalog.manage")).toBe(false);
    expect(can("manager", "catalog.manage")).toBe(true);
    expect(can("manager", "settings.manage")).toBe(false);
    expect(can("accountant", "expenses.manage")).toBe(true);
    expect(can("accountant", "sales.create")).toBe(false);
    expect(can(null, "sales.create")).toBe(false);
    expect(ROLES).toContain("viewer");
  });
});
