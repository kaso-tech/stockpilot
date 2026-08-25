export type SellerWarehouseAssignment = { warehouseId: number };

export function normalizeSellerWarehouseIds(assignments: readonly SellerWarehouseAssignment[]) {
  return Array.from(new Set(assignments.map(assignment => assignment.warehouseId)));
}
