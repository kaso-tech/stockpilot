import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  PLAN_DETAILS,
  PLANS,
  RESOURCE_LABELS,
  type PlanResource,
} from "@shared/plans";
import { ChevronLeft, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

/** Abonnement, consommation, export des données et suppression de l'entreprise (9.8). */
export default function SettingsSubscription() {
  const { can } = usePermissions();
  const allowed = can("settings.manage");
  const { data } = trpc.company.subscription.useQuery(undefined, {
    enabled: allowed,
  });
  const [confirmation, setConfirmation] = useState("");
  const exportData = trpc.company.exportData.useMutation({
    onSuccess: file => {
      const url = URL.createObjectURL(
        new Blob([file.content], { type: "application/json" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé.");
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.company.delete.useMutation({
    onSuccess: () => window.location.replace("/"),
    onError: error => toast.error(error.message),
  });
  if (!allowed)
    return (
      <Restricted
        title="Abonnement"
        description="L’abonnement est géré par les administrateurs de l’espace."
      />
    );
  if (!data)
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
        <h1 className="mt-2 text-3xl font-semibold">Abonnement</h1>
      </header>
      <Card className="border-border bg-card">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{data.planLabel}</h2>
            <span
              className={
                data.writable
                  ? "text-sm text-success"
                  : "text-sm text-destructive"
              }
            >
              {data.reason === "suspended"
                ? "Espace suspendu"
                : data.reason === "trial_expired"
                  ? "Essai terminé : consultation seule"
                  : "Actif"}
            </span>
          </div>
          {data.plan === "trial" && data.trialEndsAt && (
            <p className="text-sm text-muted-foreground">
              Fin de l’essai : {formatDate(data.trialEndsAt, true)}
            </p>
          )}
          {data.planRenewsAt && (
            <p className="text-sm text-muted-foreground">
              Prochaine échéance : {formatDate(data.planRenewsAt, true)}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(data.limits) as PlanResource[]).map(resource => (
              <div
                key={resource}
                className="rounded-xl border border-border p-3"
              >
                <p className="text-xs text-muted-foreground capitalize">
                  {RESOURCE_LABELS[resource]}
                </p>
                <p className="mt-1 font-semibold">
                  {data.usage[resource]} / {data.limits[resource] ?? "illimité"}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.filter(plan => plan !== "trial").map(plan => (
              <div
                key={plan}
                className={`rounded-xl border p-3 text-sm ${plan === data.plan ? "border-primary" : "border-border"}`}
              >
                <p className="font-semibold">{PLAN_DETAILS[plan].label}</p>
                <p className="mt-1 text-muted-foreground">
                  {PLAN_DETAILS[plan].description}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Pour changer d’offre, contactez l’équipe StockPilot : le paiement en
            ligne sera branché sur cette page.
          </p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="space-y-3 p-6">
          <h2 className="font-semibold">Vos données</h2>
          <p className="text-sm text-muted-foreground">
            Téléchargez toutes les données de l’entreprise dans un fichier JSON
            lisible (droit à la portabilité).
          </p>
          <Button
            variant="outline"
            disabled={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter toutes les données
          </Button>
        </CardContent>
      </Card>
      <Card className="border-destructive/25 bg-card">
        <CardContent className="space-y-3 p-6">
          <h2 className="font-semibold text-destructive">
            Supprimer l’entreprise
          </h2>
          <p className="text-sm text-muted-foreground">
            Suppression définitive de toutes les données (ventes, stock,
            clients, utilisateurs, sauvegardes). Exportez vos données avant.
            Saisissez « {data.name} » pour confirmer.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-sm"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              placeholder={data.name}
            />
            <Button
              variant="destructive"
              disabled={confirmation !== data.name || remove.isPending}
              onClick={() => remove.mutate({ confirmationName: confirmation })}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer définitivement
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
