import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Edit3, PackagePlus, RotateCcw, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ProductForm = {
  reference: string; name: string; category: string; unit: string;
  purchasePrice: string; quantity: string; minimumQuantity: string; supplierId: string;
};

const emptyProduct: ProductForm = { reference: "", name: "", category: "", unit: "unité", purchasePrice: "", quantity: "0", minimumQuantity: "0", supplierId: "none" };

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: products = [], isLoading } = trpc.products.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const categories = useMemo(() => Array.from(new Set(products.map(product => product.category))).sort(), [products]);
  const hasFilters = query || categoryFilter !== "all" || supplierFilter !== "all" || stockFilter !== "all";

  const filtered = useMemo(() => products.filter(product => {
    const textMatch = [product.name, product.reference, product.category].some(value => value.toLowerCase().includes(query.toLowerCase()));
    const categoryMatch = categoryFilter === "all" || product.category === categoryFilter;
    const supplierMatch = supplierFilter === "all" || (supplierFilter === "none" ? product.supplierId === null : product.supplierId === Number(supplierFilter));
    const stockMatch = stockFilter === "all" || (stockFilter === "alert" ? product.quantity <= product.minimumQuantity : product.quantity > product.minimumQuantity);
    return textMatch && categoryMatch && supplierMatch && stockMatch;
  }), [products, query, categoryFilter, supplierFilter, stockFilter]);

  const createProduct = trpc.products.create.useMutation({ onSuccess: () => { utils.products.list.invalidate(); utils.dashboard.get.invalidate(); toast.success("Produit créé."); } });
  const updateProduct = trpc.products.update.useMutation({ onSuccess: () => { utils.products.list.invalidate(); utils.dashboard.get.invalidate(); toast.success("Produit mis à jour."); } });
  const removeProduct = trpc.products.remove.useMutation({ onSuccess: () => { utils.products.list.invalidate(); utils.dashboard.get.invalidate(); toast.success("Produit supprimé."); } });

  const resetForm = () => { setForm(emptyProduct); setEditingId(null); };
  const resetFilters = () => { setQuery(""); setCategoryFilter("all"); setSupplierFilter("all"); setStockFilter("all"); };
  const editProduct = (product: typeof products[number]) => {
    setEditingId(product.id);
    setForm({ reference: product.reference, name: product.name, category: product.category, unit: product.unit, purchasePrice: (product.purchasePriceCents / 100).toFixed(2), quantity: String(product.quantity), minimumQuantity: String(product.minimumQuantity), supplierId: product.supplierId ? String(product.supplierId) : "none" });
    setOpen(true);
  };
  const submit = () => {
    const payload = { reference: form.reference.trim(), name: form.name.trim(), category: form.category.trim(), unit: form.unit.trim(), purchasePriceCents: Math.round(Number(form.purchasePrice) * 100), quantity: Number(form.quantity), minimumQuantity: Number(form.minimumQuantity), supplierId: form.supplierId === "none" ? null : Number(form.supplierId) };
    if (!payload.reference || !payload.name || !payload.category || !payload.unit || Number.isNaN(payload.purchasePriceCents)) { toast.error("Complétez les champs requis avec des valeurs valides."); return; }
    const done = () => { setOpen(false); resetForm(); };
    if (editingId) updateProduct.mutate({ id: editingId, ...payload }, { onSuccess: done, onError: error => toast.error(error.message) });
    else createProduct.mutate(payload, { onSuccess: done, onError: error => toast.error(error.message) });
  };

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">Catalogue</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Produits & références</h1><p className="mt-1.5 text-sm text-slate-400">Centralisez vos articles, niveaux en stock et seuils de réapprovisionnement.</p></div>
      {isAdmin && <ProductDialog open={open} onOpenChange={value => { setOpen(value); if (!value) resetForm(); }} form={form} setForm={setForm} suppliers={suppliers} editing={Boolean(editingId)} submit={submit} pending={createProduct.isPending || updateProduct.isPending} trigger={<Button onClick={() => { resetForm(); setOpen(true); }} className="h-10 bg-cyan-400 text-slate-950 hover:bg-cyan-300"><PackagePlus className="mr-2 h-4 w-4" /> Ajouter un produit</Button>} />}
    </header>

    <Card className="border-white/[0.07] bg-[#111722] shadow-none"><CardContent className="p-0">
      <div className="border-b border-white/[0.07] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une référence…" className="border-white/10 bg-white/[0.03] pl-9 text-slate-200 placeholder:text-slate-600" /></div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Catégorie" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes catégories</SelectItem>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}><SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Fournisseur" /></SelectTrigger><SelectContent><SelectItem value="all">Tous fournisseurs</SelectItem><SelectItem value="none">Sans fournisseur</SelectItem>{suppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select>
            <Select value={stockFilter} onValueChange={setStockFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem><SelectItem value="alert">Sous le seuil</SelectItem><SelectItem value="healthy">Stock sain</SelectItem></SelectContent></Select>
          </div>
          <div className="flex items-center justify-between gap-3 xl:justify-end"><p className="whitespace-nowrap text-xs text-slate-500">{filtered.length} référence{filtered.length > 1 ? "s" : ""}</p>{hasFilters && <Button onClick={resetFilters} variant="ghost" size="sm" className="text-slate-400 hover:bg-white/[0.06] hover:text-white"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Réinitialiser</Button>}</div>
        </div>
      </div>
      {isLoading ? <div className="px-6 py-16 text-center text-sm text-slate-500">Chargement du catalogue…</div> : filtered.length === 0 ? <div className="px-6 py-16 text-center"><SlidersHorizontal className="mx-auto h-6 w-6 text-slate-600" /><p className="mt-3 font-medium text-slate-300">Aucune référence trouvée</p><p className="mt-1 text-xs text-slate-500">Modifiez vos filtres ou ajoutez votre premier produit.</p>{hasFilters && <Button onClick={resetFilters} variant="ghost" className="mt-3 text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200">Effacer les filtres</Button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-white/[0.018] text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500"><tr><th className="px-6 py-3">Produit</th><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Prix achat</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Seuil</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filtered.map(product => { const low = product.quantity <= product.minimumQuantity; return <tr key={product.id} className="text-sm transition-colors hover:bg-white/[0.018]"><td className="px-6 py-4"><p className="font-medium text-slate-100">{product.name}</p><p className="mt-0.5 text-xs text-slate-500">{product.reference}</p></td><td className="px-4 py-4 text-slate-400">{product.category}</td><td className="px-4 py-4 text-slate-300">{formatCurrency(product.purchasePriceCents)}</td><td className="px-4 py-4"><Badge className={`border-0 ${low ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300"}`}>{product.quantity} {product.unit}</Badge></td><td className="px-4 py-4 text-slate-400">{product.minimumQuantity} {product.unit}</td><td className="px-6 py-4 text-right">{isAdmin ? <div className="flex justify-end gap-1"><Button onClick={() => editProduct(product)} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:bg-white/[0.06] hover:text-cyan-300"><Edit3 className="h-4 w-4" /></Button><Button onClick={() => { if (window.confirm(`Supprimer ${product.name} ?`)) removeProduct.mutate({ id: product.id }, { onError: error => toast.error(error.message) }); }} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 className="h-4 w-4" /></Button></div> : <span className="text-xs text-slate-600">Lecture seule</span>}</td></tr>; })}</tbody></table></div>}
    </CardContent></Card>
  </div>;
}

function ProductDialog({ open, onOpenChange, form, setForm, suppliers, editing, submit, pending, trigger }: { open: boolean; onOpenChange: (value: boolean) => void; form: ProductForm; setForm: (value: ProductForm) => void; suppliers: Array<{ id: number; name: string }>; editing: boolean; submit: () => void; pending: boolean; trigger: React.ReactNode }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#141b27] text-slate-100 sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle><DialogDescription className="text-slate-400">Renseignez les informations nécessaires au suivi de votre référence.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="Référence *"><Input value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} placeholder="SKU-0001" /></Field><Field label="Nom du produit *"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Nom commercial" /></Field><Field label="Catégorie *"><Input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder="Ex. Consommables" /></Field><Field label="Unité *"><Input value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} placeholder="unité, kg, carton…" /></Field><Field label="Prix d’achat (€) *"><Input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={event => setForm({ ...form, purchasePrice: event.target.value })} /></Field><Field label="Stock initial *"><Input type="number" min="0" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></Field><Field label="Seuil minimum *"><Input type="number" min="0" value={form.minimumQuantity} onChange={event => setForm({ ...form, minimumQuantity: event.target.value })} /></Field><Field label="Fournisseur"><Select value={form.supplierId} onValueChange={supplierId => setForm({ ...form, supplierId })}><SelectTrigger><SelectValue placeholder="Aucun fournisseur" /></SelectTrigger><SelectContent><SelectItem value="none">Aucun fournisseur</SelectItem>{suppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select></Field></div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-300 hover:bg-white/[0.06] hover:text-white">Annuler</Button><Button onClick={submit} disabled={pending} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{editing ? "Enregistrer" : "Créer le produit"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-xs font-medium text-slate-300">{label}</Label>{children}</div>; }
