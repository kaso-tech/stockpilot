import { usePermissions } from "@/hooks/usePermissions";
import { LoadMore, usePagedLimit } from "@/components/LoadMore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { displayCurrencyLabel, formatDate } from "@/lib/format";
import { LockKeyhole } from "lucide-react";

export default function AuditLog() {
  const { can } = usePermissions();
  const isAdmin = can("audit.view");
  const paging = usePagedLimit();
  const {
    data: logs = [],
    isLoading,
    isFetching,
  } = trpc.audit.list.useQuery({ limit: paging.limit }, { enabled: isAdmin });
  if (!isAdmin)
    return (
      <Restricted
        title="Journal des opérations"
        description="Le journal d’audit est réservé aux administrateurs de l’espace."
      />
    );
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          Journal des opérations
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Conservez une trace horodatée de chaque action structurante de
          l’espace stock.
        </p>
      </header>
      <Card className="border-border bg-card shadow-none gap-0 py-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-muted text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-4 py-3">Détail</th>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-6 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-sm text-faint"
                    >
                      Chargement du journal…
                    </td>
                  </tr>
                ) : logs.length ? (
                  logs.map(log => (
                    <tr key={log.id} className="text-sm hover:bg-accent">
                      <td className="px-6 py-4">
                        <Badge className="border-0 bg-primary/10 text-primary">
                          {log.action}
                        </Badge>
                        <p className="mt-1.5 text-xs text-faint">
                          {log.entityType}
                        </p>
                      </td>
                      <td className="max-w-md px-4 py-4 text-muted-foreground">
                        {displayCurrencyLabel(log.detail || "—")}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-foreground">
                          {log.actorName || "Utilisateur supprimé"}
                        </p>
                        <p className="mt-0.5 text-xs text-faint">
                          {log.actorEmail || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-faint">
                        {formatDate(log.createdAt, true)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-16 text-center text-sm text-faint"
                    >
                      Aucune action à afficher pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

export function Restricted({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto grid min-h-[65vh] max-w-xl place-items-center text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-info-soft text-info">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
