import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { PLAN_DETAILS, PLANS, type Plan } from "@shared/plans";
import { toast } from "sonner";
import { Restricted } from "./AuditLog";

/** Console super-administrateur (9.8) : entreprises, plans, essais et suspensions. */
export default function Platform() {
  const utils = trpc.useUtils();
  const { data: subscription } = trpc.company.subscription.useQuery();
  const allowed = Boolean(subscription?.isPlatformAdmin);
  const { data: companies = [], isLoading } = trpc.platform.companies.useQuery(
    undefined,
    { enabled: allowed }
  );
  const update = trpc.platform.updateCompany.useMutation({
    onSuccess: () => {
      utils.platform.companies.invalidate();
      toast.success("Entreprise mise à jour.");
    },
    onError: error => toast.error(error.message),
  });
  if (subscription && !allowed)
    return (
      <Restricted
        title="Console plateforme"
        description="Réservée à l’équipe StockPilot."
      />
    );
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Plateforme
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Entreprises clientes</h1>
      </header>
      <Card className="border-border bg-card">
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-3">Entreprise</th>
                  <th className="p-3">Administrateur</th>
                  <th className="p-3">Créée le</th>
                  <th className="p-3 text-right">Util.</th>
                  <th className="p-3 text-right">Produits</th>
                  <th className="p-3 text-right">Ventes 30 j</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(company => (
                  <tr key={company.id} className="border-t border-border">
                    <td className="p-3 font-medium">
                      {company.name}
                      {company.plan === "trial" && company.trialEndsAt && (
                        <span className="block text-xs text-muted-foreground">
                          essai jusqu’au {formatDate(company.trialEndsAt)}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {company.ownerEmail}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {formatDate(company.createdAt)}
                    </td>
                    <td className="p-3 text-right">{company.users}</td>
                    <td className="p-3 text-right">{company.products}</td>
                    <td className="p-3 text-right">
                      {company.salesLast30Days}
                    </td>
                    <td className="p-3">
                      <select
                        aria-label={`Plan de ${company.name}`}
                        value={company.plan}
                        onChange={event =>
                          update.mutate({
                            companyId: company.id,
                            plan: event.target.value as Plan,
                            status: company.status,
                          })
                        }
                        className="h-9 rounded-md border border-border bg-background px-2"
                      >
                        {PLANS.map(plan => (
                          <option key={plan} value={plan}>
                            {PLAN_DETAILS[plan].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant={
                          company.status === "active" ? "outline" : "default"
                        }
                        onClick={() =>
                          update.mutate({
                            companyId: company.id,
                            plan: company.plan,
                            status:
                              company.status === "active"
                                ? "suspended"
                                : "active",
                            suspendedReason:
                              company.status === "active"
                                ? (window.prompt(
                                    "Motif de la suspension (affiché au client) :"
                                  ) ?? null)
                                : null,
                          })
                        }
                      >
                        {company.status === "active"
                          ? "Suspendre"
                          : "Réactiver"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
