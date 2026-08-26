import { describe, expect, it } from "vitest";
import { warehouseAlertNotificationId, warehouseAlertNotificationTitle } from "./warehouseNotificationRules";

describe("warehouse stock notification rules", () => {
  it("génère un identifiant distinct lorsqu’une alerte est résolue puis se reproduit", () => {
    const active = warehouseAlertNotificationId({ alertId: 4, warehouseId: 1, productId: 9, status: "active", updatedAt: new Date("2026-08-26T10:00:00.000Z") });
    const resolved = warehouseAlertNotificationId({ alertId: 4, warehouseId: 1, productId: 9, status: "resolved", updatedAt: new Date("2026-08-26T11:00:00.000Z") });
    expect(active).not.toBe(resolved);
    expect(warehouseAlertNotificationTitle("active")).toBe("Rupture à traiter");
    expect(warehouseAlertNotificationTitle("resolved")).toBe("Seuil de stock rétabli");
  });
});
