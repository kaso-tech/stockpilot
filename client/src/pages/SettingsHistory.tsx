import { usePermissions } from "@/hooks/usePermissions";
import { LoadMore, usePagedLimit } from "@/components/LoadMore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { displayCurrencyLabel, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, History } from "lucide-react";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsHistory() {
  const { can } = usePermissions();
  const isAdmin = can("settings.manage");
  const paging = usePagedLimit(300);
  const {
    data: logs = [],
    isLoading,
    isFetching,
  } = trpc.audit.list.useQuery({ limit: paging.limit }, { enabled: isAdmin });
  if (!isAdmin)
    return (
      <Restricted
        title="Historique des paramètres"
        description="Cet historique est réservé aux administrateurs."
      />
    );
  const settingsLogs = logs.filter(
    log =>
      log.entityType === "Entreprise" ||
      log.entityType === "POS" ||
      log.action.includes("Paramètres")
  );
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/parametres"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux paramètres
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Traçabilité
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
          Historique des paramètres
        </h1>
      </header>
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-faint">Chargement…</p>
          ) : settingsLogs.length ? (
            <div className="divide-y divide-border">
              {settingsLogs.map(log => (
                <div key={log.id} className="flex gap-4 p-5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <History className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-0 bg-muted text-muted-foreground">
                        {log.action}
                      </Badge>
                      <span className="text-xs text-faint">
                        {formatDate(log.createdAt, true)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {displayCurrencyLabel(
                        log.detail || "Modification de paramètres"
                      )}
                    </p>
                    <p className="mt-1 text-xs text-faint">
                      Par {log.actorName || "Administrateur"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-faint">
              Aucune modification de paramètres enregistrée.
            </div>
          )}
        </CardContent>
      </Card>
      <LoadMore
        shown={logs.length}
        limit={paging.limit}
        onMore={paging.loadMore}
        loading={isFetching}
      />
    </div>
  );
}
