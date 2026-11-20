export function isPaymentDueReceiptKeyInScope(key: string, companyId: number, occurrenceId: number): boolean {
  const prefix = `company/${companyId}/payment-due-settlements/${occurrenceId}/`;
  if (!key.startsWith(prefix)) return false;
  const filename = key.slice(prefix.length);
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(filename);
}
