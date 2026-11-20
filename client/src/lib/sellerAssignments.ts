export type SellerWarehouseAssignment = { warehouseId: number };
export type SearchableSeller = { name?: string | null; username?: string | null; email?: string | null };

export function normalizeSellerWarehouseIds(assignments: readonly SellerWarehouseAssignment[]) {
  return Array.from(new Set(assignments.map(assignment => assignment.warehouseId)));
}

export function matchesSellerAssignmentSearch(seller: SearchableSeller, search: string) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return [seller.name, seller.username, seller.email].some(value => value?.toLocaleLowerCase().includes(query));
}
