import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Archive, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type WarehouseDangerAction = "reset" | "remove";

/** Confirmation d'une action irréversible sur un entrepôt : ce qui sera effacé, sauvegarde proposée, nom à ressaisir. */
export function WarehouseDangerDialog({ warehouse, action, onClose, onDone }: { warehouse: { id: number; name: string; isDefault: boolean } | null; action: WarehouseDangerAction; onClose: () => void; onDone: () => void }) {
  const [confirmName, setConfirmName] = useState("");
  useEffect(() => setConfirmName(""), [warehouse?.id, action]);
  const { data: impact, isLoading } = trpc.warehouses.impact.useQuery({ id: warehouse?.id ?? 0 }, { enabled: Boolean(warehouse) });
  const backup = trpc.backups.runNow.useMutation({ onSuccess: archive => toast.success(`Sauvegarde ${archive.filename} créée.`), onError: error => toast.error(error.message) });
  const handlers = { onSuccess: () => { toast.success(action === "remove" ? `Entrepôt ${warehouse?.name} supprimé définitivement.` : `Entrepôt ${warehouse?.name} réinitialisé.`); onDone(); }, onError: (error: { message: string }) => toast.error(error.message) };
  const reset = trpc.warehouses.reset.useMutation(handlers);
  const remove = trpc.warehouses.remove.useMutation(handlers);
  const pending = reset.isPending || remove.isPending;
  const isRemove = action === "remove";
  const blocked = Boolean(impact && impact.transfersInTransit > 0);
  const matches = Boolean(warehouse) && confirmName.trim() === warehouse!.name.trim();
  const n = (value: number) => value.toLocaleString("fr-FR");
  const rows: Array<[string, string]> = impact ? ([
    ["Stock", `${n(impact.units)} unité(s) de ${n(impact.productsWithStock)} produit(s)`],
    ["Tickets, factures et devis", n(impact.sales)],
    ["Retours et avoirs", n(impact.returns)],
    ["Dépenses et budgets", n(impact.expenses)],
    ["Paiements des agents", n(impact.agentPayments)],
    ["Échéanciers", n(impact.paymentDues)],
    ["Clôtures de caisse", n(impact.cashClosures)],
    ["Bons de commande", n(impact.purchaseOrders)],
    ["Transferts", n(impact.transfers)],
    ["Inventaires", n(impact.inventories)],
    ["Lots et mouvements de stock", `${n(impact.lots)} lot(s) · ${n(impact.movements)} mouvement(s)`],
    ["Agents rattachés uniquement à cet entrepôt", n(impact.agents)],
  ] as Array<[string, string]>).filter(([label, value]) => label === "Stock" || value !== "0") : [];
  return (
    <Dialog open={Boolean(warehouse)} onOpenChange={open => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-destructive-soft text-destructive"><TriangleAlert className="h-5 w-5" /></span>{isRemove ? `Supprimer définitivement « ${warehouse?.name} » ?` : `Réinitialiser « ${warehouse?.name} » ?`}</DialogTitle>
          <DialogDescription>{isRemove ? "L’entrepôt et tout ce qui y a été fait seront effacés définitivement." : "L’entrepôt redevient tel qu’à sa création : tout ce qui y a été fait est effacé. Il reste disponible, vide."} Cette action est irréversible.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border">
          <p className="border-b border-border px-4 py-2.5 text-[13px] font-semibold text-foreground">Sera supprimé</p>
          {isLoading || !impact ? <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calcul en cours…</div> : <ul className="divide-y divide-border text-sm">{rows.map(([label, value]) => <li key={label} className="flex items-center justify-between gap-3 px-4 py-2"><span className="text-muted-foreground">{label}</span><span className="font-semibold text-foreground">{value}</span></li>)}</ul>}
        </div>
        <p className="text-[13px] text-muted-foreground">Restent intacts : le catalogue des produits et les clients (communs à toute l’entreprise), les comptes utilisateurs et le journal d’activité. Le stock total des produits diminue du stock effacé ; un ajustement « Réinitialisation de l’entrepôt » est inscrit dans leur historique.</p>
        {impact && blocked && <div className="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-[13px] text-destructive">Un transfert en transit concerne cet entrepôt : réceptionnez-le ou annulez-le d’abord.</div>}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-4 py-3 text-[13px] text-muted-foreground">Faites une sauvegarde avant de continuer.<Button size="sm" variant="outline" disabled={backup.isPending || backup.isSuccess} onClick={() => backup.mutate()}>{backup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}{backup.isSuccess ? "Sauvegarde faite" : "Sauvegarder maintenant"}</Button></div>
        <label className="block space-y-1.5"><span className="text-[13px] text-foreground">Pour confirmer, saisissez le nom de l’entrepôt : <strong>{warehouse?.name}</strong></span><Input value={confirmName} onChange={event => setConfirmName(event.target.value)} placeholder={warehouse?.name} autoComplete="off" aria-label="Nom de l’entrepôt à confirmer" disabled={blocked} /></label>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>Annuler</Button>
          <Button variant="destructive" disabled={!matches || pending || blocked || !impact} onClick={() => warehouse && (isRemove ? remove : reset).mutate({ id: warehouse.id, confirmName })}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{isRemove ? "Supprimer définitivement" : "Réinitialiser l’entrepôt"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
