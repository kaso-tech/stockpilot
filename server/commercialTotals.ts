import { assertSafeDatabaseInt, MAX_CENTS, MAX_DISCOUNT_BASIS_POINTS } from "./numericLimits";

export type CommercialTotalsInput = {
  subtotalCents: number;
  vatRateBasisPoints: number;
  deliveryFeeCents: number;
};

export function calculateCommercialTotals({ subtotalCents, vatRateBasisPoints, deliveryFeeCents }: CommercialTotalsInput) {
  assertSafeDatabaseInt(subtotalCents, "Sous-total");
  if (!Number.isInteger(vatRateBasisPoints) || vatRateBasisPoints < 0 || vatRateBasisPoints > MAX_DISCOUNT_BASIS_POINTS) throw new Error("Le taux de TVA est invalide.");
  assertSafeDatabaseInt(deliveryFeeCents, "Frais de livraison");
  const vatCents = assertSafeDatabaseInt(Math.round((subtotalCents * vatRateBasisPoints) / MAX_DISCOUNT_BASIS_POINTS), "TVA");
  const totalCents = assertSafeDatabaseInt(subtotalCents + vatCents + deliveryFeeCents, "Total TTC");
  if (totalCents > MAX_CENTS) throw new Error("Le total commercial dépasse la limite autorisée.");
  return { subtotalCents, vatRateBasisPoints, vatCents, deliveryFeeCents, totalCents };
}
