export type WarehouseRole = "manager" | "cashier" | "seller";
export type WarehousePermission = "view_stock" | "sell" | "checkout" | "manage_stock" | "manage_transfers" | "manage_thresholds" | "acknowledge_alerts";

const permissions: Record<WarehouseRole, readonly WarehousePermission[]> = {
  manager: ["view_stock", "sell", "checkout", "manage_stock", "manage_transfers", "manage_thresholds", "acknowledge_alerts"],
  cashier: ["view_stock", "sell", "checkout"],
  seller: ["view_stock", "sell"],
};

export function warehouseRoleCan(role: WarehouseRole, permission: WarehousePermission) {
  return permissions[role].includes(permission);
}
