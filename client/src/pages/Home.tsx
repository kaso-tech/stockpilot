import { AnimatedNumber } from "@/components/AnimatedNumber";
import { can } from "@shared/permissions";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelHeader } from "@/components/page";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { dashboardPreferencesForRole, normalizeDashboardPreferences } from "@/lib/dashboardPreferences";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, Boxes, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, CreditCard, FilePlus2, PiggyBank, ShoppingCart, Trophy, UserPlus, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

type Summary = {
  todayRevenueCents?: number; todaySaleCount?: number; monthlyRevenueCents?: number; previousMonthToDateRevenueCents?: number; monthlyInvoiceCount?: number;
  monthlyMarginCents?: number; monthlyOperatingProfitCents?: number; monthlyExpenseCents?: number; receivableCents?: number; receivableCount?: number; receivableOverdueCount?: number;
  productCount?: number; activeAlerts?: number; draftInventories?: number; duePayrollCents?: number; dueSoonCount?: number; dueSoonCents?: number;
  expenseBudget?: { configured: boolean; exceeded: boolean; warningReached: boolean; percentUsed: number };
};
type Sale = { id: number; invoiceNumber: string; channel?: string; customerName: string; totalCents: number; createdAt: Date | string };
type Product = { id: number; name: string; reference: string; quantity: number; unit: string; minimumQuantity: number };

