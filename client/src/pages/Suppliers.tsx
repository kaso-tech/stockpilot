import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatSignedQuantity } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Building2, Edit3, Mail, PackageCheck, Phone, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type SupplierForm = { name: string; contactName: string; email: string; phone: string };
const emptySupplier: SupplierForm = { name: "", contactName: "", email: "", phone: "" };

export default function Suppliers() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: movements = [] } = trpc.movements.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptySupplier);
  const createSupplier = trpc.suppliers.create.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Fournisseur créé."); } });
  const updateSupplier = trpc.suppliers.update.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Fournisseur mis à jour."); } });
  const reset = () => { setEditingId(null); setForm(emptySupplier); };
  const submit = () => {
    if (!form.name.trim()) return toast.error("Le nom du fournisseur est requis.");
    const data = { name: form.name.trim(), contactName: form.contactName.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null };
    const done = () => { setOpen(false); reset(); };
    if (editingId) updateSupplier.mutate({ id: editingId, ...data }, { onSuccess: done, onError: error => toast.error(error.message) });
    else createSupplier.mutate(data, { onSuccess: done, onError: error => toast.error(error.message) });
  };
  const edit = (supplier: typeof suppliers[number]) => { setEditingId(supplier.id); setForm({ name: supplier.name, contactName: supplier.contactName || "", email: supplier.email || "", phone: supplier.phone || "" }); setOpen(true); };
  const dialog = <SupplierDialog open={open} setOpen={value => { setOpen(value); if (!value) reset(); }} form={form} setForm={setForm} editing={Boolean(editingId)} pending={createSupplier.isPending || updateSupplier.isPending} submit={submit} />;

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">Approvisionnement</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Fournisseurs</h1><p className="mt-1.5 text-sm text-slate-400">Gérez les contacts clés et l’historique complet de leurs approvisionnements.</p></div>{canManage && <Button onClick={() => { reset(); setOpen(true); }} className="h-10 bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Plus className="mr-2 h-4 w-4" /> Nouveau fournisseur</Button>}</header>
    {dialog}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{suppliers.length ? suppliers.map(supplier => {
      const supplies = movements.filter(item => item.supplierId === supplier.id && item.type === "entry");
      return <Card key={supplier.id} className="border-white/[0.07] bg-[#111722] shadow-none"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><Building2 className="h-5 w-5" /></span>{canManage && <Button size="icon" variant="ghost" onClick={() => edit(supplier)} className="h-8 w-8 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-300"><Edit3 className="h-4 w-4" /></Button>}</div><h2 className="mt-5 text-base font-semibold text-white">{supplier.name}</h2><p className="mt-1 text-sm text-slate-400">{supplier.contactName || "Contact non renseigné"}</p><div className="mt-5 space-y-2 border-t border-white/[0.07] pt-4 text-xs text-slate-500">{supplier.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-600" />{supplier.email}</p>}{supplier.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-600" />{supplier.phone}</p>}</div><div className="mt-5 border-t border-white/[0.07] pt-4"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold text-slate-300"><PackageCheck className="h-4 w-4 text-cyan-300" /> Historique complet</span><span className="text-xs text-slate-500">{supplies.length} entrée{supplies.length > 1 ? "s" : ""}</span></div>{supplies.length ? <div className="mt-3 max-h-72 divide-y divide-white/[0.06] overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.018]">{supplies.map(movement => <div key={movement.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-300">{movement.productName}</span><span className="mt-0.5 block text-[11px] text-slate-600">{formatDate(movement.occurredAt)} · {movement.reason}</span></span><span className="shrink-0 text-xs font-semibold text-emerald-300">{formatSignedQuantity(movement.quantity)}</span></div>)}</div> : <p className="mt-3 rounded-lg bg-white/[0.02] px-3 py-3 text-xs text-slate-500">Aucune entrée liée à ce fournisseur.</p>}</div></CardContent></Card>;
    }) : <Card className="col-span-full border-dashed border-white/10 bg-[#111722] shadow-none"><CardContent className="py-16 text-center"><Building2 className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-4 font-medium text-slate-300">Aucun fournisseur enregistré</p><p className="mt-1 text-sm text-slate-500">Ajoutez vos partenaires pour enrichir la traçabilité des entrées en stock.</p></CardContent></Card>}</section>
  </div>;
}

function SupplierDialog({ open, setOpen, form, setForm, editing, pending, submit }: { open: boolean; setOpen: (value: boolean) => void; form: SupplierForm; setForm: (value: SupplierForm) => void; editing: boolean; pending: boolean; submit: () => void }) {
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="border-white/10 bg-[#141b27] text-slate-100"><DialogHeader><DialogTitle>{editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><Field label="Nom de l’entreprise *"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Contact"><Input value={form.contactName} onChange={event => setForm({ ...form, contactName: event.target.value })} /></Field><Field label="E-mail"><Input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field><Field label="Téléphone"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field></div><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)} className="text-slate-300 hover:bg-white/[0.06] hover:text-white">Annuler</Button><Button onClick={submit} disabled={pending} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{editing ? "Enregistrer" : "Créer le fournisseur"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-xs font-medium text-slate-300">{label}</Label>{children}</div>; }
