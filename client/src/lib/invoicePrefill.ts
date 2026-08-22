export function invoiceCustomerPrefill(search: string): string | null {
  const value = new URLSearchParams(search).get("client");
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? String(id) : null;
}
