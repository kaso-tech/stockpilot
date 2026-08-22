import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, Building2, PackageCheck, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type SupplierForm = { name: string; address: string; email: string; phone: string; taxNumber: string; notes: string };
const emptySupplier: SupplierForm = { name: "", address: "", email: "", phone: "", taxNumber: "", notes: "" };

export default function Suppliers() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: movements = [] } = trpc.movements.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptySupplier);
  const createSupplier = trpc.suppliers.create.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Fournisseur créé."); } });
  const updateSupplier = trpc.suppliers.update.useMutation({ onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Fournisseur mis à jour."); } });
  const closeForm = () => { setFormOpen(false); setEditingId(null); setForm(emptySupplier); };
  const submit = () => {
    if (!form.name.trim()) return toast.error("Le nom du fournisseur est requis.");
    const payload = { name: form.name.trim(), otherReference: null, address: form.address.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null, taxNumber: form.taxNumber.trim() || null, notes: form.notes.trim() || null };
    const done = () => closeForm();
    if (editingId) updateSupplier.mutate({ id: editingId, ...payload }, { onSuccess: done, onError: error => toast.error(error.message) });
    else createSupplier.mutate(payload, { onSuccess: done, onError: error => toast.error(error.message) });
  };
  return <div className="mx-auto max-w-[1500px] space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Approvisionnement</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Fournisseurs</h1></div>{canManage && <Button onClick={() => { setEditingId(null); setForm(emptySupplier); setFormOpen(true); }} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nouveau fournisseur</Button>}</header><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{suppliers.length ? suppliers.map(supplier => { const supplies = movements.filter(item => item.supplierId === supplier.id && item.type === "entry"); return <Card key={supplier.id} role="button" tabIndex={0} onClick={() => setLocation(`/fournisseurs/${supplier.id}`)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLocation(`/fournisseurs/${supplier.id}`); } }} className="cursor-pointer border-white/[0.07] bg-[#111722] shadow-none transition hover:border-primary/40 hover:bg-primary/[0.04]"><CardContent className="flex min-h-24 items-center gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{supplier.name}</p><p className="mt-0.5 truncate text-xs text-slate-400">{supplier.address || supplier.phone || supplier.email || "Coordonnées à compléter"}</p><p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><PackageCheck className="h-3.5 w-3.5 text-primary" />{supplies.length} entrée{supplies.length > 1 ? "s" : ""}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" /></CardContent></Card>; }) : <Card className="col-span-full border-dashed border-white/10 bg-[#111722] shadow-none"><CardContent className="py-16 text-center"><Building2 className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-4 font-medium text-slate-300">Aucun fournisseur enregistré</p></CardContent></Card>}</section><SupplierFormDialog open={formOpen} onOpenChange={value => !value && closeForm()} form={form} setForm={setForm} editing={Boolean(editingId)} pending={createSupplier.isPending || updateSupplier.isPending} submit={submit} /></div>;
}

function SupplierFormDialog({ open, onOpenChange, form, setForm, editing, pending, submit }: { open: boolean; onOpenChange: (value: boolean) => void; form: SupplierForm; setForm: (value: SupplierForm) => void; editing: boolean; pending: boolean; submit: () => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#141b27] text-slate-100"><DialogHeader><DialogTitle>{editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><Field label="Nom *"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Adresse"><Input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field><Field label="Téléphone"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field><Field label="Numéro fiscal"><Input value={form.taxNumber} onChange={event => setForm({ ...form, taxNumber: event.target.value })} /></Field><Field label="Notes"><Textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Informations complémentaires" /></Field></div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-300">Annuler</Button><Button onClick={submit} disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90">{editing ? "Enregistrer" : "Créer le fournisseur"}</Button></DialogFooter></DialogContent></Dialog>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label className="text-xs font-medium text-slate-300">{label}</Label>{children}</div>; }
