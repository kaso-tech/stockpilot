export type ActiveWarehouseCandidate = { id: number; name: string; code: string; isDefault: boolean };

export function resolveActiveWarehouse(preferredId: number | undefined, warehouses: ActiveWarehouseCandidate[]) {
  return warehouses.find(warehouse => warehouse.id === preferredId)
    ?? [...warehouses].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name))[0]
    ?? null;
}
