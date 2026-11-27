import { can } from "@shared/permissions";
import { matchesSearch } from "@/lib/search";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { documentParticipantNames, documentParticipantOptionLabel, matchesDocumentParticipant } from "@/lib/documentParticipants";
import { downloadCommercialDocumentsCsv } from "@/lib/documentCsv";
import { trpc } from "@/lib/trpc";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { Download, Eye, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Quotes() {
  const { user } = useAuth();
  const { activeWarehouseId } = useActiveWarehouse();
  const [, setLocation] = useLocation();
  const { data: transactions = [], isLoading } =
    trpc.transactions.list.useQuery(activeWarehouseId ? { warehouseId: activeWarehouseId } : undefined);
  const { data: documentParticipants = [] } = trpc.commerce.documentParticipants.useQuery();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "paid" | "void">("all");
  const [agentId, setAgentId] = useState("all");
  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">("all");
  const quotes = transactions.filter(item => item.channel === "quote");
  const filteredQuotes = useMemo(() => quotes.filter(quote => {
    const matchesQuery = matchesSearch(search, quote.invoiceNumber, quote.customerName);
    const matchesStatus = status === "all" || quote.status === status;
    const matchesAgent = matchesDocumentParticipant(quote, agentId);
    const created = new Date(quote.createdAt).getTime(); const now = Date.now();
    const matchesPeriod = period === "all" || (period === "today" ? created >= new Date().setHours(0, 0, 0, 0) : period === "week" ? created >= now - 7 * 86_400_000 : created >= now - 31 * 86_400_000);
    return matchesQuery && matchesStatus && matchesAgent && matchesPeriod;
  }), [agentId, period, quotes, search, status]);
  const exportFilteredQuotes = () => downloadCommercialDocumentsCsv("devis-filtres.csv", filteredQuotes.map(quote => ({ reference: quote.invoiceNumber, date: quote.createdAt, client: quote.customerName || "Client", statut: quote.status === "paid" ? "Accepté" : quote.status === "void" ? "Retourné / annulé" : "En attente", agent: documentParticipantNames(quote, documentParticipants), totalCents: quote.totalCents, encaisseCents: quote.amountPaidCents })));
  if (!can(user?.role, "sales.view", user?.permissions))
    return (
      <div className="mx-auto max-w-5xl py-16 text-center text-muted-foreground">
        Accès réservé aux utilisateurs autorisés.
      </div>
    );
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">
            Devis
          </h1>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportFilteredQuotes}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button><Button onClick={() => setLocation("/devis/nouveau")} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Créer un devis</Button></div>
      </header>
      <section className="rounded-xl border border-border bg-card p-4"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(150px,.45fr))]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-faint" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Devis, client…" className="h-10 w-full rounded-xl border border-border bg-muted pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/70" /></label><select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground"><option value="all">Tous les statuts</option><option value="draft">En attente</option><option value="paid">Acceptés</option><option value="void">Retournés / annulés</option></select><select value={agentId} onChange={event => setAgentId(event.target.value)} className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground"><option value="all">Tous les intervenants</option>{documentParticipants.map(participant => <option key={participant.key} value={participant.key}>{documentParticipantOptionLabel(participant)}</option>)}</select><select value={period} onChange={event => setPeriod(event.target.value as typeof period)} className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground"><option value="all">Toutes les dates</option><option value="today">Aujourd’hui</option><option value="week">7 derniers jours</option><option value="month">30 derniers jours</option></select></div><p className="mt-3 text-xs text-faint">{filteredQuotes.length} devis affiché{filteredQuotes.length > 1 ? "s" : ""}</p></section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Chargement…
            </CardContent>
          </Card>
        ) : filteredQuotes.length ? (
          filteredQuotes.map(quote => (
            <button
              key={quote.id}
              type="button"
              onClick={() => setLocation(`/devis/${quote.id}`)}
              className="lift surface group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition hover:border-primary/45 hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {quote.invoiceNumber}
                  </p>
                  <Badge className="border-0 bg-info-soft text-info">
                    Devis
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {quote.customerName || "Client"} ·{" "}
                  {formatDate(quote.createdAt, true)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-primary">
                  {formatCurrency(quote.totalCents)}
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  {quote.status === "paid" ? "Accepté" : "En attente"}
                </p>
              </div>
              <Eye className="h-4 w-4 shrink-0 text-faint transition group-hover:text-primary" />
            </button>
          ))
        ) : (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto h-7 w-7 text-faint" />
              <p className="mt-4 text-sm text-muted-foreground">Aucun devis ne correspond aux filtres.</p>
              <Button
                onClick={() => setLocation("/devis/nouveau")}
                className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Créer le premier devis
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
