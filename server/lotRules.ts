export type LotBalance = { id: number; quantity: number; lotNumber: string; expiryDate: string | null; receivedAt: Date | string };
export type LotAllocation = { lotId: number; lotNumber: string; expiryDate: string | null; quantity: number };

/** CMUP en centimes, arrondi à l'unité la plus proche; tolère un stock historique sans lots. */
export function weightedAverageCost(previousQuantity: number, previousCostCents: number, enteredQuantity: number, unitCostCents: number) {
  const totalQuantity = Math.max(0, previousQuantity) + enteredQuantity;
  if (totalQuantity <= 0) return Math.max(0, unitCostCents);
  return Math.round((Math.max(0, previousQuantity) * Math.max(0, previousCostCents) + enteredQuantity * Math.max(0, unitCostCents)) / totalQuantity);
}

/** FEFO : date de péremption la plus proche; dates nulles sortent après les lots datés. */
export function allocateFefo(lots: LotBalance[], requestedQuantity: number): LotAllocation[] {
  if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1) throw new Error("La quantité demandée doit être un entier positif.");
  const ordered = [...lots].filter(lot => Number.isSafeInteger(lot.quantity) && lot.quantity > 0).sort((a, b) => {
    if (a.expiryDate === null && b.expiryDate !== null) return 1;
    if (a.expiryDate !== null && b.expiryDate === null) return -1;
    if (a.expiryDate && b.expiryDate && a.expiryDate !== b.expiryDate) return a.expiryDate.localeCompare(b.expiryDate);
    return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime() || a.id - b.id;
  });
  let remaining = requestedQuantity;
  const allocations: LotAllocation[] = [];
  for (const lot of ordered) {
    if (remaining === 0) break;
    const quantity = Math.min(remaining, lot.quantity);
    allocations.push({ lotId: lot.id, lotNumber: lot.lotNumber, expiryDate: lot.expiryDate, quantity });
    remaining -= quantity;
  }
  if (remaining > 0) throw new Error("La quantité demandée dépasse le stock suivi par lots.");
  return allocations;
}

export function isIsoDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