const percent = (value: number) => `${Math.abs(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
const compact = (cents: number) => { const value = cents / 100; return value >= 1_000_000 ? `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}\u00a0M` : value >= 1_000 ? `${(value / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}\u00a0k` : value.toLocaleString("fr-FR"); };

/**
 * Accueil en quatre zones : en-tête et actions, quatre indicateurs, ventes et
 * actions à traiter, dernières ventes et stock. Chaque chiffre n'apparaît qu'une fois.
 */
export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canSeeFinance = can(user?.role, "expenses.manage", user?.permissions);
  const canSeePayroll = can(user?.role, "payroll.manage", user?.permissions);
  const { activeWarehouseId, activeWarehouse } = useActiveWarehouse();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  // Jamais de résultats globaux pendant la résolution de l'entrepôt actif.
  const { data, isLoading } = trpc.dashboard.get.useQuery(activeWarehouseId ? { warehouseId: activeWarehouseId } : undefined, { enabled: Boolean(activeWarehouseId) });
  const { data: savedPreferences } = trpc.dashboardPreferences.get.useQuery();
  const { data: onboarding } = trpc.onboarding.status.useQuery(undefined, { enabled: isAdmin });
  const refreshOnboarding = async () => { await Promise.all([utils.onboarding.status.invalidate(), utils.dashboard.get.invalidate()]); };
  const onboardingComplete = trpc.onboarding.complete.useMutation({ onSuccess: refreshOnboarding });
  const onboardingSkip = trpc.onboarding.skip.useMutation({ onSuccess: refreshOnboarding });
  const role = user?.role === "seller" ? "seller" : "admin";
  const [preferences, setPreferences] = useState(() => dashboardPreferencesForRole(role));
  useEffect(() => {
    try { setPreferences(savedPreferences?.preferencesJson ? normalizeDashboardPreferences(JSON.parse(savedPreferences.preferencesJson), role) : dashboardPreferencesForRole(role)); }
    catch { setPreferences(dashboardPreferencesForRole(role)); }
  }, [savedPreferences?.preferencesJson, role]);

  const loading = isLoading || !activeWarehouseId;
  const summary = (data?.summary ?? {}) as Summary;
  const todayRaw = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const canSell = can(user?.role, "sales.create", user?.permissions);
  const showChart = canSeeFinance && preferences.salesTrend;
  const showTodo = preferences.todo;
  const showRecent = canSeeFinance && preferences.recentSales;
  const showStock = preferences.lowStock;

  return <div className="stagger mx-auto max-w-[1400px] space-y-5 sm:space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Bonjour{firstName ? ` ${firstName}` : ""}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground"><span>{today}</span>{activeWarehouse && <> · <span className="font-medium text-foreground">{activeWarehouse.name}</span></>}</p>
      </div>
      {preferences.hero && <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {canSell && <Button onClick={() => setLocation("/pos")} className="col-span-2 h-11 sm:h-10"><ShoppingCart className="h-4 w-4" />Vente rapide</Button>}
        {canSell && <Button onClick={() => setLocation("/factures/nouvelle")} variant="outline" className="h-10"><FilePlus2 className="h-4 w-4" />Nouvelle facture</Button>}
        {can(user?.role, "customers.manage", user?.permissions) && <Button onClick={() => setLocation("/clients?nouveau=1")} variant="outline" className="h-10"><UserPlus className="h-4 w-4" />Nouveau client</Button>}
      </div>}
    </header>

    {isAdmin && onboarding && !onboarding.completed && <OnboardingPanel onboarding={onboarding} pending={onboardingComplete.isPending || onboardingSkip.isPending} completing={onboardingComplete.isPending} skipping={onboardingSkip.isPending} onNavigate={setLocation} onComplete={() => onboardingComplete.mutate()} onSkip={() => { if (window.confirm("Ignorer définitivement l’assistant de démarrage pour cette entreprise ?")) onboardingSkip.mutate(); }} />}

    {preferences.metrics && (canSeeFinance ? <FinanceKpis summary={summary} loading={loading} /> : <section aria-label="Indicateurs" className="stagger grid grid-cols-2 gap-3 sm:gap-4">
      <Kpi label="Références actives" loading={loading} value={String(summary.productCount ?? 0)} note="Produits de l’entrepôt actif" />
      <Kpi label="Alertes de stock" loading={loading} value={String(summary.activeAlerts ?? 0)} note="Au seuil ou en rupture" noteTone={(summary.activeAlerts ?? 0) > 0 ? "warning" : undefined} />
    </section>)}

    {(showChart || showTodo || showRecent || showStock) && <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
      {/* Téléphone : À traiter, dernières ventes, graphique, stock. Ordinateur : deux rangées. */}
      {showChart && <div className="order-3 min-w-0 lg:order-1"><SalesChart data={data?.salesTrend30 ?? []} loading={loading} /></div>}
      {showTodo && <div className="order-1 min-w-0 lg:order-2"><TodoPanel summary={summary} loading={loading} canSeeFinance={canSeeFinance} canSeePayroll={canSeePayroll} canSeeInventory={can(user?.role, "inventory.manage", user?.permissions)} onNavigate={setLocation} /></div>}
      {showRecent && <div className="order-2 min-w-0 lg:order-3"><RecentSales sales={(data?.recentSales ?? []) as Sale[]} loading={loading} onNavigate={setLocation} /></div>}
      {showStock && <div className="order-4 min-w-0"><StockPanel lowStock={(data?.lowStock ?? []) as Product[]} topProducts={canSeeFinance ? data?.topProducts ?? [] : []} loading={loading} onNavigate={setLocation} /></div>}
    </section>}
  </div>;
}

function FinanceKpis({ summary, loading }: { summary: Summary; loading: boolean }) {
  const month = summary.monthlyRevenueCents ?? 0;
  const previous = summary.previousMonthToDateRevenueCents ?? 0;
  const change = previous > 0 ? ((month - previous) / previous) * 100 : null;
  const margin = summary.monthlyMarginCents ?? 0;
  const marginRate = month > 0 ? (margin / month) * 100 : null;
  const overdue = summary.receivableOverdueCount ?? 0;
  const receivableCount = summary.receivableCount ?? 0;
  return <section aria-label="Indicateurs" className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
    <Kpi label="Ventes du jour" loading={loading} cents={summary.todayRevenueCents ?? 0} note={`${summary.todaySaleCount ?? 0} vente${(summary.todaySaleCount ?? 0) > 1 ? "s" : ""} encaissée${(summary.todaySaleCount ?? 0) > 1 ? "s" : ""}`} />
    <Kpi label="Ventes du mois" loading={loading} cents={month} note={change === null ? "Rien à comparer le mois dernier" : <span title="Comparé aux mêmes jours du mois précédent">{change >= 0 ? <ArrowUpRight className="-mt-0.5 inline h-3.5 w-3.5" /> : <ArrowDownRight className="-mt-0.5 inline h-3.5 w-3.5" />}{change >= 0 ? "+" : "−"}{percent(change)} <span className="font-normal text-muted-foreground">vs mois dernier</span></span>} noteTone={change === null ? undefined : change >= 0 ? "success" : "danger"} />
    <Kpi label="Marge du mois" loading={loading} cents={margin} note={`${marginRate === null ? "—" : `Taux ${percent(marginRate)}`} · net ${formatCurrency(summary.monthlyOperatingProfitCents ?? 0)}`} />
    <Kpi label="À encaisser" loading={loading} cents={summary.receivableCents ?? 0} note={receivableCount ? `${receivableCount} facture${receivableCount > 1 ? "s" : ""}${overdue ? ` · ${overdue} de plus de 30 j` : ""}` : "Aucune facture en attente"} noteTone={overdue ? "warning" : undefined} />
  </section>;
}

const noteTones = { success: "text-success", danger: "text-destructive", warning: "text-warning" } as const;
function Kpi({ label, value, cents, note, noteTone, loading }: { label: string; value?: string; cents?: number; note: ReactNode; noteTone?: keyof typeof noteTones; loading: boolean }) {
  return <div className="surface flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5 sm:py-[18px]">
    <p className="truncate text-xs font-medium text-muted-foreground sm:text-[13px]">{label}</p>
    {loading ? <Skeleton className="my-1 h-7 w-28" /> : <p className="truncate text-lg font-bold leading-tight tracking-tight text-foreground sm:text-[22px]">{cents !== undefined ? <AnimatedNumber value={cents} format={formatCurrency} /> : value}</p>}
    <p className={`text-xs font-medium leading-snug sm:text-[13px] ${noteTone ? noteTones[noteTone] : "text-muted-foreground"}`}>{note}</p>
  </div>;
}

function SalesChart({ data, loading }: { data: Array<{ day: string; revenueCents: number; count: number }>; loading: boolean }) {
  const total = data.reduce((sum, item) => sum + item.revenueCents, 0);
  const count = data.reduce((sum, item) => sum + item.count, 0);
  const points = data.map(item => ({ ...item, label: new Date(`${item.day}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) }));
  return <Panel className="flex h-full flex-col">
    <PanelHeader title="Ventes des 30 derniers jours" detail={loading ? "Chargement…" : `${formatCurrency(total)} · ${count} vente${count > 1 ? "s" : ""} encaissée${count > 1 ? "s" : ""} (tickets et factures)`} />
    <div className="min-h-[220px] flex-1 px-2 pb-4 sm:px-4">
      {loading ? <Skeleton className="h-[220px] w-full" /> : total === 0 ? <div className="grid h-[180px] place-items-center text-center text-sm text-muted-foreground">Aucune vente encaissée sur les 30 derniers jours.</div> :
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={6} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={value => compact(Number(value))} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--popover-foreground)", fontSize: 12 }} formatter={value => [formatCurrency(Number(value ?? 0)), "Ventes"]} labelFormatter={(_, payload) => { const item = payload?.[0]?.payload as { label: string; count: number } | undefined; return item ? `${item.label} · ${item.count} vente${item.count > 1 ? "s" : ""}` : ""; }} />
            <Bar dataKey="revenueCents" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>}
    </div>
  </Panel>;
}

