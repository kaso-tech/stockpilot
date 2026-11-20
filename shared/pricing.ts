export type VatLine = { netCents: number; vatRateBasisPoints: number };
export type VatLineBreakdown = {
  taxableCents: number;
  allocatedDiscountCents: number;
  vatRateBasisPoints: number;
  vatCents: number;
};

const MAX_VAT_BASIS_POINTS = 10_000;

/**
 * Ventile une remise globale proportionnellement aux lignes (méthode des plus
 * grands restes, stable en cas d'égalité), puis calcule et arrondit la TVA
 * séparément par ligne. Les entrées sont validées ici aussi car le calcul est
 * partagé entre client offline et serveur.
 */
export function computeVatBreakdown(
  lines: readonly VatLine[],
  invoiceDiscountCents: number
) {
  if (!Array.isArray(lines) || lines.length > 100) {
    throw new RangeError("Le nombre de lignes TVA est invalide.");
  }
  let netTotal = 0;
  for (const line of lines) {
    if (
      !Number.isSafeInteger(line.netCents) ||
      line.netCents < 0 ||
      !Number.isInteger(line.vatRateBasisPoints) ||
      line.vatRateBasisPoints < 0 ||
      line.vatRateBasisPoints > MAX_VAT_BASIS_POINTS
    ) {
      throw new RangeError("Une base ou un taux de TVA est invalide.");
    }
    netTotal += line.netCents;
    if (!Number.isSafeInteger(netTotal)) {
      throw new RangeError("La base taxable dépasse la limite numérique.");
    }
  }
  if (
    !Number.isSafeInteger(invoiceDiscountCents) ||
    invoiceDiscountCents < 0 ||
    invoiceDiscountCents > netTotal
  ) {
    throw new RangeError("La remise globale dépasse le montant des lignes.");
  }

  const allocations = lines.map(() => 0);
  if (invoiceDiscountCents > 0 && netTotal > 0) {
    const shares = lines.map((line, index) => {
      const exactShare = (invoiceDiscountCents * line.netCents) / netTotal;
      const floorShare = Math.floor(exactShare);
      allocations[index] = floorShare;
      return { index, remainder: exactShare - floorShare };
    });
    let remaining = invoiceDiscountCents - allocations.reduce((sum, value) => sum + value, 0);
    shares.sort((left, right) => right.remainder - left.remainder || left.index - right.index);
    for (let index = 0; remaining > 0; index += 1, remaining -= 1) {
      const target = shares[index];
      if (!target) throw new RangeError("La remise ne peut pas être répartie.");
      allocations[target.index] = (allocations[target.index] ?? 0) + 1;
    }
  }

  const perLine: VatLineBreakdown[] = lines.map((line, index) => {
    const allocatedDiscountCents = allocations[index] ?? 0;
    const taxableCents = line.netCents - allocatedDiscountCents;
    const vatCents = Math.round((taxableCents * line.vatRateBasisPoints) / MAX_VAT_BASIS_POINTS);
    return { taxableCents, allocatedDiscountCents, vatRateBasisPoints: line.vatRateBasisPoints, vatCents };
  });
  const byRateMap = new Map<number, { taxableCents: number; vatCents: number }>();
  for (const line of perLine) {
    const current = byRateMap.get(line.vatRateBasisPoints) ?? { taxableCents: 0, vatCents: 0 };
    byRateMap.set(line.vatRateBasisPoints, {
      taxableCents: current.taxableCents + line.taxableCents,
      vatCents: current.vatCents + line.vatCents,
    });
  }
  return {
    perLine,
    taxableCents: perLine.reduce((sum, line) => sum + line.taxableCents, 0),
    vatCents: perLine.reduce((sum, line) => sum + line.vatCents, 0),
    byRate: Array.from(byRateMap, ([vatRateBasisPoints, totals]) => ({ vatRateBasisPoints, ...totals })).sort(
      (left, right) => left.vatRateBasisPoints - right.vatRateBasisPoints
    ),
  };
}

/** Libellé des taux de TVA effectivement appliqués, ex. « 5.50 % · 20.00 % ». */
export function vatRatesLabel(rates: readonly number[]) {
  const distinct = Array.from(new Set(rates.filter(rate => Number.isInteger(rate) && rate > 0))).sort(
    (left, right) => left - right
  );
  return distinct.map(rate => `${(rate / 100).toFixed(2)} %`).join(" · ");
}
