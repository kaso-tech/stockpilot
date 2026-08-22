import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Banknote, BriefcaseBusiness, ChevronRight, Plus, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Restricted } from "./AuditLog";

type AgentKind = "seller" | "sales_agent" | "cashier";
export type Beneficiary = { type: "user" | "agent"; id: number; name: string; role: string; kind: AgentKind; username?: string | null; email?: string | null; phone?: string | null };
export type AgentForm = { name: string; type: AgentKind; email: string; phone: string; username: string; password: string; remunerationMode: "fixed" | "commission" | "fixed_plus_commission"; fixed: string; basis: "revenue" | "net_profit"; rate: string };

export const blankAgentForm: AgentForm = { name: "", type: "seller", email: "", phone: "", username: "", password: "", remunerationMode: "commission", fixed: "0", basis: "revenue", rate: "0" };
const remunerationPayload = (form: AgentForm) => ({ remunerationMode: form.remunerationMode, fixedMonthlyCents: form.remunerationMode === "commission" ? 0 : Math.round(Number(form.fixed || 0) * 100), commissionBasis: form.basis, rateBasisPoints: form.remunerationMode === "fixed" ? 0 : Math.round(Number(form.rate || 0) * 100), active: true });

export default function Agents() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: payroll } = trpc.payroll.overview.useQuery(undefined, { enabled: isAdmin });
  const { data: sellers = [] } = trpc.commerce.sellers.list.useQuery(undefined, { enabled: isAdmin });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [form, setForm] = useState<AgentForm>(blankAgentForm);
  const refresh = () => { utils.payroll.overview.invalidate(); utils.commerce.agents.list.invalidate(); utils.commerce.sellers.list.invalidate(); };
  const closeForm = () => { setOpen(false); setEditing(null); setForm(blankAgentForm); };
  const createAgent = trpc.commerce.agents.create.useMutation({ onSuccess: () => { refresh(); closeForm(); toast.success("Agent créé avec sa rémunération."); }, onError: error => toast.error(error.message) });
  const updateAgent = trpc.commerce.agents.update.useMutation({ onSuccess: () => { refresh(); closeForm(); toast.success("Agent modifié."); }, onError: error => toast.error(error.message) });
  const createSeller = trpc.commerce.sellers.create.useMutation({ onSuccess: () => { refresh(); closeForm(); toast.success("Vendeur et accès créés."); }, onError: error => toast.error(error.message) });
  const updateSeller = trpc.commerce.sellers.update.useMutation({ onSuccess: () => { refresh(); closeForm(); toast.success("Vendeur modifié."); }, onError: error => toast.error(error.message) });
  const convertToSeller = trpc.commerce.agents.convertToSeller.useMutation({ onSuccess: () => { refresh(); closeForm(); toast.success("Agent converti en vendeur."); }, onError: error => toast.error(error.message) });
  const convertSellerToAgent = trpc.commerce.agents.convertSellerToAgent.useMutation({ onSuccess: () => { refresh(); closeForm(); toast.success("Vendeur converti en agent."); }, onError: error => toast.error(error.message) });

  if (!isAdmin) return <Restricted title="Agents & rémunérations" description="La gestion des agents et paiements est réservée aux administrateurs." />;

  const profileFor = (beneficiary: Beneficiary) => payroll?.profiles.find(item => item.beneficiaryType === beneficiary.type && item.beneficiaryId === beneficiary.id);
  const balanceFor = (beneficiary: Beneficiary) => payroll?.balances.find(item => item.beneficiaryType === beneficiary.type && item.beneficiaryId === beneficiary.id);
  const beneficiaries: Beneficiary[] = [
    ...sellers.filter(item => item.active).map(item => ({ type: "user" as const, id: item.id, name: item.name || "Vendeur", role: "Vendeur", kind: "seller" as const, username: item.username, email: item.email, phone: item.phone })),
    ...(payroll?.agents ?? []).filter(item => item.active).map(item => ({ type: "agent" as const, id: item.id, name: item.name, role: item.type === "cashier" ? "Caissier" : "Agent commercial", kind: item.type, email: item.email, phone: item.phone })),
  ];
  const edit = (beneficiary: Beneficiary) => {
    const profile = profileFor(beneficiary);
    setEditing(beneficiary);
    setForm({ name: beneficiary.name, type: beneficiary.kind, email: beneficiary.email || "", phone: beneficiary.phone || "", username: beneficiary.username || "", password: "", remunerationMode: profile?.remunerationMode ?? "commission", fixed: String((profile?.fixedMonthlyCents ?? 0) / 100), basis: profile?.commissionBasis ?? "revenue", rate: String((profile?.rateBasisPoints ?? 0) / 100) });
    setOpen(true);
  };
  const submit = () => {
    if (!form.name.trim()) return toast.error("Le nom est requis.");
    const remuneration = remunerationPayload(form);
    if (editing && editing.kind !== form.type) {
      if (form.type === "seller") {
        if (!form.username.trim() || form.password.length < 8) return toast.error("Un identifiant et un mot de passe de 8 caractères sont requis pour convertir en vendeur.");
        return convertToSeller.mutate({ id: editing.id, username: form.username.trim(), password: form.password, remuneration });
      }
      if (editing.kind === "seller") return convertSellerToAgent.mutate({ id: editing.id, type: form.type, phone: form.phone.trim() || null, remuneration });
    }
    if (form.type === "seller") {
      if (!form.username.trim() || (!editing && form.password.length < 8)) return toast.error("Le nom d’utilisateur et un mot de passe de 8 caractères sont requis.");
      const payload = { name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, username: form.username.trim(), remuneration };
      return editing ? updateSeller.mutate({ id: editing.id, ...payload, ...(form.password ? { password: form.password } : {}) }) : createSeller.mutate({ ...payload, password: form.password });
    }
    const payload = { name: form.name.trim(), type: form.type, email: form.email.trim() || null, phone: form.phone.trim() || null, active: true, remuneration };
    return editing ? updateAgent.mutate({ id: editing.id, ...payload }) : createAgent.mutate(payload);
  };

  const totalDue = (payroll?.balances ?? []).reduce((sum, item) => sum + Math.max(0, item.dueCents), 0);
  return <div className="mx-auto max-w-[1320px] space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Ressources humaines</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Agents & rémunérations</h1></div><Button onClick={() => { setEditing(null); setForm(blankAgentForm); setOpen(true); }} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Plus className="mr-2 h-4 w-4" />Nouvel agent</Button></header>
    <section className="grid gap-4 sm:grid-cols-3"><Metric label="Solde total dû" value={formatCurrency(totalDue)} icon={Banknote} /><Metric label="Bénéficiaires actifs" value={beneficiaries.length} icon={UserRoundCheck} /><Metric label="Paiements période" value={formatCurrency((payroll?.balances ?? []).reduce((sum, item) => sum + item.paidCents, 0))} icon={BriefcaseBusiness} /></section>
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{beneficiaries.map(beneficiary => { const balance = balanceFor(beneficiary); return <button key={`${beneficiary.type}-${beneficiary.id}`} type="button" onClick={() => setLocation(`/agents/${beneficiary.type}/${beneficiary.id}`)} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#111722] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400/35 hover:bg-[#141e2d]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-sm font-semibold text-cyan-300">{beneficiary.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate font-semibold text-slate-100">{beneficiary.name}</span><Badge className="shrink-0 border-0 bg-white/[0.06] text-[10px] text-slate-400">{beneficiary.role}</Badge></span><span className="mt-1 flex items-center justify-between gap-2 text-xs"><span className="truncate text-slate-500">{beneficiary.email || beneficiary.phone || "Coordonnées non renseignées"}</span><span className="shrink-0 font-medium text-amber-300">{formatCurrency(Math.max(0, balance?.dueCents ?? 0))}</span></span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-cyan-300" /></button>; })}</section>
    {!beneficiaries.length && <Card className="border-dashed border-white/10 bg-[#111722]"><CardContent className="py-12 text-center text-sm text-slate-500">Aucun agent actif.</CardContent></Card>}
    <AgentDialog open={open} editing={editing} form={form} setForm={setForm} onClose={closeForm} onSubmit={submit} pending={createAgent.isPending || updateAgent.isPending || createSeller.isPending || updateSeller.isPending || convertToSeller.isPending || convertSellerToAgent.isPending} />
  </div>;
}

export function AgentDialog({ open, editing, form, setForm, onClose, onSubmit, pending }: { open: boolean; editing: Beneficiary | null; form: AgentForm; setForm: (form: AgentForm) => void; onClose: () => void; onSubmit: () => void; pending: boolean }) {
  const seller = form.type === "seller"; const commission = form.remunerationMode !== "fixed"; const fixed = form.remunerationMode !== "commission"; const typeChanged = Boolean(editing && editing.kind !== form.type);
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#141b27] text-slate-100"><DialogHeader><DialogTitle>{editing ? "Modifier l’agent" : "Créer un agent"}</DialogTitle></DialogHeader><div className="grid gap-4"><Field label="Type"><Select value={form.type} onValueChange={value => setForm({ ...form, type: value as AgentKind, password: value === "seller" ? form.password : "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="seller">Vendeur</SelectItem><SelectItem value="sales_agent">Agent commercial</SelectItem><SelectItem value="cashier">Caissier</SelectItem></SelectContent></Select></Field>{typeChanged && <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">Le changement de type préserve l’historique et crée un nouveau profil actif.</p>}<Field label="Nom complet *"><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field><Field label="E-mail"><Input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></Field><Field label="Téléphone"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field>{seller && <><Field label="Nom d’utilisateur *"><Input value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></Field><Field label={typeChanged || !editing ? "Mot de passe *" : "Nouveau mot de passe (facultatif)"}><Input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></Field></>}<div className="space-y-4 rounded-xl border border-white/[0.08] p-4"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-cyan-300">Rémunération</p><Field label="Système"><Select value={form.remunerationMode} onValueChange={value => setForm({ ...form, remunerationMode: value as AgentForm["remunerationMode"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Salaire fixe</SelectItem><SelectItem value="commission">Commission</SelectItem><SelectItem value="fixed_plus_commission">Fixe + commission</SelectItem></SelectContent></Select></Field>{fixed && <Field label="Salaire fixe mensuel"><Input type="number" min="0" step="0.01" value={form.fixed} onChange={event => setForm({ ...form, fixed: event.target.value })} /></Field>}{commission && <><Field label="Base de commission"><Select value={form.basis} onValueChange={value => setForm({ ...form, basis: value as AgentForm["basis"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="revenue">Chiffre d’affaires</SelectItem><SelectItem value="net_profit">Bénéfice net</SelectItem></SelectContent></Select></Field><Field label="Taux de commission (%)"><Input type="number" min="0" max="100" step="0.01" value={form.rate} onChange={event => setForm({ ...form, rate: event.target.value })} /></Field></>}</div></div><DialogFooter><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={onSubmit} disabled={pending} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{editing ? "Enregistrer" : "Créer l’agent"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Banknote }) { return <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-white">{value}</p></div><Icon className="h-5 w-5 text-cyan-300" /></CardContent></Card>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-xs text-slate-300">{label}</Label>{children}</div>; }
