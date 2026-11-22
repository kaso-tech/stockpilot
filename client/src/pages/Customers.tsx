import { PhoneInput } from "@/components/PhoneInput";
import { EmptyState, PageHeader, Panel } from "@/components/page";
import { StatusPill } from "@/components/StatusPill";
import { can } from "@shared/permissions";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useOffline } from "@/contexts/OfflineContext";
import { ArrowUpRight, Building2, ChevronRight, Edit3, Mail, MapPin, Phone, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type CustomerForm = { name: string; type: "ordinary" | "wholesale"; email: string; phone: string; address: string; taxNumber: string; notes: string };
const emptyCustomer: CustomerForm = { name: "", type: "ordinary", email: "", phone: "", address: "", taxNumber: "", notes: "" };

export default function Customers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const canManage = can(user?.role, "customers.manage");
  const utils = trpc.useUtils();
  const { data: customers = [] } = trpc.commerce.customers.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyCustomer);
  const [deleteTarget, setDeleteTarget] = useState<typeof customers[number] | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "ordinary" | "wholesale">("all");
  const refresh = () => { utils.commerce.customers.list.invalidate(); utils.dashboard.get.invalidate(); };
  const { isOnline, queueCustomer } = useOffline();
  const create = trpc.commerce.customers.create.useMutation({ onSuccess: () => { refresh(); toast.success("Client créé."); close(); }, onError: error => toast.error(error.message) });
  const update = trpc.commerce.customers.update.useMutation({ onSuccess: () => { refresh(); toast.success("Client mis à jour."); close(); }, onError: error => toast.error(error.message) });
  const remove = trpc.commerce.customers.remove.useMutation({ onSuccess: () => { refresh(); setDeleteTarget(null); toast.success("Client supprimé."); }, onError: error => toast.error(error.message) });
  const reset = () => { setEditingId(null); setForm(emptyCustomer); };
  const close = () => { setOpen(false); reset(); };
  useEffect(() => { if (new URLSearchParams(window.location.search).get("nouveau") === "1") { reset(); setOpen(true); window.history.replaceState({}, "", "/clients"); } }, []);
  const edit = (customer: typeof customers[number]) => { setEditingId(customer.id); setForm({ name: customer.name, type: customer.type, email: customer.email || "", phone: customer.phone || "", address: customer.address || "", taxNumber: customer.taxNumber || "", notes: customer.notes || "" }); setOpen(true); };
  const save = () => { if (!form.name.trim()) return toast.error("Le nom du client est requis."); const data = { name: form.name.trim(), otherReference: null, type: form.type, email: form.email.trim() || null, phone: form.phone.trim() || null, address: form.address.trim() || null, taxNumber: form.taxNumber.trim() || null, notes: form.notes.trim() || null }; if (!isOnline) {
      if (editingId) return toast.error("La modification d’un client demande une connexion.");
      // Hors connexion : client gardé sur l'appareil, utilisable aussitôt dans une facture.
      try {
        const tempId = queueCustomer(data);
        utils.commerce.customers.list.setData(undefined, current => [...(current ?? []), { ...data, id: tempId, companyId: null, createdAt: new Date(), updatedAt: new Date(), offlinePending: true } as any]);
        toast.success("Client enregistré hors connexion ; il sera envoyé au retour du réseau.");
        close();
      } catch (error) { toast.error(error instanceof Error ? error.message : "Enregistrement impossible."); }
      return;
    }
    if (editingId) update.mutate({ id: editingId, ...data }); else create.mutate(data); };
  const visible = useMemo(() => customers.filter(customer => { const needle = search.toLowerCase().trim(); const searchable = [customer.name, customer.email, customer.phone, customer.taxNumber, customer.address].filter(Boolean).join(" ").toLowerCase(); return (!needle || searchable.includes(needle)) && (typeFilter === "all" || customer.type === typeFilter); }).sort((a, b) => a.name.localeCompare(b.name)), [customers, search, typeFilter]);

  return <div className="mx-auto max-w-[1440px] space-y-6">
    <PageHeader title="Clients" description={`${visible.length} client${visible.length > 1 ? "s" : ""}${typeFilter !== "all" || search ? " correspondant aux critères" : ""}`} actions={canManage ? <Button onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4" />Nouveau client</Button> : undefined} />
    <Panel>
      <div className="grid gap-2 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_200px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-faint" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un nom, un téléphone ou un numéro fiscal" className="pl-9" /></div><Select value={typeFilter} onValueChange={value => setTypeFilter(value as typeof typeFilter)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les types</SelectItem><SelectItem value="ordinary">Détail</SelectItem><SelectItem value="wholesale">Grossistes</SelectItem></SelectContent></Select></div>
      {visible.length ? <div className="divide-y divide-border">{visible.map(customer => <div key={customer.id} role="button" tabIndex={0} onClick={() => customer.id < 0 ? toast.info("Ce client sera consultable une fois envoyé au serveur.") : setLocation(`/clients/${customer.id}`)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLocation(`/clients/${customer.id}`); } }} className="group flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-accent/60 focus:outline-none focus-visible:bg-accent sm:px-5">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${customer.type === "wholesale" ? "bg-info-soft text-info" : "bg-primary-soft text-primary"}`}>{customer.type === "wholesale" ? <Building2 className="h-5 w-5" /> : <UsersRound className="h-5 w-5" />}</span>
        <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)] sm:items-center sm:gap-4"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{customer.name}</p><StatusPill tone={customer.type === "wholesale" ? "info" : "neutral"}>{customer.type === "wholesale" ? "Grossiste" : "Détail"}</StatusPill>{customer.id < 0 && <StatusPill tone="warning">En attente d’envoi</StatusPill>}</div><p className="mt-0.5 truncate text-xs text-muted-foreground sm:mt-0 sm:text-[13px]">{customer.phone || customer.email || customer.address || "Coordonnées à compléter"}</p><p className="hidden truncate text-[13px] text-faint sm:block">{customer.taxNumber ? `N° fiscal ${customer.taxNumber}` : "—"}</p></div>
        {canManage && <div className="hidden shrink-0 items-center gap-0.5 sm:flex"><Button size="icon-sm" variant="ghost" aria-label={`Modifier ${customer.name}`} onClick={event => { event.stopPropagation(); edit(customer); }} className="text-muted-foreground hover:text-primary"><Edit3 className="h-4 w-4" /></Button><Button size="icon-sm" variant="ghost" aria-label={`Supprimer ${customer.name}`} onClick={event => { event.stopPropagation(); setDeleteTarget(customer); }} className="text-destructive hover:bg-destructive-soft hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></div>}
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </div>)}</div> : <EmptyState icon={UsersRound} title={customers.length ? "Aucun client ne correspond à ces critères" : "Aucun client pour le moment"} detail={customers.length ? "Modifiez la recherche ou le filtre." : "Ajoutez vos clients pour les facturer et suivre leurs soldes."} />}
    </Panel>
    <CustomerDialog open={open} onOpenChange={value => !value && close()} form={form} setForm={setForm} editing={Boolean(editingId)} pending={create.isPending || update.isPending} onSave={save} />
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={value => !value && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible. Les clients ayant déjà des factures ne peuvent pas être supprimés afin de préserver l’historique.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteTarget && remove.mutate({ id: deleteTarget.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function CustomerDialog({ open, onOpenChange, form, setForm, editing, pending, onSave }: { open: boolean; onOpenChange: (value: boolean) => void; form: CustomerForm; setForm: (value: CustomerForm) => void; editing: boolean; pending: boolean; onSave: () => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-popover text-foreground"><DialogHeader><DialogTitle>{editing ? "Modifier le client" : "Nouveau client"}</DialogTitle></DialogHeader><div className="grid gap-4"><Field label="Nom *"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="Type"><Select value={form.type} onValueChange={value => setForm({ ...form, type: value as CustomerForm["type"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ordinary">Ordinaire · prix détail</SelectItem><SelectItem value="wholesale">Grossiste · prix gros</SelectItem></SelectContent></Select></Field><Field label="Adresse"><Input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field><Field label="Téléphone"><PhoneInput value={form.phone} onChange={phone => setForm({ ...form, phone })} /></Field><Field label="Numéro fiscal"><Input value={form.taxNumber} onChange={event => setForm({ ...form, taxNumber: event.target.value })} /></Field><Field label="Notes"><Textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Informations complémentaires" /></Field></div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button><Button onClick={onSave} disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90">{editing ? "Enregistrer" : "Créer"}</Button></DialogFooter></DialogContent></Dialog>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-2"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>; }
