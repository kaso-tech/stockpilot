export const MAX_DATABASE_INT = 2_000_000_000;
export const MAX_CENTS = MAX_DATABASE_INT;
export const MAX_QUANTITY = 1_000_000;
export const MAX_DISCOUNT_BASIS_POINTS = 10_000;
export const MAX_LINE_ITEMS = 500;

export function assertSafeDatabaseInt(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DATABASE_INT) throw new Error(`${label} est hors limites.`);
  return value;
}
