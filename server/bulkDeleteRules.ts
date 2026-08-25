export const BULK_DELETE_CONFIRMATION = "SUPPRIMER";

export type BulkDeleteResource = "products" | "suppliers" | "customers";

export function normalizeBulkDeleteIds(ids: number[]) {
  return Array.from(new Set(ids)).sort((left, right) => left - right);
}

export function hasBulkDeleteConfirmation(value: string) {
  return value.trim() === BULK_DELETE_CONFIRMATION;
}
