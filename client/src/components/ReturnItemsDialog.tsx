import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useOffline } from "@/contexts/OfflineContext";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Item = { id: number; productName: string; quantity: number; returnedQuantity?: number; lineTotalCents: number };
type Method = "cash" | "card" | "mobile_money" | "bank_transfer" | "credit";
const methods: Array<{ value: Method; label: string }> = [
  { value: "cash", label: "Espèces" }, { value: "card", label: "Carte" },
  { value: "mobile_money", label: "Mobile money" }, { value: "bank_transfer", label: "Virement" },
  { value: "credit", label: "Avoir client" },
];
export function ReturnItemsDialog({ open, onOpenChange, saleId, items, defaultMethod, onDone }: {
  open: boolean; onOpenChange: (open: boolean) => void; saleId: number; items: Item[]; defaultMethod: Method; onDone: () => void;
}) {
  const { isOnline } = useOffline();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [restock, setRestock] = useState<Record<number, boolean>>({});
  const [method, setMethod] = useState<Method>(defaultMethod);
  const [reason, setReason] = useState("");
  const [requestKey, setRequestKey] = useState("");
  useEffect(() => {
    if (!open) return;
    setQuantities({}); setRestock({}); setMethod(defaultMethod); setReason("");
    setRequestKey(globalThis.crypto?.randomUUID?.() ?? `return-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`);
  }, [open, defaultMethod]);
  const mutation = trpc.transactions.returnItems.useMutation({
    onSuccess: result => {
      toast.success(`Retour enregistré : avoir ${result.creditNoteNumber}, ${formatCurrency(result.refundCents)} remboursés${result.replayed ? " (requête déjà traitée)" : ""}.`);
      onOpenChange(false); onDone();
    }, onError: error => toast.error(error.message),
  });
  const lines = useMemo(() => items.map(item => ({ item, quantity: quantities[item.id] ?? 0, restock: restock[item.id] ?? true })).filter(line => line.quantity > 0), [items, quantities, restock]);
  const estimate = lines.reduce((sum, line) => sum + Math.round(line.item.lineTotalCents * line.quantity / line.item.quantity), 0);
  const submit = () => {
    if (!isOnline) { toast.error("Le retour et l’avoir exigent une connexion : aucun retour n’a été mis en file hors ligne."); return; }
    mutation.mutate({ saleId, requestKey, method, reason: reason.trim() || null, lines: lines.map(line => ({ saleItemId: line.item.id, quantity: line.quantity, restock: line.restock })) });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Retourner des articles</DialogTitle><DialogDescription>Choisissez les quantités, le remboursement et la réintégration de stock. Cette opération requiert une connexion.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        {items.map(item => {
          const available = Math.max(0, item.quantity - (item.returnedQuantity ?? 0));
          return <div key={item.id} className="grid gap-3 rounded-xl border border-white/10 p-3 text-sm sm:grid-cols-[1fr_auto]">
            <div className="min-w-0"><p className="font-medium text-slate-100">{item.productName}</p><p className="mt-1 text-xs text-slate-400">Vendu : {item.quantity} · déjà retourné : {item.returnedQuantity ?? 0} · restant : {available}</p></div>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <Input aria-label={`Quantité rendue pour ${item.productName}`} type="number" inputMode="numeric" min={0} max={available} step={1} disabled={available === 0} value={quantities[item.id] ?? 0} onChange={event => setQuantities(current => ({ ...current, [item.id]: Math.max(0, Math.min(available, Math.floor(Number(event.target.value) || 0))) }))} className="w-24" />
              <label className="flex min-h-11 items-center gap-2 text-xs text-slate-200"><Checkbox checked={restock[item.id] ?? true} onCheckedChange={value => setRestock(current => ({ ...current, [item.id]: value === true }))} aria-label={`Remettre ${item.productName} en stock`} />Remettre en stock</label>
            </div>
          </div>;
        })}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block text-xs text-slate-300">Remboursement par</span><select aria-label="Moyen de remboursement" value={method} onChange={event => setMethod(event.target.value as Method)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{methods.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block text-xs text-slate-300">Motif (facultatif)</span><Input value={reason} maxLength={500} onChange={event => setReason(event.target.value)} placeholder="Article défectueux, erreur de commande…" /></label>
        </div>
        <p aria-live="polite" className="text-sm text-slate-200">Estimation hors frais de livraison : <strong>{formatCurrency(estimate)}</strong>. La TVA/remise est répartie au prorata côté serveur.</p>
        {!isOnline && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-950/30 p-3 text-sm text-amber-100">Mode hors connexion : les retours critiques ne sont pas disponibles.</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button disabled={!isOnline || !lines.length || mutation.isPending} onClick={submit}>{mutation.isPending ? "Enregistrement…" : "Valider le retour"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
