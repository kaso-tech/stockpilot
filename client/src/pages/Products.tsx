import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Edit3, PackagePlus, Plus, RotateCcw, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type PriceTierForm = { minQuantity: string; unitPrice: string };
type ProductForm = {
  reference: string; name: string; category: string; unit: string; purchasePrice: string; retailPrice: string; wholesalePrice: string;
  quantity: string; minimumQuantity: string; supplierId: string; tiersEnabled: boolean; priceTiers: PriceTierForm[];
};

const empty: ProductForm = { reference: "", name: "", category: "", unit: "unité", purchasePrice: "", retailPrice: "", wholesalePrice: "", quantity: "0", minimumQuantity: "0", supplierId: "none", tiersEnabled: false, priceTiers: [] };

export default function Products() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: products = [], isLoading } = trpc.products.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(empty);

  const categories = useMemo(() => Array.from(new Set(products.map(item => item.category))).sort(), [products]);
  const filtered = useMemo(() => products.filter(item => {
    const match = [item.name, item.reference, item.category].some(value => value.toLowerCase().includes(query.toLowerCase()));
    const categoryOk = category === "all" || item.category === category;
    const supplierOk = supplier === "all" || (supplier === "none" ? item.supplierId === null : item.supplierId === Number(supplier));
    const statusOk = status === "all" || (status === "alert" ? item.quantity <= item.minimumQuantity : item.quantity > item.minimumQuantity);
    return match && categoryOk && supplierOk && statusOk;
  }), [products, query, category, supplier, status]);
  const hasFilters = Boolean(query) || category !== "all" || supplier !== "all" || status !== "all";

  const refresh = () => { utils.products.list.invalidate(); utils.dashboard.get.invalidate(); };
  const create = trpc.products.create.useMutation({ onSuccess: () => { refresh(); toast.success("Produit créé."); }, onError: error => toast.error(error.message) });
  const update = trpc.products.update.useMutation({ onSuccess: () => { refresh(); toast.success("Produit mis à jour."); }, onError: error => toast.error(error.message) });
  const remove = trpc.products.remove.useMutation({ onSuccess: () => { refresh(); toast.success("Produit supprimé."); }, onError: error => toast.error(error.message) });
  const reset = () => { setForm(empty); setEditingId(null); };
  const clearFilters = () => { setQuery(""); setCategory("all"); setSupplier("all"); setStatus("all"); };

  const edit = (item: typeof products[number]) => {
    const tiers = item.priceTiers ?? [];
    setEditingId(item.id);
    setForm({
      reference: item.reference, name: item.name, category: item.category, unit: item.unit,
      purchasePrice: (item.purchasePriceCents / 100).toFixed(2), retailPrice: (item.retailPriceCents / 100).toFixed(2), wholesalePrice: (item.wholesalePriceCents / 100).toFixed(2),
      quantity: String(item.quantity), minimumQuantity: String(item.minimumQuantity), supplierId: item.supplierId ? String(item.supplierId) : "none",
      tiersEnabled: tiers.length > 0, priceTiers: tiers.map(tier => ({ minQuantity: String(tier.minQuantity), unitPrice: (tier.unitPriceCents / 100).toFixed(2) })),
    });
    setOpen(true);
  };

  const save = () => {
    const priceTiers = form.tiersEnabled ? form.priceTiers.map(tier => ({ minQuantity: Number(tier.minQuantity), unitPriceCents: Math.round(Number(tier.unitPrice.replace(",", ".")) * 100) })) : [];
    const data = {
      reference: form.reference.trim(), name: form.name.trim(), category: form.category.trim(), unit: form.unit.trim(),
      purchasePriceCents: Math.round(Number(form.purchasePrice) * 100), retailPriceCents: Math.round(Number(form.retailPrice) * 100), wholesalePriceCents: Math.round(Number(form.wholesalePrice) * 100),
      quantity: Number(form.quantity), minimumQuantity: Number(form.minimumQuantity), supplierId: form.supplierId === "none" ? null : Number(form.supplierId), priceTiers,
    };
    if (!data.reference || !data.name || !data.category || !data.unit || [data.purchasePriceCents, data.retailPriceCents, data.wholesalePriceCents].some(Number.isNaN)) return toast.error("Renseignez les trois prix et les champs requis.");
    if (priceTiers.some(tier => !Number.isInteger(tier.minQuantity) || tier.minQuantity < 2 || !Number.isFinite(tier.unitPriceCents) || tier.unitPriceCents < 0) || new Set(priceTiers.map(tier => tier.minQuantity)).size !== priceTiers.length) return toast.error("Chaque palier doit avoir un seuil unique d’au moins 2 et un prix valide.");
    const done = () => { setOpen(false); reset(); };
    if (editingId) update.mutate({ id: editingId, ...data }, { onSuccess: done }); else create.mutate(data, { onSuccess: done });
  };

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Catalogue</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Produits & références</h1></div>{canManage && <Button onClick={() => { reset(); setOpen(true); }} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90"><PackagePlus className="mr-2 h-4 w-4" />Ajouter un produit</Button>}</header>
    <Card className="border-white/[0.07] bg-[#111722] shadow-none"><CardContent className="p-0"><div className="border-b border-white/[0.07] p-4"><div className="flex flex-col gap-3 xl:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une référence…" className="border-white/10 bg-white/[0.03] pl-9" /></div><Select value={category} onValueChange={setCategory}><SelectTrigger className="xl:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes catégories</SelectItem>{categories.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Select value={supplier} onValueChange={setSupplier}><SelectTrigger className="xl:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous fournisseurs</SelectItem><SelectItem value="none">Sans fournisseur</SelectItem>{suppliers.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="xl:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem><SelectItem value="alert">Sous le seuil</SelectItem><SelectItem value="healthy">Stock sain</SelectItem></SelectContent></Select>{hasFilters && <Button onClick={clearFilters} variant="ghost" className="text-slate-400"><RotateCcw className="mr-2 h-4 w-4" />Réinitialiser</Button>}</div></div>{isLoading ? <div className="px-6 py-16 text-center text-sm text-slate-500">Chargement du catalogue…</div> : !filtered.length ? <div className="px-6 py-16 text-center"><SlidersHorizontal className="mx-auto h-6 w-6 text-slate-600" /><p className="mt-3 font-medium text-slate-300">Aucune référence trouvée</p><p className="mt-1 text-xs text-slate-500">Modifiez vos filtres ou ajoutez un produit.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left"><thead className="bg-white/[0.018] text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500"><tr><th className="px-6 py-3">Produit</th><th className="px-4 py-3">Achat</th><th className="px-4 py-3">Détail</th><th className="px-4 py-3">Gros</th><th className="px-4 py-3">Stock</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filtered.map(item => { const low = item.quantity <= item.minimumQuantity; return <tr key={item.id} className="text-sm hover:bg-white/[0.018]"><td className="px-6 py-4"><p className="font-medium text-slate-100">{item.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.reference} · {item.category}</p>{item.priceTiers?.length ? <p className="mt-1 text-[11px] text-primary">Paliers : {item.priceTiers.map(tier => `${tier.minQuantity}+`).join(" · ")}</p> : null}</td><td className="px-4 py-4 text-slate-400">{formatCurrency(item.purchasePriceCents)}</td><td className="px-4 py-4 font-medium text-cyan-200">{formatCurrency(item.retailPriceCents)}</td><td className="px-4 py-4 font-medium text-violet-200">{formatCurrency(item.wholesalePriceCents)}</td><td className="px-4 py-4"><Badge className={`border-0 ${low ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300"}`}>{item.quantity} {item.unit}</Badge></td><td className="px-6 py-4 text-right">{canManage && <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => edit(item)} className="h-8 w-8 text-slate-400"><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => { if (window.confirm(`Supprimer ${item.name} ?`)) remove.mutate({ id: item.id }); }} className="h-8 w-8 text-rose-300"><Trash2 className="h-4 w-4" /></Button></div>}</td></tr>; })}</tbody></table></div>}</CardContent></Card>
    <ProductDialog open={open} form={form} setForm={setForm} suppliers={suppliers} editing={Boolean(editingId)} pending={create.isPending || update.isPending} onClose={() => setOpen(false)} onSave={save} />
  </div>;
}

