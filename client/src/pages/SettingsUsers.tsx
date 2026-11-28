import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, permissionsOf, type Role } from "@shared/permissions";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";
import { CustomRolesCard } from "@/components/CustomRolesCard";

export default function SettingsUsers() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const allowed = can("users.manage");
  const { data: members = [], isLoading, error } = trpc.users.list.useQuery(undefined, { enabled: allowed });
  const { data: customRoles = [] } = trpc.customRoles.list.useQuery(undefined, { enabled: allowed && user?.role === "admin" });
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: result => {
      void utils.users.list.invalidate();
      if (result.changed) toast.success("Rôle mis à jour ; les sessions existantes ont été révoquées.");
    },
    onError: mutationError => toast.error(mutationError.message),
  });
  const reactivate = trpc.users.reactivate.useMutation({ onSuccess: () => { void utils.users.list.invalidate(); void utils.commerce.invalidate(); toast.success("Compte réactivé : il réapparaît dans Équipe et paie."); }, onError: mutationError => toast.error(mutationError.message) });
  const [showInactive, setShowInactive] = useState(false);
  const activeMembers = members.filter(member => member.active !== false);
  const inactiveMembers = members.filter(member => member.active === false);
  const depotLabels: Record<string, string> = { manager: "Gérant de dépôt", cashier: "Caissier de dépôt", seller: "Vendeur" };
  const ficheLabel = (member: (typeof members)[number]) => member.fiche ? (member.fiche.type === "sales_agent" ? "Agent commercial" : member.fiche.type === "cashier" ? "Caissier" : member.fiche.jobTitle || "Autre fonction") : null;
  const describe = (member: (typeof members)[number]) => {
    const parts: string[] = [];
    if (member.role === "seller") parts.push(member.depotRoles.length ? member.depotRoles.map(depot => `${depotLabels[depot.role] ?? depot.role} · ${depot.warehouseName}`).join(" ; ") : "Vendeur sans entrepôt affecté");
    else if (member.role !== "admin") parts.push(ficheLabel(member) ? `Équipe : ${ficheLabel(member)}` : "Absent d’Équipe et paie");
    return parts.join(" · ");
  };
  if (!allowed) return <Restricted title="Utilisateurs et rôles" description="L’attribution des rôles est réservée aux administrateurs de l’entreprise." />;
  const permissions = Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[];
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><h1 className="text-[22px] font-bold tracking-tight text-foreground">Utilisateurs et rôles</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Attribuez un rôle métier à chaque compte de cette entreprise. Les droits plateforme, les affectations par entrepôt et les autorisations vendeur restent gérés séparément.</p></header>
    <Card className="border-border bg-card gap-0 py-0"><CardContent className="divide-y divide-border p-0">
      {isLoading ? <p className="p-6 text-sm text-muted-foreground" role="status">Chargement des comptes…</p> : error ? <p className="p-6 text-sm text-destructive" role="alert">Impossible de charger les comptes. Réessayez plus tard.</p> : activeMembers.length ? activeMembers.map(member => <div key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="truncate font-medium text-foreground">{member.name || member.email || `Utilisateur ${member.id}`}</p><p className="mt-1 text-xs text-muted-foreground">{member.email || "Aucune adresse e-mail"} · dernière connexion {formatDate(member.lastSignedIn, true)}</p>{describe(member) && <p className={`mt-1 text-xs ${describe(member).startsWith("Absent") || describe(member).includes("sans entrepôt") ? "text-warning" : "text-primary"}`}>{describe(member)}</p>}</div>
        <label className="flex min-w-0 items-center gap-3 text-sm"><span className="shrink-0 text-muted-foreground">Rôle</span><select aria-label={`Rôle de ${member.name || member.email || `l’utilisateur ${member.id}`}`} value={member.role === "custom" ? `custom:${member.customRoleId}` : member.role} disabled={updateRole.isPending || member.id === user?.id} onChange={event => { const value = event.target.value; if (value.startsWith("custom:")) updateRole.mutate({ id: member.id, role: "custom", customRoleId: Number(value.slice(7)) }); else updateRole.mutate({ id: member.id, role: value as Role }); }} className="h-10 min-w-[180px] rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{ROLES.filter(role => role !== "custom" && (!["agent", "cashier"].includes(role) || member.role === role)).map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}{customRoles.length > 0 && <optgroup label="Rôles personnalisés">{customRoles.map(role => <option key={role.id} value={`custom:${role.id}`}>{role.name}</option>)}</optgroup>}</select>{member.id === user?.id && <span className="text-xs text-muted-foreground">Compte courant protégé</span>}</label>
      </div>) : <p className="p-6 text-sm text-muted-foreground">Aucun compte utilisateur trouvé.</p>}
    </CardContent></Card>
    {inactiveMembers.length > 0 && <Card className="border-border bg-card gap-0 py-0"><CardContent className="p-0"><button type="button" onClick={() => setShowInactive(value => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-left"><span><span className="font-semibold text-foreground">Comptes désactivés ({inactiveMembers.length})</span><span className="mt-1 block text-xs text-muted-foreground">Ils ne peuvent plus se connecter et n’apparaissent pas dans Équipe et paie (anciens membres, comptes convertis).</span></span><span className="text-sm text-primary">{showInactive ? "Masquer" : "Afficher"}</span></button>{showInactive && <div className="divide-y divide-border border-t border-border">{inactiveMembers.map(member => <div key={member.id} className="flex flex-col gap-3 p-4 opacity-80 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-medium text-foreground">{member.name || member.email || `Utilisateur ${member.id}`} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Désactivé</span></p><p className="mt-1 text-xs text-muted-foreground">Dernier rôle : {member.role === "custom" ? (customRoles.find(role => role.id === member.customRoleId)?.name ?? "Rôle personnalisé") : ROLE_LABELS[member.role as Role]} · dernière connexion {formatDate(member.lastSignedIn, true)}</p></div>{user?.role === "admin" && <Button size="sm" variant="outline" disabled={reactivate.isPending} onClick={() => reactivate.mutate({ id: member.id })}>Réactiver</Button>}</div>)}</div>}</CardContent></Card>}
    {user?.role === "admin" && <CustomRolesCard />}
    <Card className="border-border bg-card gap-0 py-0"><CardContent className="overflow-x-auto p-4 sm:p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary"/><div><h2 className="font-semibold text-foreground">Droits par rôle</h2><p className="mt-1 text-sm text-muted-foreground">Les permissions sont également vérifiées côté serveur.</p></div></div><table className="mt-4 w-full min-w-[700px] text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="py-2 pr-3 font-medium">Droit</th>{ROLES.filter(role => role !== "custom").map(role => <th scope="col" key={role} className="px-2 py-2 text-center font-medium" title={ROLE_DESCRIPTIONS[role]}>{ROLE_LABELS[role]}</th>)}{customRoles.map(role => <th scope="col" key={`c${role.id}`} className="px-2 py-2 text-center font-medium text-primary" title={role.description ?? "Rôle personnalisé"}>{role.name}</th>)}</tr></thead><tbody>{permissions.map(permission => <tr key={permission} className="border-t border-border"><th scope="row" className="py-2 pr-3 text-left font-normal text-foreground">{PERMISSION_LABELS[permission]}</th>{ROLES.filter(role => role !== "custom").map(role => <td key={role} className="px-2 py-2 text-center" aria-label={`${ROLE_LABELS[role]} : ${permissionsOf(role).includes(permission) ? "autorisé" : "non autorisé"}`}>{permissionsOf(role).includes(permission) ? <span className="font-semibold text-primary">Oui</span> : <span className="text-muted-foreground">—</span>}</td>)}{customRoles.map(role => <td key={`c${role.id}`} className="px-2 py-2 text-center" aria-label={`${role.name} : ${role.permissions.includes(permission) ? "autorisé" : "non autorisé"}`}>{role.permissions.includes(permission) ? <span className="font-semibold text-primary">✓</span> : <span className="text-faint">—</span>}</td>)}</tr>)}</tbody></table><p className="mt-4 text-xs text-muted-foreground">Les rôles ne remplacent pas les restrictions de prix, remises, remboursements, TVA ou entrepôt attribué au vendeur.</p></CardContent></Card>
  </div>;
}
