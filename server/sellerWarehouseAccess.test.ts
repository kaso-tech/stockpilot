import { describe, expect, it } from "vitest";
import { assignedWarehouseIds } from "./sellerWarehouseAccess";

describe("affectations vendeur-entrepôt", () => {
  it("ne limite pas les administrateurs", async () => {
    const ids = await assignedWarehouseIds({ select: () => ({ from: () => ({ where: async () => [] }) }) }, { id: 1, role: "admin", companyId: 2 });
    expect(ids).toBeNull();
  });

  it("retourne les dépôts explicitement attribués à un vendeur", async () => {
    const ids = await assignedWarehouseIds({ select: () => ({ from: () => ({ where: async () => [{ warehouseId: 4 }, { warehouseId: 9 }] }) }) }, { id: 3, role: "seller", companyId: 2 });
    expect(ids).toEqual([4, 9]);
  });
});
