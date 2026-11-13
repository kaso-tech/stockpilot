import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  PERMISSION_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  permissionsOf,
  type Permission,
  type Role,
} from "@shared/permissions";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

/** Attribution des rôles (9.3) et rappel de la matrice des droits. */
export default function SettingsUsers() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const allowed = can("users.manage");
  const { data: members = [], isLoading } = trpc.users.list.useQuery(
    undefined,
    { enabled: allowed }
  );
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success(
        "Rôle mis à jour. Les sessions de cet utilisateur ont été fermées."
      );
    },
    onError: error => toast.error(error.message),
  });
  if (!allowed)
    return (
      <Restricted
        title="Utilisateurs et rôles"
        description="L’attribution des rôles est réservée aux administrateurs."
      />
    );
  const permissions = Object.keys(PERMISSION_LABELS) as Permission[];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/parametres"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Retour aux paramètres
      </Link>
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Paramètres
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Utilisateurs et rôles</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Les comptes se créent depuis « Agents & paie » ; attribuez ici leur
          rôle. Un changement de rôle ferme les sessions ouvertes de
          l’utilisateur.
        </p>
      </header>
      <Card className="border-border bg-card">
        <CardContent className="divide-y divide-border p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
          ) : (
            members.map(member => (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{member.name || member.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.email} ·{" "}
                    {member.active
                      ? `dernière connexion ${formatDate(member.lastSignedIn, true)}`
                      : "compte désactivé"}
                  </p>
                </div>
                <select
                  aria-label={`Rôle de ${member.name || member.email}`}
                  value={member.role}
                  disabled={updateRole.isPending || member.id === user?.id}
                  onChange={event =>
                    updateRole.mutate({
                      id: member.id,
                      role: event.target.value as Role,
                    })
                  }
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  {ROLES.map(role => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="overflow-x-auto p-6">
          <h2 className="font-semibold">Droits par rôle</h2>
          <table className="mt-4 w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Droit</th>
                {ROLES.map(role => (
                  <th
                    key={role}
                    className="px-2 py-2 text-center font-medium"
                    title={ROLE_DESCRIPTIONS[role]}
                  >
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map(permission => (
                <tr key={permission} className="border-t border-border">
                  <td className="py-2 pr-3">{PERMISSION_LABELS[permission]}</td>
                  {ROLES.map(role => (
                    <td key={role} className="px-2 py-2 text-center">
                      {permissionsOf(role).includes(permission) ? "✓" : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Les limites propres aux vendeurs (prix, remises, remboursements,
            corrections de stock) se règlent dans « Actions sensibles des
            vendeurs ».
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
