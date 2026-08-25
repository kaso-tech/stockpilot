import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { displayCurrencyLabel, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, History } from "lucide-react";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsHistory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: logs = [], isLoading } = trpc.audit.settings.useQuery(undefined, { enabled: isAdmin });

  if (!isAdmin) return <Restricted title="Historique des paramètres" description="Cet historique est réservé aux administrateurs." />;

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Traçabilité</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Historique des paramètres</h1></header>
    <Card><CardContent className="p-0">{isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Chargement…</p> : logs.length ? <div className="divide-y divide-border">{logs.map(log => <div key={log.id} className="flex gap-3 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><History className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{log.action}</Badge><span className="text-xs text-muted-foreground">{formatDate(log.createdAt, true)}</span></div><p className="mt-1.5 text-sm text-card-foreground">{displayCurrencyLabel(log.detail || "Modification de paramètres")}</p><p className="mt-1 text-xs text-muted-foreground">Par {log.actorName || "Administrateur"}</p></div></div>)}</div> : <div className="p-10 text-center text-sm text-muted-foreground">Aucune modification de paramètres enregistrée pour cette entreprise.</div>}</CardContent></Card>
  </div>;
}
