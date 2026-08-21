import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Restricted } from "./AuditLog";
import { ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";

export default function UserManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery(undefined, { enabled: isAdmin });
  const updateRole = trpc.users.updateRole.useMutation({ onSuccess: () => { utils.users.list.invalidate(); toast.success("Rôle utilisateur mis à jour."); } });
  if (!isAdmin) return <Restricted title="Gestion des accès" description="Seuls les administrateurs peuvent modifier les accès de l’organisation." />;

  return <div className="mx-auto max-w-[1300px] space-y-6">
    <header><p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-300">Organisation</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Utilisateurs authentifiés</h1><p className="mt-1.5 text-sm text-slate-400">Les administrateurs pilotent l’espace ; les vendeurs accèdent aux ventes et aux factures.</p></header>
    <section className="grid gap-4 sm:grid-cols-2"><RoleCard icon={ShieldCheck} title="Administrateur" detail="Accès complet aux paramètres, stocks, ventes, agents et rémunérations." color="cyan" /><RoleCard icon={Store} title="Vendeur" detail="Accès au point de vente, aux factures et à ses propres commissions." color="violet" /></section>
    <Card className="border-white/[0.07] bg-[#111722] shadow-none"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-white/[0.018] text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500"><tr><th className="px-6 py-3">Utilisateur</th><th className="px-4 py-3">Accès</th><th className="px-4 py-3">Dernière connexion</th><th className="px-6 py-3 text-right">Modifier</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{isLoading ? <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">Chargement des utilisateurs…</td></tr> : users.map(member => <tr key={member.id} className="text-sm hover:bg-white/[0.018]"><td className="px-6 py-4"><p className="font-medium text-slate-200">{member.name || "Utilisateur sans nom"}</p><p className="mt-0.5 text-xs text-slate-500">{member.email || "Adresse non renseignée"}</p></td><td className="px-4 py-4"><Badge className={`border-0 ${member.role === "admin" ? "bg-cyan-400/10 text-cyan-300" : "bg-violet-400/10 text-violet-300"}`}>{member.role === "admin" ? "Administrateur" : "Vendeur"}</Badge></td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(member.lastSignedIn, true)}</td><td className="px-6 py-4 text-right"><Select value={member.role} disabled={member.id === user?.id || updateRole.isPending} onValueChange={role => updateRole.mutate({ id: member.id, role: role as "admin" | "seller" }, { onError: error => toast.error(error.message) })}><SelectTrigger className="ml-auto h-8 w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Administrateur</SelectItem><SelectItem value="seller">Vendeur</SelectItem></SelectContent></Select></td></tr>)}</tbody></table></div></CardContent></Card>
  </div>;
}

function RoleCard({ icon: Icon, title, detail, color }: { icon: typeof ShieldCheck; title: string; detail: string; color: "cyan" | "violet" }) { return <Card className="border-white/[0.07] bg-[#111722] shadow-none"><CardContent className="flex gap-4 p-5"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color === "cyan" ? "bg-cyan-400/10 text-cyan-300" : "bg-violet-400/10 text-violet-300"}`}><Icon className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-slate-200">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div></CardContent></Card>; }
