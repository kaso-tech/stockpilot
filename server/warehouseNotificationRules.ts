export type WarehouseAlertNotification = {
  alertId: number;
  warehouseId: number;
  productId: number;
  status: "active" | "resolved";
  updatedAt: Date;
};

export function warehouseAlertNotificationId(alert: WarehouseAlertNotification) {
  return `warehouse-stock:${alert.alertId}:${alert.status}:${alert.updatedAt.getTime()}`;
}

export function warehouseAlertNotificationTitle(status: WarehouseAlertNotification["status"]) {
  return status === "active" ? "Rupture à traiter" : "Seuil de stock rétabli";
}
