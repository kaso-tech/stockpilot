import { StatCard } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { FilePlus2, MessageCircle, PackageSearch, ReceiptText, UserPlus, UserRound, Wallet } from "lucide-react";
import { quoteShareText, whatsappLink } from "@/lib/quoteShare";
import { useState } from "react";
import { useLocation } from "wouter";

const statusLabels: Record<string, { label: string; className: string }> = {
  paid: { label: "Payée", className: "bg-success-soft text-success" },
  partial: { label: "Paiement partiel", className: "bg-warning-soft text-warning" },
  draft: { label: "En attente", className: "bg-muted text-muted-foreground" },
  void: { label: "Annulée", className: "bg-destructive-soft text-destructive" },
};
const channelLabels: Record<string, string> = { pos: "Ticket", invoice: "Facture", quote: "Devis" };
const paymentLabels: Record<string, string> = { commission: "Commission", salary: "Salaire", mixed: "Salaire et commission", food_allowance: "Prime d’alimentation" };

function monthLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function remunerationText(remuneration: { mode: string; fixedMonthlyCents: number; commissionBasis: string; rateBasisPoints: number } | null) {
  if (!remuneration) return "Rémunération non renseignée : rapprochez-vous de votre administrateur.";
  const rate = `${(remuneration.rateBasisPoints / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % ${remuneration.commissionBasis === "net_profit" ? "de la marge" : "du chiffre d’affaires"}`;
  if (remuneration.mode === "fixed") return `Salaire fixe de ${formatCurrency(remuneration.fixedMonthlyCents)} par mois.`;
  if (remuneration.mode === "commission") return `Commission de ${rate} des ventes qui vous sont attribuées.`;
  return `Fixe de ${formatCurrency(remuneration.fixedMonthlyCents)} par mois + ${rate} des ventes qui vous sont attribuées.`;
}

