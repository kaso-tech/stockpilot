import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Building2, Edit3, Mail, MapPin, Phone, Plus, Trash2, UsersRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type CustomerForm = { name: string; type: "ordinary" | "wholesale"; contactName: string; email: string; phone: string; address: string };
const emptyCustomer: CustomerForm = { name: "", type: "ordinary", contactName: "", email: "", phone: "", address: "" };

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: customers = [] } = trpc.commerce.customers.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyCustomer);
  const refresh = () => { utils.commerce.customers.list.invalidate(); utils.dashboard.get.invalidate(); };
  const create = trpc.commerce.customers.create.useMutation({ onSuccess: () => { refresh(); toast.success("Client créé."); }, onError: error => toast.error(error.message) });
  const update = trpc.commerce.customers.update.useMutation({ onSuccess: () => { refresh(); toast.success("Client mis à jour."); }, onError: error => toast.error(error.message) });
  const remove = trpc.commerce.customers.remove.useMutation({ onSuccess: () => { refresh(); toast.success("Client supprimé."); }, onError: error => toast.error(error.message) });
  const reset = () => { setEditingId(null); setForm(emptyCustomer); };
  const close = () => { setOpen(false); reset(); };
  const edit = (customer: typeof customers[number]) => { setEditingId(customer.id); setForm({ name: customer.name, type: customer.type, contactName: customer.contactName || "", email: customer.email || "", phone: customer.phone || "", address: customer.address || "" }); setOpen(true); };
  const save = () => {
    if (!form.name.trim()) return toast.error("Le nom du client est requis.");
    const data = { name: form.name.trim(), type: form.type, contactName: form.contactName.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null, address: form.address.trim() || null };
    const done = () => close();
    if (editingId) update.mutate({ id: editingId, ...data }, { onSuccess: done }); else create.mutate(data, { onSuccess: done });
  };

  return <div className="mx-auto max-w-[1300px] space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Ventes</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Clients & tarifs</h1></div>{isAdmin && <Button onClick={() => { reset(); setOpen(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Nouveau client</Button>}</header><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{customers.length ? customers.map(customer => <Card key={customer.id} className="border-white/[0.07] bg-[#111722] shadow-none"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${customer.type === "wholesale" ? "bg-violet-400/10 text-violet-300" : "bg-primary/10 text-primary"}`}>{customer.type === "wholesale" ? <Building2 className="h-5 w-5" /> : <UsersRound className="h-5 w-5" />}</span>{isAdmin && <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Modifier ${customer.name}`} onClick={() => edit(customer)} className="h-8 w-8 text-primary"><Edit3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Supprimer ${customer.name}`} onClick={() => { if (window.confirm(`Supprimer ${customer.name} ? Les clients ayant des factures ne peuvent pas être supprimés.`)) remove.mutate({ id: customer.id }); }} className="h-8 w-8 text-rose-300"><Trash2 className="h-4 w-4" /></Button></div>}</div><div className="mt-4 flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-slate-100">{customer.name}</p><p className="mt-1 truncate text-xs text-slate-500">{customer.contactName || "Contact non renseigné"}</p></div><Badge className={`border-0 ${customer.type === "wholesale" ? "bg-violet-400/10 text-violet-200" : "bg-primary/10 text-primary"}`}>{customer.type === "wholesale" ? "Grossiste" : "Ordinaire"}</Badge></div><div className="mt-5 space-y-2 border-t border-white/[0.07] pt-4 text-xs text-slate-500">{customer.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0" />{customer.email}</p>}{customer.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" />{customer.phone}</p>}{customer.address && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{customer.address}</span></p>}</div></CardContent></Card>) : <Card className="col-span-full border-dashed border-white/10 bg-[#111722]"><CardContent className="py-16 text-center text-slate-500">Aucun client enregistré.</CardContent></Card>}</div><CustomerDialog open={open} onOpenChange={value => !value && close()} form={form} setForm={setForm} editing={Boolean(editingId)} pending={create.isPending || update.isPending} onSave={save} /></div>;
}

function CustomerDialog({ open, onOpenChange, form, setForm, editing, pending, onSave }: { open: boolean; onOpenChange: (value: boolean) => void; form: CustomerForm; setForm: (value: CustomerForm) => void; editing: boolean; pending: boolean; onSave: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#141b27] text-slate-100"><DialogHeader><DialogTitle>{editing ? "Modifier le client" : "Nouveau client"}</DialogTitle></DialogHeader><div className="grid gap-4"><Field label="Nom *"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Type de client"><Select value={form.type} onValueChange={value => setForm({ ...form, type: value as CustomerForm["type"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ordinary">Ordinaire · prix détail</SelectItem><SelectItem value="wholesale">Grossiste · prix gros</SelectItem></SelectContent></Select></Field><Field label="Contact"><Input value={form.contactName} onChange={event => setForm({ ...form, contactName: event.target.value })} /></Field><Field label="E-mail"><Input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field><Field label="Téléphone"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field><Field label="Adresse"><Input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></Field></div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button><Button onClick={onSave} disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90">{editing ? "Enregistrer" : "Créer"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label className="text-xs text-slate-300">{label}</Label>{children}</div>; }
