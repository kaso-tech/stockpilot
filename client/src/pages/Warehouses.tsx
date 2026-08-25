import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Archive, CheckCircle2, MapPin, PackagePlus, Pencil, Warehouse as WarehouseIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Restricted } from "./AuditLog";

type WarehouseRecord = { id: number; name: string; code: string; address: string | null; active: boolean; isDefault: boolean; productCount: number; totalQuantity: number };

const emptyForm = { name: "", code: "", address: "", isDefault: false };

export default function Warehouses() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: warehouses = [], isLoading } = trpc.warehouses.list.useQuery(undefined, { enabled: isAdmin });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const selectedWarehouse = useMemo(() => warehouses.find(warehouse => warehouse.id === selectedWarehouseId) ?? warehouses.find(warehouse => warehouse.isDefault) ?? null, [warehouses, selectedWarehouseId]);
  const stock = trpc.warehouses.stocks.useQuery({ warehouseId: selectedWarehouse?.id ?? 0 }, { enabled: Boolean(selectedWarehouse?.id) && isAdmin });
  const refresh = () => { void utils.warehouses.list.invalidate(); if (selectedWarehouse?.id) void utils.warehouses.stocks.invalidate({ warehouseId: selectedWarehouse.id }); };
  const create = trpc.warehouses.create.useMutation({ onSuccess: result => { refresh(); setSelectedWarehouseId(result.id); closeDialog(); toast.success("Entrepôt créé."); }, onError: error => toast.error(error.message) });
  const update = trpc.warehouses.update.useMutation({ onSuccess: () => { refresh(); closeDialog(); toast.success("Entrepôt mis à jour."); }, onError: error => toast.error(error.message) });
  const setDefault = trpc.warehouses.setDefault.useMutation({ onSuccess: () => { refresh(); toast.success("Entrepôt principal mis à jour."); }, onError: error => toast.error(error.message) });
  const archive = trpc.warehouses.archive.useMutation({ onSuccess: () => { refresh(); toast.success("Entrepôt désactivé."); }, onError: error => toast.error(error.message) });
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, isDefault: warehouses.length === 0 }); setDialogOpen(true); };
  const openEdit = (warehouse: WarehouseRecord) => { setEditing(warehouse); setForm({ name: warehouse.name, code: warehouse.code, address: warehouse.address ?? "", isDefault: warehouse.isDefault }); setDialogOpen(true); };
  const save = () => {
    const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase(), address: form.address.trim() || null, isDefault: form.isDefault };
    if (payload.name.length < 2 || payload.code.length < 2) return toast.error("Renseignez un nom et un code d’au moins deux caractères.");
    if (editing) update.mutate({ id: editing.id, ...payload }); else create.mutate(payload);
  };

  if (!isAdmin) return <Restricted title="Entrepôts" description="La gestion des entrepôts et transferts est réservée aux administrateurs." />;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Organisation du stock</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Entrepôts</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Répartissez le stock par site, désignez un dépôt principal et consultez le niveau de chaque produit sans mélanger les entreprises.</p></div><Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90"><PackagePlus className="mr-2 h-4 w-4" />Nouvel entrepôt</Button></header>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
      <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="p-0">{isLoading ? <div className="px-6 py-16 text-center text-sm text-slate-500">Chargement des entrepôts…</div> : warehouses.length ? <div className="divide-y divide-white/[0.06]">{warehouses.map(warehouse => <button key={warehouse.id} type="button" onClick={() => setSelectedWarehouseId(warehouse.id)} className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.035] ${selectedWarehouse?.id === warehouse.id ? "bg-primary/10" : ""}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${warehouse.active ? "bg-primary/10 text-primary" : "bg-slate-700/50 text-slate-400"}`}><WarehouseIcon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-medium text-slate-100">{warehouse.name}</span>{warehouse.isDefault && <Badge className="border-0 bg-emerald-400/10 text-emerald-300">Principal</Badge>}{!warehouse.active && <Badge className="border-0 bg-slate-500/15 text-slate-400">Inactif</Badge>}</span><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span className="font-mono text-slate-400">{warehouse.code}</span>{warehouse.address && <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3" />{warehouse.address}</span>}</span></span><span className="hidden shrink-0 text-right sm:block"><span className="block text-sm font-semibold text-slate-100">{warehouse.totalQuantity} unités</span><span className="mt-1 block text-xs text-slate-500">{warehouse.productCount} référence{warehouse.productCount > 1 ? "s" : ""}</span></span><span className="flex shrink-0 gap-1" onClick={event => event.stopPropagation()}><Button size="icon" variant="ghost" onClick={() => openEdit(warehouse)} aria-label={`Modifier ${warehouse.name}`} className="text-primary"><Pencil className="h-4 w-4" /></Button>{!warehouse.isDefault && warehouse.active && <Button size="icon" variant="ghost" onClick={() => setDefault.mutate({ id: warehouse.id })} disabled={setDefault.isPending} aria-label={`Définir ${warehouse.name} comme principal`} className="text-emerald-300"><CheckCircle2 className="h-4 w-4" /></Button>}{!warehouse.isDefault && warehouse.active && <Button size="icon" variant="ghost" onClick={() => { if (window.confirm(`Désactiver ${warehouse.name} ?`)) archive.mutate({ id: warehouse.id }); }} disabled={archive.isPending} aria-label={`Désactiver ${warehouse.name}`} className="text-rose-300"><Archive className="h-4 w-4" /></Button>}</span></button>)}</div> : <div className="px-6 py-16 text-center"><WarehouseIcon className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-medium text-slate-300">Aucun entrepôt</p><p className="mt-1 text-sm text-slate-500">Créez votre premier dépôt pour répartir vos stocks.</p></div>}</CardContent></Card>
      <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Stock localisé</p><h2 className="mt-2 text-lg font-semibold text-white">{selectedWarehouse?.name ?? "Sélectionnez un entrepôt"}</h2>{selectedWarehouse && <p className="mt-1 text-xs text-slate-500">{selectedWarehouse.code} · {selectedWarehouse.totalQuantity} unités disponibles</p>}</div>{selectedWarehouse?.isDefault && <Badge className="border-0 bg-emerald-400/10 text-emerald-300">Dépôt principal</Badge>}</div><div className="mt-5 max-h-[430px] overflow-y-auto pr-1">{stock.isLoading ? <p className="py-10 text-center text-sm text-slate-500">Chargement du stock…</p> : stock.data?.products?.length ? <div className="space-y-2">{stock.data.products.map(product => { const low = product.quantity <= product.minimumQuantity; return <div key={product.productId} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{product.name}</span><span className="mt-0.5 block font-mono text-[11px] text-slate-500">{product.reference}</span></span><span className={`shrink-0 text-right text-sm font-semibold ${low ? "text-amber-300" : "text-slate-100"}`}>{product.quantity} <span className="text-xs font-normal text-slate-500">{product.unit}</span></span></div>; })}</div> : <p className="py-10 text-center text-sm text-slate-500">Aucun produit à afficher dans cet entrepôt.</p>}</div></CardContent></Card>
    </section>

    <Dialog open={dialogOpen} onOpenChange={value => !value && closeDialog()}><DialogContent className="border-white/10 bg-[#141b27] text-slate-100"><DialogHeader><DialogTitle>{editing ? "Modifier l’entrepôt" : "Nouvel entrepôt"}</DialogTitle></DialogHeader><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-[1fr_150px]"><div className="space-y-2"><Label>Nom</Label><Input autoFocus value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Ex. Dépôt central" /></div><div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="CENTRAL" /></div></div><div className="space-y-2"><Label>Adresse ou repère</Label><Textarea value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} placeholder="Adresse, quartier ou contact du site (facultatif)" className="min-h-20" /></div><label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3"><span><span className="block text-sm font-medium text-slate-200">Entrepôt principal</span><span className="mt-0.5 block text-xs text-slate-500">Les nouveaux documents utiliseront ce dépôt par défaut.</span></span><Switch checked={form.isDefault} onCheckedChange={checked => setForm(current => ({ ...current, isDefault: checked }))} /></label></div><DialogFooter><Button variant="ghost" onClick={closeDialog}>Annuler</Button><Button onClick={save} disabled={create.isPending || update.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{editing ? "Enregistrer" : "Créer l’entrepôt"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
