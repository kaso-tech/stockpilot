import { StatCard } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ArrowLeftRight, ClipboardCheck, Lock, ReceiptText, ShoppingCart, TriangleAlert, Users } from "lucide-react";
import { useLocation } from "wouter";

const methodLabels: Record<string, string> = { cash: "Espèces", mobile_money: "Mobile money", card: "Carte", bank_transfer: "Virement", credit: "Crédit client" };

function Panel({ title, icon: Icon, action, children }: { title: string; icon: typeof Users; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5"><p className="flex items-center gap-2 font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" />{title}</p>{action}</div>{children}</section>;
}

/** Tableau de bord du gérant de dépôt : l’activité de son entrepôt, sans coûts ni marges. */
export default function DepotSpace() {
  const [, setLocation] = useLocation();
  const { activeWarehouseId, setActiveWarehouseId } = useActiveWarehouse();
  const { data: managed = [], isLoading: loadingManaged } = trpc.depotSpace.managedWarehouses.useQuery();
  const warehouseId = managed.some(item => item.id === activeWarehouseId) ? activeWarehouseId! : managed[0]?.id;
  const { data, isLoading, error } = trpc.depotSpace.overview.useQuery({ warehouseId: warehouseId ?? 0 }, { enabled: Boolean(warehouseId), refetchInterval: 60_000 });
  if (loadingManaged || (warehouseId && isLoading)) return <div className="py-20 text-center text-sm text-faint">Chargement de votre dépôt…</div>;
  if (!warehouseId) return <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Mon dépôt</h1><p className="mt-2 text-sm text-muted-foreground">Vous n’êtes gérant d’aucun dépôt. Votre administrateur peut vous nommer gérant depuis la page Entrepôts.</p></section>;
  if (error || !data) return <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Mon dépôt</h1><p className="mt-2 text-sm text-muted-foreground">{error?.message ?? "Tableau de bord indisponible."}</p></section>;
  const { sales, pending, cash, stock } = data;
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-medium text-primary">Gérant de dépôt</p><h1 className="text-[22px] font-bold tracking-tight text-foreground">{data.warehouse.name}</h1></div>
      <div className="flex flex-wrap gap-2">{managed.length > 1 && <select aria-label="Dépôt" value={warehouseId} onChange={event => setActiveWarehouseId(Number(event.target.value))} className="h-10 rounded-lg border border-input bg-card px-3 text-sm">{managed.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}<Button onClick={() => setLocation("/pos")} className="h-10 bg-primary text-primary-foreground hover:bg-primary/90"><ShoppingCart className="h-4 w-4" />Vente rapide</Button></div>
    </header>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Ventes du jour" value={formatCurrency(sales.todayRevenueCents)} tone="primary" note={`${sales.todayCount} vente(s)`} />
      <StatCard label="Ventes du mois" value={formatCurrency(sales.monthRevenueCents)} note={`${sales.monthCount} vente(s) · panier moyen ${formatCurrency(sales.averageBasketCents)}`} />
      <StatCard label="Encaissé aujourd’hui" value={formatCurrency(cash.totalCents)} tone="success" note={cash.closure ? "Caisse clôturée" : "Caisse ouverte"} noteTone={cash.closure ? "success" : "default"} />
      <StatCard label="Stock sous le seuil" value={stock.lowCount} tone={stock.lowCount ? "warning" : "success"} note={`${stock.references} référence(s) · ${stock.units} unité(s)`} />
    </section>

    <Panel title="À traiter" icon={TriangleAlert}>
      <div className="divide-y divide-border">
        {[
          { label: "Tickets à encaisser", value: pending.ticketCount, detail: formatCurrency(pending.ticketBalanceCents), path: "/tickets", show: true },
          { label: "Factures non soldées", value: pending.invoiceCount, detail: formatCurrency(pending.invoiceBalanceCents), path: "/factures", show: true },
          { label: "Devis en attente", value: pending.quoteCount, detail: "", path: "/devis", show: true },
          { label: "Transferts à réceptionner", value: data.transfers.incoming, detail: data.transfers.outgoing ? `${data.transfers.outgoing} au départ` : "", path: "/transferts-stock", show: true },
          { label: "Inventaires en cours", value: data.inventories.open, detail: "", path: "/inventaires", show: data.inventories.open > 0 },
        ].filter(item => item.show).map(item => <button key={item.label} type="button" onClick={() => setLocation(item.path)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm transition hover:bg-accent"><span className="text-muted-foreground">{item.label}</span><span className="flex items-center gap-3">{item.detail && <span className="text-xs text-faint">{item.detail}</span>}<Badge className={`min-w-8 justify-center border-0 ${item.value ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"}`}>{item.value}</Badge></span></button>)}
      </div>
    </Panel>

    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Stock sous le seuil" icon={TriangleAlert} action={<Button size="sm" variant="ghost" onClick={() => setLocation("/alertes")}>Tout voir</Button>}>
        {stock.lowItems.length ? <div className="divide-y divide-border">{stock.lowItems.map(item => <div key={item.productId} className="flex items-center justify-between px-5 py-2.5 text-sm"><span className="min-w-0 truncate">{item.name}</span><span className={item.quantity <= 0 ? "font-semibold text-destructive" : "font-semibold text-warning"}>{item.quantity} / {item.threshold} {item.unit}</span></div>)}</div> : <p className="px-5 py-6 text-center text-sm text-faint">Aucun produit sous le seuil.</p>}
      </Panel>
      <Panel title="Caisse du jour" icon={cash.closure ? Lock : ReceiptText}>
        <div className="space-y-2 px-5 py-4 text-sm">{Object.entries(cash.totals).filter(([, cents]) => cents > 0).map(([method, cents]) => <div key={method} className="flex justify-between"><span className="text-muted-foreground">{methodLabels[method] ?? method}</span><span className="font-medium">{formatCurrency(cents)}</span></div>)}{!cash.totalCents && <p className="text-faint">Aucun encaissement aujourd’hui.</p>}{cash.closure && <p className="border-t border-border pt-2 text-xs text-muted-foreground">Clôturée : attendu {formatCurrency(cash.closure.expectedCashCents)}, compté {formatCurrency(cash.closure.countedCashCents)}, écart <span className={cash.closure.differenceCents === 0 ? "text-success" : "text-warning"}>{formatCurrency(cash.closure.differenceCents)}</span></p>}</div>
      </Panel>
      <Panel title="Équipe du dépôt · aujourd’hui" icon={Users}>
        {data.team.length ? <div className="divide-y divide-border">{data.team.map(member => <div key={member.userId} className="flex items-center justify-between px-5 py-2.5 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{member.name}</span><span className="text-xs text-faint">{member.role}</span></span><span className="text-right"><span className="block font-medium">{formatCurrency(member.revenueTodayCents)}</span><span className="text-xs text-faint">{member.salesToday} vente(s)</span></span></div>)}</div> : <p className="px-5 py-6 text-center text-sm text-faint">Aucun membre affecté à ce dépôt.</p>}
      </Panel>
      <Panel title="Produits les plus vendus · ce mois" icon={ClipboardCheck}>
        {data.topProducts.length ? <div className="divide-y divide-border">{data.topProducts.map((product, index) => <div key={product.productName} className="flex items-center justify-between px-5 py-2.5 text-sm"><span className="min-w-0 truncate"><span className="mr-2 text-faint">{index + 1}.</span>{product.productName}</span><span className="text-right"><span className="block font-medium">{product.quantity} vendu(s)</span><span className="text-xs text-faint">{formatCurrency(product.revenueCents)}</span></span></div>)}</div> : <p className="px-5 py-6 text-center text-sm text-faint">Aucune vente ce mois-ci.</p>}
      </Panel>
    </div>
    <p className="flex items-center gap-1.5 text-xs text-faint"><ArrowLeftRight className="h-3.5 w-3.5" />Mis à jour automatiquement chaque minute.</p>
  </div>;
}
