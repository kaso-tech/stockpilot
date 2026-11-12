import { createHash } from "node:crypto";
import { MAX_CENTS, MAX_QUANTITY } from "./numericLimits";
import { computeVatBreakdown } from "../shared/pricing";

type ReturnSale = {
  totalCents: number; deliveryFeeCents: number; amountPaidCents: number;
  returnedCents?: number; invoiceDiscountCents?: number; vatRateBasisPoints?: number;
};
type ReturnItem = {
  id: number; productId: number; productName: string; quantity: number;
  returnedQuantity?: number; lineTotalCents: number; lineCostCents: number;
  vatRateBasisPoints?: number; vatCents?: number;
};
export type ReturnLineInput = { saleItemId: number; quantity: number; restock: boolean };

export function requestFingerprint(lines: ReturnLineInput[], method: string, reason: string | null) {
  return createHash("sha256").update(JSON.stringify({ lines: [...lines].sort((a, b) => a.saleItemId - b.saleItemId), method, reason })).digest("hex");
}

/** Répartit un montant exact, avec le plus grand reste et un ordre stable. */
function apportion(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const shares = weights.map((weight, index) => ({ index, amount: Math.floor(total * weight / sum), remainder: (total * weight / sum) % 1 }));
  let residual = total - shares.reduce((value, share) => value + share.amount, 0);
  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (residual <= 0) break;
    share.amount += 1; residual -= 1;
  }
  return shares.map(share => share.amount);
}

export function calculatePartialReturn(sale: ReturnSale, items: ReturnItem[], lines: ReturnLineInput[]) {
  if (lines.length < 1 || lines.length > 100) throw new Error("Sélectionnez entre 1 et 100 lignes.");
  const requested = new Map<number, ReturnLineInput>();
  for (const line of lines) {
    if (requested.has(line.saleItemId)) throw new Error("Une ligne ne peut apparaître qu’une fois dans un retour.");
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) throw new Error("La quantité retournée est invalide.");
    requested.set(line.saleItemId, line);
  }
  const selected = items.filter(item => requested.has(item.id));
  if (selected.length !== requested.size) throw new Error("Une ligne sélectionnée n’appartient pas à cette vente.");
  const refundableBase = Math.max(0, sale.totalCents - sale.deliveryFeeCents);
  const hasLineVat = items.some(item => (item.vatCents ?? 0) > 0 || (item.vatRateBasisPoints ?? 0) > 0);
  const weights = hasLineVat
    ? computeVatBreakdown(items.map(item => ({ netCents: item.lineTotalCents, vatRateBasisPoints: item.vatRateBasisPoints ?? sale.vatRateBasisPoints ?? 0 })), sale.invoiceDiscountCents ?? 0).perLine.map(line => line.taxableCents + line.vatCents)
    : items.map(item => item.lineTotalCents);
  const budgets = apportion(refundableBase, weights);
  const returned = selected.map(item => {
    const line = requested.get(item.id)!;
    const already = item.returnedQuantity ?? 0;
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || line.quantity > item.quantity - already) throw new Error(`La quantité rendue dépasse la quantité restante pour ${item.productName}.`);
    const budget = budgets[items.indexOf(item)] ?? 0;
    const refundCents = Math.round(budget * (already + line.quantity) / item.quantity) - Math.round(budget * already / item.quantity);
    const costCents = Math.round(item.lineCostCents * (already + line.quantity) / item.quantity) - Math.round(item.lineCostCents * already / item.quantity);
    if (![refundCents, costCents].every(value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS)) throw new Error("Le montant calculé est hors limites.");
    return { item, quantity: line.quantity, restock: line.restock, refundCents, costCents };
  });
  const refundCents = Math.min(sale.amountPaidCents, returned.reduce((sum, line) => sum + line.refundCents, 0));
  const costCents = returned.reduce((sum, line) => sum + line.costCents, 0);
  const fullyReturned = items.every(item => item.quantity - (item.returnedQuantity ?? 0) - (requested.get(item.id)?.quantity ?? 0) <= 0);
  return { returned, refundCents, costCents, fullyReturned };
}

export function formatCreditNoteNumber(year: number, sequence: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999 || !Number.isInteger(sequence) || sequence < 1 || sequence > MAX_CENTS) throw new Error("Le compteur d’avoirs est invalide.");
  return `AV-${year}-${String(sequence).padStart(6, "0")}`;
}