/** Espace de l’agent commercial : ses commissions, ses ventes attribuées et ses raccourcis. */
export default function AgentSpace() {
  const [, setLocation] = useLocation();
  const [periodLabel, setPeriodLabel] = useState<string | undefined>(undefined);
  const { data, isLoading, error } = trpc.agentSpace.overview.useQuery(periodLabel ? { periodLabel } : undefined);
  const { data: quotes = [] } = trpc.agentSpace.quotes.useQuery();
  if (isLoading) return <div className="py-20 text-center text-sm text-faint">Chargement de votre espace…</div>;
  if (error || !data) return <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Mon espace</h1><p className="mt-2 text-sm text-muted-foreground">{error?.message ?? "Espace indisponible."}</p></section>;
  const { totals } = data;
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-medium text-primary">Agent commercial</p><h1 className="text-[22px] font-bold tracking-tight text-foreground">Bonjour {data.agent.name.split(" ")[0]}</h1><p className="mt-1 text-sm text-muted-foreground">{remunerationText(data.remuneration)}</p></div>
      <select aria-label="Période" value={data.periodLabel} onChange={event => setPeriodLabel(event.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground">{data.months.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}</select>
    </header>
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Wallet className="h-5 w-5" /></span><div><p className="text-sm text-muted-foreground">Reste à recevoir · {monthLabel(data.periodLabel)}</p><p className="text-3xl font-bold tracking-tight text-foreground">{formatCurrency(totals.dueCents)}</p></div></div></section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Commissions" value={formatCurrency(totals.commissionCents)} tone="primary" />
      {totals.fixedCents > 0 && <StatCard label="Salaire fixe" value={formatCurrency(totals.fixedCents)} />}
      <StatCard label="Déjà payé" value={formatCurrency(totals.paidCents)} tone="success" />
      <StatCard label="Ventes attribuées" value={totals.salesCount} note={`${formatCurrency(totals.revenueCents)} encaissés`} />
    </section>
    <Button onClick={() => setLocation("/mon-espace/devis/nouveau")} className="h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90"><FilePlus2 className="h-5 w-5" />Nouveau devis</Button>
    <section className="grid grid-cols-3 gap-2">
      <Button variant="outline" onClick={() => setLocation("/clients")} className="h-auto flex-col gap-1.5 py-3"><UserRound className="h-5 w-5 text-primary" /><span className="text-xs">Mes clients</span></Button>
      <Button variant="outline" onClick={() => setLocation("/clients?nouveau=1")} className="h-auto flex-col gap-1.5 py-3"><UserPlus className="h-5 w-5 text-primary" /><span className="text-xs">Nouveau client</span></Button>
      <Button variant="outline" onClick={() => setLocation("/produits")} className="h-auto flex-col gap-1.5 py-3"><PackageSearch className="h-5 w-5 text-primary" /><span className="text-xs">Catalogue</span></Button>
    </section>
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><p className="font-semibold text-foreground">Mes ventes · {monthLabel(data.periodLabel)}</p><Badge className="border-0 bg-primary/10 text-primary">{data.sales.length}</Badge></div>
      {data.sales.length ? <div className="divide-y divide-border">{data.sales.map(sale => { const status = statusLabels[sale.status] ?? statusLabels.draft; return <div key={sale.id} className="flex items-center gap-3 px-5 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><ReceiptText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{sale.customerName ?? "Client de passage"}</p><p className="mt-0.5 truncate text-xs text-faint">{channelLabels[sale.channel] ?? "Vente"} {sale.invoiceNumber} · {formatDate(sale.createdAt)}</p></div><div className="text-right"><p className="text-sm font-semibold text-foreground">{formatCurrency(sale.totalCents)}</p><p className="mt-0.5 text-xs text-primary">{sale.commissionCents ? `+ ${formatCurrency(sale.commissionCents)}` : <span className={`rounded-full px-2 py-0.5 ${status.className}`}>{status.label}</span>}</p></div></div>; })}</div> : <p className="px-5 py-10 text-center text-sm text-faint">Aucune vente ne vous est attribuée sur cette période.</p>}
    </section>
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><p className="font-semibold text-foreground">Mes devis</p><Badge className="border-0 bg-primary/10 text-primary">{quotes.length}</Badge></div>
      {quotes.length ? <div className="divide-y divide-border">{quotes.slice(0, 10).map(quote => { const text = quoteShareText({ number: quote.invoiceNumber, customerName: quote.customerName, agentName: data.agent.name, items: quote.items, totalCents: quote.totalCents, note: quote.note }); return <div key={quote.id} className="flex items-center gap-3 px-5 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{quote.customerName ?? "Client"}</p><p className="mt-0.5 truncate text-xs text-faint">{quote.invoiceNumber} · {formatDate(quote.createdAt)} · {quote.items.length} produit{quote.items.length > 1 ? "s" : ""}</p></div><p className="text-sm font-semibold text-foreground">{formatCurrency(quote.totalCents)}</p><Button asChild variant="outline" size="icon" className="h-9 w-9 shrink-0 text-[#25D366]" aria-label={`Envoyer le devis ${quote.invoiceNumber} par WhatsApp`}><a href={whatsappLink(quote.customerPhone, text)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /></a></Button></div>; })}</div> : <p className="px-5 py-8 text-center text-sm text-faint">Aucun devis pour le moment.</p>}
    </section>
    {data.payments.length > 0 && <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><p className="font-semibold text-foreground">Paiements reçus · {monthLabel(data.periodLabel)}</p></div><div className="divide-y divide-border">{data.payments.map((payment, index) => <div key={index} className="flex items-center justify-between px-5 py-3 text-sm"><span className="text-muted-foreground">{paymentLabels[payment.paymentKind] ?? "Paiement"} · {formatDate(payment.paidAt)}</span><span className="font-semibold text-success">{formatCurrency(payment.amountCents)}</span></div>)}</div></section>}
  </div>;
}
