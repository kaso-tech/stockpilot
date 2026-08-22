import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatSignedQuantity } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Building2, Edit3, Mail, PackageCheck, Phone, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type SupplierForm = { name: string; otherReference: string; contactName: string; email: string; phone: string };
type Supplier = { id: number; name: string; otherReference: string | null; contactName: string | null; email: string | null; phone: string | null };
const emptySupplier: SupplierForm = { name: "", otherReference: "", contactName: "", email: "", phone: "" };

export default function Suppliers() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: movements = [] } = trpc.movements.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptySupplier);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const createSupplier = trpc.suppliers.create.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Fournisseur créé."); } });
  const updateSupplier = trpc.suppliers.update.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Fournisseur mis à jour."); } });
  const reset = () => { setEditingId(null); setForm(emptySupplier); };
  const closeForm = () => { setFormOpen(false); reset(); };
  const edit = (supplier: Supplier) => { setSelected(null); setEditingId(supplier.id); setForm({ name: supplier.name, otherReference: supplier.otherReference || "", contactName: supplier.contactName || "", email: supplier.email || "", phone: supplier.phone || "" }); setFormOpen(true); };
  const submit = () => {
    if (!form.name.trim()) return toast.error("Le nom du fournisseur est requis.");
    if (form.otherReference && !/^[A-Za-z0-9]+$/.test(form.otherReference)) return toast.error("Autre référence : utilisez uniquement lettres et chiffres.");
    const data = { name: form.name.trim(), otherReference: form.otherReference.trim() || null, contactName: form.contactName.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null };
    const done = () => closeForm();
    if (editingId) updateSupplier.mutate({ id: editingId, ...data }, { onSuccess: done, onError: error => toast.error(error.message) }); else createSupplier.mutate(data, { onSuccess: done, onError: error => toast.error(error.message) });
  };

  return <div className="mx-auto max-w-[1500px] space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Approvisionnement</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Fournisseurs</h1></div>{canManage && <Button onClick={() => { reset(); setFormOpen(true); }} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nouveau fournisseur</Button>}</header><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{suppliers.length ? suppliers.map(supplier => { const supplies = movements.filter(item => item.supplierId === supplier.id && item.type === "entry"); return <Card key={supplier.id} role="button" tabIndex={0} onClick={() => setSelected(supplier)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(supplier); } }} className="cursor-pointer border-white/[0.07] bg-[#111722] shadow-none transition hover:border-primary/40 hover:bg-primary/[0.04]"><CardContent className="flex min-h-24 items-center gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{supplier.name}</p><p className="mt-0.5 truncate text-xs text-slate-400">{supplier.contactName || supplier.phone || supplier.email || "Coordonnées à compléter"}</p><p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><PackageCheck className="h-3.5 w-3.5 text-primary" />{supplies.length} entrée{supplies.length > 1 ? "s" : ""}</p></div><div className="flex shrink-0 items-center gap-1">{canManage && <Button size="icon" variant="ghost" aria-label={`Modifier ${supplier.name}`} onClick={event => { event.stopPropagation(); edit(supplier); }} className="h-8 w-8 text-slate-400 hover:text-primary"><Edit3 className="h-4 w-4" /></Button>}<ArrowUpRight className="h-4 w-4 text-slate-500" /></div></CardContent></Card>; }) : <Card className="col-span-full border-dashed border-white/10 bg-[#111722] shadow-none"><CardContent className="py-16 text-center"><Building2 className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-4 font-medium text-slate-300">Aucun fournisseur enregistré</p><p className="mt-1 text-sm text-slate-500">Ajoutez vos partenaires pour enrichir la traçabilité des entrées en stock.</p></CardContent></Card>}</section><SupplierFormDialog open={formOpen} onOpenChange={value => !value && closeForm()} form={form} setForm={setForm} editing={Boolean(editingId)} pending={createSupplier.isPending || updateSupplier.isPending} submit={submit} /><SupplierDetailDialog supplier={selected} onOpenChange={value => !value && setSelected(null)} movements={movements} onEdit={canManage ? edit : undefined} /></div>;
}

function SupplierFormDialog({ open, onOpenChange, form, setForm, editing, pending, submit }: { open: boolean; onOpenChange: (value: boolean) => void; form: SupplierForm; setForm: (value: SupplierForm) => void; editing: boolean; pending: boolean; submit: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="border-white/10 bg-[#141b27] text-slate-100"><DialogHeader><DialogTitle>{editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><Field label="Nom de l’entreprise *"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Autre référence (alphanumérique)"><Input value={form.otherReference} onChange={event => setForm({ ...form, otherReference: event.target.value.replace(/[^A-Za-z0-9]/g, "") })} placeholder="Ex. FRN2026A" /></Field><Field label="Contact"><Input value={form.contactName} onChange={event => setForm({ ...form, contactName: event.target.value })} /></Field><Field label="E-mail"><Input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field><Field label="Téléphone"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field></div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-300">Annuler</Button><Button onClick={submit} disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90">{editing ? "Enregistrer" : "Créer le fournisseur"}</Button></DialogFooter></DialogContent></Dialog>;
}

function SupplierDetailDialog({ supplier, onOpenChange, movements, onEdit }: { supplier: Supplier | null; onOpenChange: (value: boolean) => void; movements: Array<{ id: number; supplierId: number | null; type: string; productName: string; quantity: number; occurredAt: Date; reason: string }>; onEdit?: (supplier: Supplier) => void }) {
  if (!supplier) return null;
  const supplies = movements.filter(item => item.supplierId === supplier.id && item.type === "entry");
  return <Dialog open={Boolean(supplier)} onOpenChange={onOpenChange}><DialogContent className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#141b27] text-slate-100 sm:max-w-2xl"><DialogHeader><DialogTitle>{supplier.name}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Detail label="Autre référence" value={supplier.otherReference || "Non renseignée"} /><Detail label="Contact" value={supplier.contactName || "Non renseigné"} /><Detail label="E-mail" value={supplier.email || "Non renseigné"} icon={<Mail className="h-4 w-4" />} /><Detail label="Téléphone" value={supplier.phone || "Non renseigné"} icon={<Phone className="h-4 w-4" />} /><Detail label="Entrées enregistrées" value={`${supplies.length} entrée${supplies.length > 1 ? "s" : ""}`} icon={<PackageCheck className="h-4 w-4" />} /></div><div className="mt-2"><p className="text-sm font-semibold">Historique des approvisionnements</p>{supplies.length ? <div className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07]">{supplies.map(movement => <div key={movement.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{movement.productName}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(movement.occurredAt)} · {movement.reason}</p></div><p className="shrink-0 text-sm font-semibold text-emerald-300">{formatSignedQuantity(movement.quantity)}</p></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-sm text-slate-500">Aucune entrée liée à ce fournisseur.</p>}</div><DialogFooter>{onEdit && <Button onClick={() => onEdit(supplier)} className="bg-primary text-primary-foreground hover:bg-primary/90"><Edit3 className="mr-2 h-4 w-4" />Modifier</Button>}</DialogFooter></DialogContent></Dialog>;
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) { return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-slate-500">{icon}{label}</p><p className="mt-1 truncate text-sm text-slate-200">{value}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label className="text-xs font-medium text-slate-300">{label}</Label>{children}</div>; }
