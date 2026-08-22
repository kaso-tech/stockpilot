export function nextInvoiceQuantity(current: number, delta: number, available: number) {
  return Math.min(Math.max(1, available), Math.max(1, current + delta));
}
