import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Item = {
  id: number;
  productName: string;
  quantity: number;
  returnedQuantity: number;
  lineTotalCents: number;
};
type Method = "cash" | "card" | "mobile_money" | "bank_transfer" | "credit";
const methods: Array<{ value: Method; label: string }> = [
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "bank_transfer", label: "Virement" },
  { value: "credit", label: "Avoir client" },
];

/** Sélection des articles rendus, de la remise en stock et du moyen de remboursement (retour partiel). */
export function ReturnItemsDialog({
  open,
  onOpenChange,
  saleId,
  items,
  defaultMethod,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: number;
  items: Item[];
  defaultMethod: Method;
  onDone: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [restock, setRestock] = useState<Record<number, boolean>>({});
  const [method, setMethod] = useState<Method>(defaultMethod);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) {
      setQuantities({});
      setRestock({});
      setMethod(defaultMethod);
      setReason("");
    }
  }, [open, defaultMethod]);
  const returnItems = trpc.transactions.returnItems.useMutation({
    onSuccess: result => {
      toast.success(
        `Retour enregistré : avoir ${result.creditNoteNumber}, ${formatCurrency(result.refundCents)} remboursés.`
      );
      onOpenChange(false);
      onDone();
    },
    onError: error => toast.error(error.message),
  });
  const lines = items
    .map(item => ({
      item,
      quantity: quantities[item.id] ?? 0,
      restock: restock[item.id] ?? true,
    }))
    .filter(line => line.quantity > 0);
  const estimate = lines.reduce(
    (sum, line) =>
      sum +
      Math.round(
        (line.item.lineTotalCents * line.quantity) / line.item.quantity
      ),
    0
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retourner des articles</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {items.map(item => {
            const available = item.quantity - item.returnedQuantity;
            return (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-faint">
                    Vendu : {item.quantity} · déjà rendu :{" "}
                    {item.returnedQuantity}
                  </p>
                </div>
                <Input
                  aria-label={`Quantité rendue pour ${item.productName}`}
                  type="number"
                  min={0}
                  max={available}
                  disabled={available <= 0}
                  value={quantities[item.id] ?? 0}
                  onChange={event =>
                    setQuantities(current => ({
                      ...current,
                      [item.id]: Math.max(
                        0,
                        Math.min(
                          available,
                          Math.floor(Number(event.target.value) || 0)
                        )
                      ),
                    }))
                  }
                  className="w-20"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={restock[item.id] ?? true}
                    onCheckedChange={value =>
                      setRestock(current => ({
                        ...current,
                        [item.id]: value === true,
                      }))
                    }
                  />
                  Remettre en stock
                </label>
              </div>
            );
          })}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                Remboursement par
              </span>
              <select
                value={method}
                onChange={event => setMethod(event.target.value as Method)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {methods.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                Motif (facultatif)
              </span>
              <Input
                value={reason}
                maxLength={500}
                onChange={event => setReason(event.target.value)}
                placeholder="Article défectueux, erreur de commande…"
              />
            </label>
          </div>
          <p className="text-sm text-muted-foreground">
            Montant estimé (hors frais de livraison, remises et TVA répartis au
            prorata) : <strong>{formatCurrency(estimate)}</strong>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            disabled={!lines.length || returnItems.isPending}
            onClick={() =>
              returnItems.mutate({
                saleId,
                method,
                reason: reason.trim() || null,
                lines: lines.map(line => ({
                  saleItemId: line.item.id,
                  quantity: line.quantity,
                  restock: line.restock,
                })),
              })
            }
          >
            {returnItems.isPending ? "Enregistrement…" : "Valider le retour"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
