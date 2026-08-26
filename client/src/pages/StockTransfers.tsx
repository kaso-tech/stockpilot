import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, CircleX, ClipboardPenLine, PackagePlus, Send, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Restricted } from "./AuditLog";

type DraftLine = { productId: string; quantity: string };
const emptyLine = (): DraftLine => ({ productId: "unselected", quantity: "1" });

const statusTone = {
  draft: "bg-slate-400/10 text-slate-300",
  in_transit: "bg-amber-400/10 text-amber-300",
  received: "bg-emerald-400/10 text-emerald-300",
  cancelled: "bg-rose-400/10 text-rose-300",
};
const statusLabel = { draft: "Brouillon", in_transit: "En transit", received: "Réceptionné", cancelled: "Annulé" };

export default function StockTransfers() {
  const { user } = useAuth();
  const canAccessTransfers = Boolean(user);
  const utils = trpc.useUtils();
  const { data: warehouses = [] } = trpc.warehouses.list.useQuery(undefined, { enabled: canAccessTransfers });
  const { data: products = [] } = trpc.products.list.useQuery(undefined, { enabled: canAccessTransfers });
  const { data: transfers = [], isLoading } = trpc.stockTransfers.list.useQuery(undefined, { enabled: canAccessTransfers });
  const activeWarehouses = useMemo(() => warehouses.filter(warehouse => warehouse.active), [warehouses]);
  const [open, setOpen] = useState(false);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("none");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("none");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const refresh = () => { void utils.stockTransfers.list.invalidate(); void utils.warehouses.list.invalidate(); };
  const close = () => { setOpen(false); setNotes(""); setLines([emptyLine()]); setSourceWarehouseId("none"); setDestinationWarehouseId("none"); };
  const openCreate = () => { const primary = activeWarehouses.find(warehouse => warehouse.isDefault); setSourceWarehouseId(primary ? String(primary.id) : "none"); setDestinationWarehouseId("none"); setNotes(""); setLines([emptyLine()]); setOpen(true); };
  const create = trpc.stockTransfers.create.useMutation({ onSuccess: result => { refresh(); close(); toast.success(`Transfert ${result.transferNumber} créé.`); }, onError: error => toast.error(error.message) });
  const dispatch = trpc.stockTransfers.dispatch.useMutation({ onSuccess: result => { refresh(); toast.success(result.alreadyDispatched ? "Ce transfert est déjà en transit." : "Transfert expédié."); }, onError: error => toast.error(error.message) });
  const receive = trpc.stockTransfers.receive.useMutation({ onSuccess: result => { refresh(); toast.success(result.alreadyReceived ? "Ce transfert est déjà réceptionné." : "Stock réceptionné dans l’entrepôt de destination."); }, onError: error => toast.error(error.message) });
  const cancel = trpc.stockTransfers.cancel.useMutation({ onSuccess: result => { refresh(); toast.success(result.alreadyCancelled ? "Ce transfert est déjà annulé." : "Transfert annulé."); }, onError: error => toast.error(error.message) });
  const save = () => {
    const source = Number(sourceWarehouseId);
    const destination = Number(destinationWarehouseId);
    const payloadLines = lines.map(line => ({ productId: Number(line.productId), quantity: Number(line.quantity) }));
    if (!Number.isInteger(source) || source <= 0 || !Number.isInteger(destination) || destination <= 0) return toast.error("Sélectionnez l’entrepôt source et l’entrepôt de destination.");
    if (source === destination) return toast.error("La source et la destination doivent être différentes.");
    if (payloadLines.some(line => !Number.isInteger(line.productId) || line.productId <= 0 || !Number.isInteger(line.quantity) || line.quantity <= 0)) return toast.error("Chaque ligne doit contenir un produit et une quantité positive.");
    if (new Set(payloadLines.map(line => line.productId)).size !== payloadLines.length) return toast.error("Un produit ne peut apparaître qu’une seule fois.");
    create.mutate({ sourceWarehouseId: source, destinationWarehouseId: destination, notes: notes.trim() || null, items: payloadLines });
  };
  const updateLine = (index: number, values: Partial<DraftLine>) => setLines(current => current.map((line, position) => position === index ? { ...line, ...values } : line));

  if (!canAccessTransfers) return <Restricted title="Transferts de stock" description="Connectez-vous pour consulter les transferts de vos entrepôts attribués." />;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Logistique interne</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Transferts de stock</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Préparez un transfert, expédiez uniquement le stock disponible et confirmez la réception dans l’entrepôt destinataire.</p></div><Button onClick={openCreate} disabled={activeWarehouses.length < 2} className="bg-primary text-primary-foreground hover:bg-primary/90"><PackagePlus className="mr-2 h-4 w-4" />Nouveau transfert</Button></header>
    {activeWarehouses.length < 2 && <Card className="border-amber-400/20 bg-amber-400/[0.06]"><CardContent className="flex gap-3 p-4 text-sm text-amber-100"><Truck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><span>Créez et activez au moins deux entrepôts avant de pouvoir effectuer un transfert.</span></CardContent></Card>}
    <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="p-0">{isLoading ? <div className="px-6 py-16 text-center text-sm text-slate-500">Chargement des transferts…</div> : transfers.length ? <div className="divide-y divide-white/[0.06]">{transfers.map(transfer => <div key={transfer.id} className="px-5 py-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${transfer.status === "received" ? "bg-emerald-400/10 text-emerald-300" : transfer.status === "cancelled" ? "bg-rose-400/10 text-rose-300" : "bg-primary/10 text-primary"}`}><Truck className="h-5 w-5" /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-slate-100">{transfer.transferNumber}</span><Badge className={`border-0 ${statusTone[transfer.status]}`}>{statusLabel[transfer.status]}</Badge></span><span className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300"><span className="truncate">{transfer.sourceWarehouse?.name ?? "Entrepôt source"}</span><ArrowRight className="h-4 w-4 shrink-0 text-slate-500" /><span className="truncate">{transfer.destinationWarehouse?.name ?? "Entrepôt destination"}</span></span><span className="mt-1 block text-xs text-slate-500">{transfer.items.length} ligne{transfer.items.length > 1 ? "s" : ""} · {transfer.items.map(item => `${item.productReference} × ${item.quantity}`).join(" · ")}</span>{transfer.notes && <span className="mt-1 block truncate text-xs text-slate-500">{transfer.notes}</span>}</span></div><div className="flex shrink-0 flex-wrap items-center gap-2">{transfer.status === "draft" && <><Button size="sm" variant="outline" onClick={() => { const reason = window.prompt("Motif d’annulation (3 caractères minimum) :"); if (reason) cancel.mutate({ id: transfer.id, reason }); }} disabled={cancel.isPending} className="border-rose-400/30 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"><CircleX className="mr-2 h-4 w-4" />Annuler</Button><Button size="sm" onClick={() => dispatch.mutate({ id: transfer.id })} disabled={dispatch.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90"><Send className="mr-2 h-4 w-4" />Expédier</Button></>}{transfer.status === "in_transit" && <><Button size="sm" variant="outline" onClick={() => { const reason = window.prompt("Motif d’annulation (3 caractères minimum) :"); if (reason) cancel.mutate({ id: transfer.id, reason }); }} disabled={cancel.isPending} className="border-rose-400/30 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"><CircleX className="mr-2 h-4 w-4" />Retourner</Button><Button size="sm" onClick={() => receive.mutate({ id: transfer.id })} disabled={receive.isPending} className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"><CheckCircle2 className="mr-2 h-4 w-4" />Réceptionner</Button></>}{transfer.status === "received" && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300"><CheckCircle2 className="h-4 w-4" />Réception confirmée</span>}</div></div></div>)}</div> : <div className="px-6 py-16 text-center"><ClipboardPenLine className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-medium text-slate-300">Aucun transfert</p><p className="mt-1 text-sm text-slate-500">Préparez un transfert pour déplacer le stock entre vos entrepôts.</p></div>}</CardContent></Card>

    <Dialog open={open} onOpenChange={value => !value && close()}><DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#141b27] text-slate-100 sm:max-w-2xl"><DialogHeader><DialogTitle>Nouveau transfert de stock</DialogTitle></DialogHeader><div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Entrepôt source</Label><Select value={sourceWarehouseId} onValueChange={setSourceWarehouseId}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="none">Sélectionner un entrepôt</SelectItem>{activeWarehouses.map(warehouse => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name} · {warehouse.code}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Entrepôt destination</Label><Select value={destinationWarehouseId} onValueChange={setDestinationWarehouseId}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent><SelectItem value="none">Sélectionner un entrepôt</SelectItem>{activeWarehouses.filter(warehouse => String(warehouse.id) !== sourceWarehouseId).map(warehouse => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name} · {warehouse.code}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label>Motif ou note</Label><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex. Réassort hebdomadaire du point de vente" className="min-h-20" /></div><div className="space-y-3"><div className="flex items-center justify-between"><Label>Lignes du transfert</Label><Button type="button" variant="ghost" size="sm" onClick={() => setLines(current => [...current, emptyLine()])} className="text-primary"><PackagePlus className="mr-2 h-4 w-4" />Ajouter une ligne</Button></div>{lines.map((line, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-2"><Select value={line.productId} onValueChange={value => updateLine(index, { productId: value })}><SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger><SelectContent><SelectItem value="unselected">Choisir un produit</SelectItem>{products.filter(product => !lines.some((candidate, candidateIndex) => candidateIndex !== index && candidate.productId === String(product.id))).map(product => <SelectItem key={product.id} value={String(product.id)}>{product.reference} · {product.name}</SelectItem>)}</SelectContent></Select><Input type="number" min="1" value={line.quantity} onChange={event => updateLine(index, { quantity: event.target.value })} aria-label="Quantité" /> <Button type="button" size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, position) => position !== index))} aria-label="Supprimer la ligne" className="text-rose-300"><Trash2 className="h-4 w-4" /></Button></div>)}</div></div><DialogFooter><Button variant="ghost" onClick={close}>Annuler</Button><Button onClick={save} disabled={create.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">Créer le transfert</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
