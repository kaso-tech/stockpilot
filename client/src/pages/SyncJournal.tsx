import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOffline, type SyncLogEntry } from "@/contexts/OfflineContext";
import { formatDate } from "@/lib/format";
import {
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Clock3,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type Filter = "all" | SyncLogEntry["status"];
const statusMeta = {
  queued: {
    label: "En attente",
    tone: "bg-warning-soft text-warning",
    icon: Clock3,
  },
  syncing: {
    label: "Synchronisation",
    tone: "bg-primary/10 text-primary",
    icon: RefreshCw,
  },
  succeeded: {
    label: "Réussie",
    tone: "bg-success-soft text-success",
    icon: CheckCircle2,
  },
  failed: {
    label: "Échec",
    tone: "bg-destructive-soft text-destructive",
    icon: TriangleAlert,
  },
  discarded: {
    label: "Retirée",
    tone: "bg-muted text-muted-foreground",
    icon: Trash2,
  },
};

export default function SyncJournal() {
  const {
    isOnline,
    syncLog,
    pendingCount,
    failedCount,
    persistenceStatus,
    persistenceError,
    retryPersistence,
    syncNow,
    retryOperation,
    discardOperation,
    clearCompletedSyncLog,
  } = useOffline();
  const [filter, setFilter] = useState<Filter>("all");
  const entries = useMemo(
    () =>
      filter === "all"
        ? syncLog
        : syncLog.filter(entry => entry.status === filter),
    [filter, syncLog]
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            Mode hors connexion
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Journal de synchronisation
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void syncNow()}
            disabled={!isOnline || !pendingCount}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <CloudUpload className="mr-2 h-4 w-4" />
            Synchroniser
          </Button>
          <Button
            variant="outline"
            onClick={clearCompletedSyncLog}
            disabled={!syncLog.some(entry => entry.status === "succeeded")}
            className="border-border text-muted-foreground"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Effacer les réussies
          </Button>
        </div>
      </header>
      {persistenceError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">Persistance locale indisponible</p>
            <p className="mt-1 text-destructive">
              La file affichée n’est pas encore confirmée dans IndexedDB.
              Réessayez avant de fermer cette page.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={retryPersistence}
            disabled={persistenceStatus === "saving"}
            className="border-destructive/25 text-destructive hover:bg-destructive-soft"
          >
            {persistenceStatus === "saving"
              ? "Nouvelle tentative…"
              : "Réessayer"}
          </Button>
        </div>
      )}
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="En attente"
          value={pendingCount}
          tone="cyan"
          icon={CloudUpload}
        />
        <SummaryCard
          label="Erreurs à reprendre"
          value={failedCount}
          tone="rose"
          icon={TriangleAlert}
        />
        <SummaryCard
          label="Connexion"
          value={isOnline ? "Disponible" : "Hors connexion"}
          tone={isOnline ? "emerald" : "amber"}
          icon={isOnline ? CheckCircle2 : CloudOff}
        />
      </section>
      <div className="flex flex-wrap gap-2">
        {(
          [
            "all",
            "queued",
            "syncing",
            "failed",
            "succeeded",
            "discarded",
          ] as Filter[]
        ).map(value => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border text-muted-foreground"
            }
          >
            {value === "all" ? "Toutes" : statusMeta[value].label}
          </Button>
        ))}
      </div>
      <section className="space-y-3">
        {entries.length ? (
          entries.map(entry => (
            <SyncCard
              key={entry.id}
              entry={entry}
              online={isOnline}
              onRetry={() => void retryOperation(entry.operationId)}
              onDiscard={() => {
                if (
                  window.confirm(
                    "Retirer définitivement cette opération de la file ? Elle ne sera jamais envoyée au serveur : régularisez la vente manuellement si nécessaire."
                  )
                )
                  discardOperation(entry.operationId);
              }}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-faint">
            Aucune synchronisation à afficher.
          </div>
        )}
      </section>
    </div>
  );
}
function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone: "cyan" | "rose" | "emerald" | "amber";
  icon: typeof CloudUpload;
}) {
  const classes = {
    cyan: "bg-primary/10 text-primary",
    rose: "bg-destructive-soft text-destructive",
    emerald: "bg-success-soft text-success",
    amber: "bg-warning-soft text-warning",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${classes[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
function SyncCard({
  entry,
  online,
  onRetry,
  onDiscard,
}: {
  entry: SyncLogEntry;
  online: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const meta = statusMeta[entry.status];
  const Icon = meta.icon;
  const stockConflict = /stock|quantit|rupture|insuffisant/i.test(
    entry.error ?? ""
  );
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{entry.summary}</p>
            <Badge className={`border-0 ${meta.tone}`}>
              <Icon
                className={`mr-1 h-3.5 w-3.5 ${entry.status === "syncing" ? "animate-spin" : ""}`}
              />
              {meta.label}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-faint">
            Créée le {formatDate(new Date(entry.createdAt))} · Dernière activité
            le {formatDate(new Date(entry.updatedAt))} · Tentative
            {entry.attemptCount > 1 ? "s" : ""} : {entry.attemptCount}
          </p>
          {entry.error && (
            <div className="mt-3 rounded-xl border border-destructive/25 bg-destructive-soft px-3 py-2 text-sm text-destructive">
              <span className="font-medium">Cause : </span>
              {entry.error}
            </div>
          )}
          {stockConflict && (
            <p className="mt-2 text-xs leading-relaxed text-warning">
              Vérifiez le stock disponible, corrigez l’écart si nécessaire, puis
              relancez cette opération.
            </p>
          )}
        </div>
        {entry.status === "failed" && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onRetry}
              disabled={!online}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reprendre
            </Button>
            {stockConflict && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-warning/25 text-warning hover:bg-warning-soft"
              >
                <Link href="/inventaires">Revoir le stock</Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onDiscard}
              className="border-border text-muted-foreground"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Retirer de la file
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