function ProductDialog({ open, form, setForm, suppliers, editing, pending, onClose, onSave }: { open: boolean; form: ProductForm; setForm: (form: ProductForm) => void; suppliers: Array<{ id: number; name: string }>; editing: boolean; pending: boolean; onClose: () => void; onSave: () => void }) {
  const updateTier = (index: number, patch: Partial<PriceTierForm>) => setForm({ ...form, priceTiers: form.priceTiers.map((tier, position) => position === index ? { ...tier, ...patch } : tier) });
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#141b27] text-slate-100 sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle><DialogDescription className="text-slate-400">Les paliers remplacent le tarif client à partir du seuil configuré.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="Référence *"><Input value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} /></Field><Field label="Nom *"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Catégorie *"><Input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} /></Field><Field label="Unité *"><Input value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} /></Field><Field label="Prix d’achat *"><Input type="number" step="0.01" value={form.purchasePrice} onChange={event => setForm({ ...form, purchasePrice: event.target.value })} /></Field><Field label="Prix détail *"><Input type="number" step="0.01" value={form.retailPrice} onChange={event => setForm({ ...form, retailPrice: event.target.value })} /></Field><Field label="Prix gros *"><Input type="number" step="0.01" value={form.wholesalePrice} onChange={event => setForm({ ...form, wholesalePrice: event.target.value })} /></Field><Field label="Stock initial *"><Input type="number" min="0" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></Field><Field label="Seuil minimum *"><Input type="number" min="0" value={form.minimumQuantity} onChange={event => setForm({ ...form, minimumQuantity: event.target.value })} /></Field><Field label="Fournisseur"><Select value={form.supplierId} onValueChange={value => setForm({ ...form, supplierId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucun fournisseur</SelectItem>{suppliers.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></Field><div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Paliers par quantité</p><p className="mt-1 text-xs text-slate-400">Par exemple : 5+ à 115 000, 10+ à 110 000. Le palier s’applique aussi aux clients détail.</p></div><label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-primary"><input type="checkbox" checked={form.tiersEnabled} onChange={event => setForm({ ...form, tiersEnabled: event.target.checked, priceTiers: event.target.checked && !form.priceTiers.length ? [{ minQuantity: "5", unitPrice: "" }] : form.priceTiers })} />Activer</label></div>{form.tiersEnabled && <div className="mt-4 space-y-2">{form.priceTiers.map((tier, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Input type="number" min="2" value={tier.minQuantity} onChange={event => updateTier(index, { minQuantity: event.target.value })} placeholder="À partir de" /><Input type="number" min="0" step="0.01" value={tier.unitPrice} onChange={event => updateTier(index, { unitPrice: event.target.value })} placeholder="Prix unitaire" /><Button type="button" size="icon" variant="ghost" onClick={() => setForm({ ...form, priceTiers: form.priceTiers.filter((_, position) => position !== index) })} className="text-rose-300"><Trash2 className="h-4 w-4" /></Button></div>)}<Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, priceTiers: [...form.priceTiers, { minQuantity: "", unitPrice: "" }] })} className="border-primary/30 text-primary"><Plus className="mr-1 h-3.5 w-3.5" />Ajouter un palier</Button></div>}</div></div><DialogFooter><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={onSave} disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90">{editing ? "Enregistrer" : "Créer"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-xs text-slate-300">{label}</Label>{children}</div>; }
