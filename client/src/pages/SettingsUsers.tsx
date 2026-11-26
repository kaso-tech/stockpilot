import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, permissionsOf, type Role } from "@shared/permissions";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsUsers() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const allowed = can("users.manage");
  const { data: members = [], isLoading, error } = trpc.users.list.useQuery(undefined, { enabled: allowed });
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: result => {
      void utils.users.list.invalidate();
      if (result.changed) toast.success("Rôle mis à jour ; les sessions existantes ont été révoquées.");
    },
    onError: mutationError => toast.error(mutationError.message),
  });
  if (!allowed) return <Restricted title="Utilisateurs et rôles" description="L’attribution des rôles est réservée aux administrateurs de l’entreprise." />;
  const permissions = Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[];
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><h1 className="text-[22px] font-bold tracking-tight text-foreground">Utilisateurs et rôles</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Attribuez un rôle métier à chaque compte de cette entreprise. Les droits plateforme, les affectations par entrepôt et les autorisations vendeur restent gérés séparément.</p></header>
    <Card className="border-border bg-card gap-0 py-0"><CardContent className="divide-y divide-border p-0">
      {isLoading ? <p className="p-6 text-sm text-muted-foreground" role="status">Chargement des comptes…</p> : error ? <p className="p-6 text-sm text-destructive" role="alert">Impossible de charger les comptes. Réessayez plus tard.</p> : members.length ? members.map(member => <div key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="truncate font-medium text-foreground">{member.name || member.email || `Utilisateur ${member.id}`}</p><p className="mt-1 text-xs text-muted-foreground">{member.email || "Aucune adresse e-mail"} · dernière connexion {formatDate(member.lastSignedIn, true)}</p></div>
        <label className="flex min-w-0 items-center gap-3 text-sm"><span className="shrink-0 text-muted-foreground">Rôle</span><select aria-label={`Rôle de ${member.name || member.email || `l’utilisateur ${member.id}`}`} value={member.role} disabled={updateRole.isPending || member.id === user?.id} onChange={event => updateRole.mutate({ id: member.id, role: event.target.value as Role })} className="h-10 min-w-[180px] rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{ROLES.filter(role => role !== "agent" || member.role === "agent").map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>{member.id === user?.id && <span className="text-xs text-muted-foreground">Compte courant protégé</span>}</label>
      </div>) : <p className="p-6 text-sm text-muted-foreground">Aucun compte utilisateur trouvé.</p>}
    </CardContent></Card>
    <Card className="border-border bg-card gap-0 py-0"><CardContent className="overflow-x-auto p-4 sm:p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary"/><div><h2 className="font-semibold text-foreground">Droits par rôle</h2><p className="mt-1 text-sm text-muted-foreground">Les permissions sont également vérifiées côté serveur.</p></div></div><table className="mt-4 w-full min-w-[700px] text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="py-2 pr-3 font-medium">Droit</th>{ROLES.map(role => <th scope="col" key={role} className="px-2 py-2 text-center font-medium" title={ROLE_DESCRIPTIONS[role]}>{ROLE_LABELS[role]}</th>)}</tr></thead><tbody>{permissions.map(permission => <tr key={permission} className="border-t border-border"><th scope="row" className="py-2 pr-3 text-left font-normal text-foreground">{PERMISSION_LABELS[permission]}</th>{ROLES.map(role => <td key={role} className="px-2 py-2 text-center" aria-label={`${ROLE_LABELS[role]} : ${permissionsOf(role).includes(permission) ? "autorisé" : "non autorisé"}`}>{permissionsOf(role).includes(permission) ? <span className="font-semibold text-primary">Oui</span> : <span className="text-muted-foreground">—</span>}</td>)}</tr>)}</tbody></table><p className="mt-4 text-xs text-muted-foreground">Les rôles ne remplacent pas les restrictions de prix, remises, remboursements, TVA ou entrepôt attribué au vendeur.</p></CardContent></Card>
  </div>;
}
