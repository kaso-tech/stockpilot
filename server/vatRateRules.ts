import { MAX_DISCOUNT_BASIS_POINTS } from "./numericLimits";

export type VatRatePresetInput = { rateBasisPoints: number; active?: boolean };

export function normalizeVatPresetRates(rates: VatRatePresetInput[]) {
  return Array.from(new Set(rates.filter(rate => rate.active !== false && Number.isInteger(rate.rateBasisPoints) && rate.rateBasisPoints >= 0 && rate.rateBasisPoints <= MAX_DISCOUNT_BASIS_POINTS).map(rate => rate.rateBasisPoints))).sort((left, right) => left - right);
}

export function assertVatPresetSelection(selectedRateBasisPoints: number | undefined, activeRates: VatRatePresetInput[]) {
  if (selectedRateBasisPoints === undefined) return;
  if (!normalizeVatPresetRates(activeRates).includes(selectedRateBasisPoints)) throw new Error("Le taux de TVA sélectionné n’est pas autorisé pour cette entreprise.");
}
