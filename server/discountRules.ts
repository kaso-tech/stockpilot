export type DiscountType = "none" | "percent" | "fixed";

export function discountCents(subtotalCents: number, type: DiscountType, value: number) {
  if (subtotalCents < 0 || value < 0) throw new Error("La remise doit être positive.");
  if (type === "none" || value === 0) return 0;
  if (type === "percent") {
    if (value > 10000) throw new Error("Le pourcentage de remise est invalide.");
    return Math.min(subtotalCents, Math.round((subtotalCents * value) / 10000));
  }
  return Math.min(subtotalCents, value);
}