type TodoItem = { key: string; icon: typeof BellRing; title: string; detail: string; value: string; tone: "warning" | "danger" | "info" | "primary"; path: string };
const todoTones = { warning: "bg-warning-soft text-warning", danger: "bg-destructive-soft text-destructive", info: "bg-info-soft text-info", primary: "bg-primary-soft text-primary" };
function TodoPanel({ summary, loading, canSeeFinance, canSeePayroll, canSeeInventory, onNavigate }: { summary: Summary; loading: boolean; canSeeFinance: boolean; canSeePayroll: boolean; canSeeInventory: boolean; onNavigate: (path: string) => void }) {
  const items: TodoItem[] = [];
  const receivables = summary.receivableCount ?? 0;
  const overdue = summary.receivableOverdueCount ?? 0;
  if (canSeeFinance && receivables) items.push({ key: "receivables", icon: CreditCard, title: "Factures à encaisser", detail: overdue ? `${receivables} facture${receivables > 1 ? "s" : ""} · ${overdue} de plus de 30 j` : `${receivables} facture${receivables > 1 ? "s" : ""} en attente`, value: formatCurrency(summary.receivableCents ?? 0), tone: overdue ? "danger" : "warning", path: "/factures" });
  if (summary.activeAlerts) items.push({ key: "stock", icon: BellRing, title: "Stock sous le seuil", detail: "Produits à réapprovisionner", value: String(summary.activeAlerts), tone: "warning", path: "/alertes" });
  if (canSeeFinance && summary.dueSoonCount) items.push({ key: "dues", icon: CalendarClock, title: "Échéances à payer", detail: "Échues ou dans les 7 prochains jours", value: formatCurrency(summary.dueSoonCents ?? 0), tone: "info", path: "/echeances" });
  if (canSeeFinance && canSeePayroll && summary.duePayrollCents) items.push({ key: "payroll", icon: WalletCards, title: "Paie à régler", detail: "Solde du mois en cours", value: formatCurrency(summary.duePayrollCents), tone: "info", path: "/agents" });
  if (canSeeInventory && summary.draftInventories) items.push({ key: "inventories", icon: ClipboardCheck, title: "Inventaires ouverts", detail: "À finaliser", value: String(summary.draftInventories), tone: "primary", path: "/inventaires" });
  const budget = summary.expenseBudget;
  if (canSeeFinance && budget?.configured && (budget.exceeded || budget.warningReached)) items.push({ key: "budget", icon: PiggyBank, title: budget.exceeded ? "Budget dépenses dépassé" : "Budget dépenses bientôt atteint", detail: "Dépenses du mois", value: percent(budget.percentUsed), tone: budget.exceeded ? "danger" : "warning", path: "/depenses" });
  return <Panel className="flex h-full flex-col">
    <PanelHeader title="À traiter" detail={loading ? undefined : items.length ? `${items.length} point${items.length > 1 ? "s" : ""} demande${items.length > 1 ? "nt" : ""} votre attention` : "Entrepôt actif"} />
    {loading ? <div className="space-y-3 px-5 pb-5"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>
      : items.length ? <div className="divide-y divide-border border-t border-border">{items.map(item => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => onNavigate(item.path)} className="group flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent/60">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${todoTones[item.tone]}`}><Icon className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.detail}</span></span>
          <span className="shrink-0 text-sm font-semibold text-foreground">{item.value}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
        </button>; })}</div>
      : <div className="flex flex-1 items-center gap-3 border-t border-border px-5 py-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-sm font-medium text-foreground">Tout est à jour</p><p className="text-xs text-muted-foreground">Aucune action en attente.</p></div></div>}
  </Panel>;
}

function RecentSales({ sales, loading, onNavigate }: { sales: Sale[]; loading: boolean; onNavigate: (path: string) => void }) {
  return <Panel className="flex h-full flex-col">
    <PanelHeader title="Dernières ventes" detail="Tickets et factures encaissés" action={<div className="flex gap-1"><Button variant="ghost" size="sm" className="text-primary" onClick={() => onNavigate("/tickets")}>Tickets</Button><Button variant="ghost" size="sm" className="text-primary" onClick={() => onNavigate("/factures")}>Factures</Button></div>} />
    {loading ? <div className="space-y-3 px-5 pb-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      : sales.length ? <div className="divide-y divide-border border-t border-border">{sales.map(sale => { const ticket = sale.channel === "pos"; return <button key={sale.id} type="button" onClick={() => onNavigate(ticket ? "/tickets" : `/factures/${sale.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent/60">
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${ticket ? "bg-primary-soft text-primary" : "bg-info-soft text-info"}`}>{ticket ? "Ticket" : "Facture"}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{sale.customerName}</span><span className="block truncate text-xs text-muted-foreground">{sale.invoiceNumber} · {formatDate(sale.createdAt)}</span></span>
          <span className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(sale.totalCents)}</span>
        </button>; })}</div>
      : <p className="border-t border-border px-5 py-8 text-center text-sm text-muted-foreground">Aucune vente encaissée pour le moment.</p>}
  </Panel>;
}

function StockPanel({ lowStock, topProducts, loading, onNavigate }: { lowStock: Product[]; topProducts: Array<{ productId: number; name: string; quantity: number; revenueCents: number }>; loading: boolean; onNavigate: (path: string) => void }) {
  if (loading) return <Panel className="h-full"><PanelHeader title="Stock" /><div className="space-y-3 px-5 pb-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></Panel>;
  if (lowStock.length) return <Panel className="flex h-full flex-col">
    <PanelHeader title="Stock à réapprovisionner" detail={`${lowStock.length} produit${lowStock.length > 1 ? "s" : ""} au seuil ou en dessous`} action={<Button variant="ghost" size="sm" className="text-primary" onClick={() => onNavigate("/alertes")}>Tout voir <ArrowRight className="h-4 w-4" /></Button>} />
    <div className="divide-y divide-border border-t border-border">{lowStock.map(product => <button key={product.id} type="button" onClick={() => onNavigate(`/produits/${product.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent/60">
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{product.name}</span><span className="block truncate text-xs text-muted-foreground">{product.reference} · seuil {product.minimumQuantity}</span></span>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${product.quantity <= 0 ? "bg-destructive-soft text-destructive" : "bg-warning-soft text-warning"}`}>{product.quantity <= 0 ? "Rupture" : `${product.quantity} en stock`}</span>
    </button>)}</div>
  </Panel>;
  if (topProducts.length) return <Panel className="flex h-full flex-col">
    <PanelHeader title="Meilleures ventes du mois" detail="Aucun produit sous son seuil de stock" />
    <div className="divide-y divide-border border-t border-border">{topProducts.map((product, index) => <button key={product.productId} type="button" onClick={() => onNavigate(`/produits/${product.productId}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-accent/60">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"}`}>{index === 0 ? <Trophy className="h-3.5 w-3.5" /> : index + 1}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{product.name}</span><span className="block text-xs text-muted-foreground">{product.quantity.toLocaleString("fr-FR")} vendu{product.quantity > 1 ? "s" : ""}</span></span>
      <span className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(product.revenueCents)}</span>
    </button>)}</div>
  </Panel>;
  return <Panel className="h-full"><PanelHeader title="Stock" /><div className="flex items-center gap-3 border-t border-border px-5 py-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-success-soft text-success"><Boxes className="h-5 w-5" /></span><div><p className="text-sm font-medium text-foreground">Stock sous contrôle</p><p className="text-xs text-muted-foreground">Aucun produit sous son seuil.</p></div></div></Panel>;
}

function OnboardingPanel({ onboarding, pending, completing, skipping, onNavigate, onComplete, onSkip }: { onboarding: { steps: { product: boolean; customer: boolean; paymentMethod: boolean } }; pending: boolean; completing: boolean; skipping: boolean; onNavigate: (path: string) => void; onComplete: () => void; onSkip: () => void }) {
  const steps = [{ key: "product" as const, label: "Premier produit", detail: "Ajoutez une référence", icon: Boxes, path: "/produits?nouveau=1" }, { key: "customer" as const, label: "Premier client", detail: "Créez une fiche client", icon: UserPlus, path: "/clients?nouveau=1" }, { key: "paymentMethod" as const, label: "Encaissement", detail: "Activez un moyen", icon: CreditCard, path: "/parametres/pos" }];
  const done = steps.filter(step => onboarding.steps[step.key]).length;
  return <section className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm"><div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)] xl:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Démarrage guidé</p><h2 className="mt-1 text-lg font-semibold text-foreground">Préparez votre espace</h2><p className="mt-1 text-sm text-muted-foreground">{done} étape{done === 1 ? "" : "s"} sur {steps.length} terminée{done === 1 ? "" : "s"}. Votre progression est mémorisée automatiquement.</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Progression du démarrage"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} /></div></div><div className="grid gap-2 sm:grid-cols-3">{steps.map(step => { const finished = onboarding.steps[step.key]; const Icon = finished ? CheckCircle2 : step.icon; return <button key={step.key} type="button" disabled={finished || pending} onClick={() => onNavigate(step.path)} className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${finished ? "border-success/20 bg-success-soft/50" : "border-border bg-background hover:border-primary/40 hover:bg-accent"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${finished ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></span><span><span className="block text-sm font-medium text-foreground">{step.label}</span><span className="block text-xs text-muted-foreground">{finished ? "Terminé" : step.detail}</span></span></button>; })}</div></div><div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end sm:px-6">{done === steps.length && <Button onClick={onComplete} disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90">{completing ? "Finalisation…" : "Terminer la configuration"}</Button>}<Button variant="ghost" onClick={onSkip} disabled={pending} className="text-muted-foreground">{skipping ? "Ignoré…" : "Ignorer définitivement"}</Button></div></section>;
}
