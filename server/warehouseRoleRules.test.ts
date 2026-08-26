import { describe, expect, it } from "vitest";
import { warehouseRoleCan } from "./warehouseRoleRules";

describe("warehouseRoleCan", () => {
  it("accorde la gestion locale uniquement au responsable", () => {
    expect(warehouseRoleCan("manager", "manage_transfers")).toBe(true);
    expect(warehouseRoleCan("cashier", "manage_transfers")).toBe(false);
    expect(warehouseRoleCan("seller", "manage_stock")).toBe(false);
  });

  it("limite les encaissements au caissier et au responsable", () => {
    expect(warehouseRoleCan("cashier", "checkout")).toBe(true);
    expect(warehouseRoleCan("seller", "checkout")).toBe(false);
  });

  it("réserve l’accusé de réception des alertes au responsable", () => {
    expect(warehouseRoleCan("manager", "acknowledge_alerts")).toBe(true);
    expect(warehouseRoleCan("cashier", "acknowledge_alerts")).toBe(false);
  });
});
