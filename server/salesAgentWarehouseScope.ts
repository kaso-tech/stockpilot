export type SalesAgentWarehouseScope = "all" | "selected" | "attribution_only";

export function canCoordinateSaleFromWarehouse(scope: SalesAgentWarehouseScope, warehouseIds: readonly number[], warehouseId: number) {
  return scope !== "selected" || warehouseIds.includes(warehouseId);
}

export function hasValidCommercialScopeSelection(scope: SalesAgentWarehouseScope, warehouseIds: readonly number[]) {
  return scope !== "selected" || warehouseIds.length > 0;
}
