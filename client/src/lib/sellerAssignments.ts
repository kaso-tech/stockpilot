export type SellerWarehouseAssignment = { warehouseId: number };
import { matchesSearch } from "@/lib/search";
export type SearchableSeller = { name?: string | null; username?: string | null; email?: string | null };

export function normalizeSellerWarehouseIds(assignments: readonly SellerWarehouseAssignment[]) {
  return Array.from(new Set(assignments.map(assignment => assignment.warehouseId)));
}

export function matchesSellerAssignmentSearch(seller: SearchableSeller, search: string) {
  return matchesSearch(search, seller.name, seller.username, seller.email);
}
