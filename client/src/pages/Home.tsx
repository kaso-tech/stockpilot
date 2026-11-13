import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/StatusPill";
import { ProductImage } from "@/components/ProductImage";
import {
  chartTooltipStyle,
  expenseColors,
  expenseLabels,
} from "@/components/ExpenseDonut";
import {
  dashboardPreferencesForRole,
  normalizeDashboardPreferences,
} from "@/lib/dashboardPreferences";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FilePlus2,
  ReceiptText,
  ShoppingCart,
  Target,
  UserPlus,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type DashboardData = inferRouterOutputs<AppRouter>["dashboard"]["get"];

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function Home() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isAdmin = can("settings.manage");
  const canSeeFinance = can("expenses.manage");
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.dashboard.get.useQuery();
  const { data: savedPreferences } = trpc.dashboardPreferences.get.useQuery();
  const { data: companySettings } = trpc.commerce.settings.get.useQuery(
    undefined,
    { staleTime: 5 * 60_000 }
  );
  const role = user?.role === "seller" ? "seller" : "admin";
  const [preferences, setPreferences] = useState(() =>
    dashboardPreferencesForRole(role)
  );
  useEffect(() => {
    try {
      setPreferences(
        savedPreferences?.preferencesJson
          ? normalizeDashboardPreferences(
              JSON.parse(savedPreferences.preferencesJson),
              role
            )
          : dashboardPreferencesForRole(role)
      );
    } catch {
      setPreferences(dashboardPreferencesForRole(role));
    }
  }, [savedPreferences?.preferencesJson, role]);
  const summary = data?.summary;
  const revenue = summary?.monthlyRevenueCents ?? 0;
  const marginRate = revenue
    ? Math.round(((summary?.monthlyMarginCents ?? 0) / revenue) * 1000) / 10
    : 0;
  const todayCount = summary?.todaySaleCount ?? 0;
  const receivableCount = summary?.receivableCount ?? 0;
  const metrics: Array<{
    label: string;
    value: string;
    note: string;
    tone: "default" | "success" | "warning";
  }> = [
    {
      label: "Ventes du jour",
      value: formatCurrency(summary?.todayRevenueCents ?? 0),
      note: `${todayCount} vente${todayCount > 1 ? "s" : ""} encaissée${todayCount > 1 ? "s" : ""} aujourd’hui`,
      tone: "default",
    },
    {
      label: "Chiffre d’affaires du mois",
      value: formatCurrency(revenue),
      note: `${summary?.monthlyInvoiceCount ?? 0} ventes · panier moyen ${formatCurrency(summary?.averageBasketCents ?? 0)}`,
      tone: "default",
    },
    {
      label: "Marge du mois",
      value: formatCurrency(summary?.monthlyMarginCents ?? 0),
      note: `${marginRate.toLocaleString("fr-FR")} % du chiffre d’affaires`,
      tone: marginRate > 0 ? "success" : "default",
    },
    {
      label: "À encaisser",
      value: formatCurrency(summary?.receivableCents ?? 0),
      note: receivableCount
        ? `${receivableCount} facture${receivableCount > 1 ? "s" : ""} en attente de règlement`
        : "Aucune facture en attente",
      tone: receivableCount ? "warning" : "default",
    },
  ];
  const today = capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date())
  );
  const showTrend = preferences.salesTrend;
  const showTodo = preferences.todo;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">
            Bonjour{user?.name ? ` ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {today}
            {companySettings?.companyName
              ? ` · ${companySettings.companyName}`
              : ""}
          </p>
        </div>
        {preferences.hero && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button
              variant="outline"
              onClick={() => setLocation("/clients?nouveau=1")}
            >
              <UserPlus className="h-4 w-4" />
              Nouveau client
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/factures/nouvelle")}
            >
              <FilePlus2 className="h-4 w-4" />
              Nouvelle facture
            </Button>
            {can("sales.create") && (
              <Button
                onClick={() => setLocation("/pos")}
                className="col-span-2 h-11 sm:h-10"
              >
                <ShoppingCart className="h-4 w-4" />
                Vente rapide
              </Button>
            )}
          </div>
        )}
      </section>

      {isAdmin && <OnboardingStrip onNavigate={setLocation} />}

      {preferences.metrics && (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {metrics.map(metric => (
            <div
              key={metric.label}
              className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-3.5 py-3.5 sm:gap-1.5 sm:px-5 sm:py-[18px]"
            >
              <p className="truncate text-xs font-medium text-muted-foreground sm:text-[13px]">
                {metric.label}
              </p>
              {isLoading ? (
                <Skeleton className="h-8 w-36" />
              ) : (
                <p className="truncate text-lg font-bold leading-tight tracking-tight text-foreground sm:text-[26px]">
                  {metric.value}
                </p>
              )}
              <p
                className={`text-xs font-medium sm:text-[13px] ${metric.tone === "success" ? "text-success" : metric.tone === "warning" ? "text-warning" : "text-muted-foreground"}`}
              >
                {metric.note}
              </p>
            </div>
          ))}
        </section>
      )}

      {(showTrend || showTodo) && (
        <section
          className={`grid grid-cols-1 gap-4 ${showTrend && showTodo ? "lg:grid-cols-3" : ""}`}
        >
          {showTrend && (
            <div className={showTodo ? "min-w-0 lg:col-span-2" : "min-w-0"}>
              <SalesTrend data={data?.salesTrend ?? []} loading={isLoading} />
            </div>
          )}
          {showTodo && (
            <TodoPanel
              data={data}
              loading={isLoading}
              isAdmin={isAdmin}
              canSeeFinance={canSeeFinance}
              onNavigate={setLocation}
            />
          )}
        </section>
      )}

      {preferences.recentSales && (
        <RecentSales sales={data?.recentSales ?? []} onNavigate={setLocation} />
      )}

      {canSeeFinance && preferences.expenses && (
        <ExpenseSummary
          breakdown={summary?.expenseBreakdown ?? []}
          total={summary?.monthlyExpenseCents ?? 0}
          netProfit={summary?.monthlyOperatingProfitCents ?? 0}
          budget={summary?.expenseBudget}
          loading={isLoading}
          onNavigate={setLocation}
        />
      )}
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-border bg-card ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-[18px] pb-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {detail && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{detail}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function PanelLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-semibold text-primary hover:underline"
    >
      {children}
    </button>
  );
}

/** Démarrage guidé sur une ligne, affiché tant qu'il n'est pas terminé. */
function OnboardingStrip({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
  const { data: onboarding } = trpc.onboarding.status.useQuery();
  const complete = trpc.onboarding.complete.useMutation({
    onSuccess: () => window.location.reload(),
  });
  const skip = trpc.onboarding.skip.useMutation({
    onSuccess: () => window.location.reload(),
  });
  if (!onboarding || onboarding.completed) return null;
  const steps = [
    {
      key: "product" as const,
      label: "Premier produit",
      icon: Boxes,
      path: "/produits?nouveau=1",
    },
    {
      key: "customer" as const,
      label: "Premier client",
      icon: UserPlus,
      path: "/clients?nouveau=1",
    },
    {
      key: "paymentMethod" as const,
      label: "Moyen d’encaissement",
      icon: CreditCard,
      path: "/parametres/pos",
    },
  ];
  const done = steps.filter(step => onboarding.steps[step.key]).length;
  const pending = complete.isPending || skip.isPending;
  return (
    <Panel className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="min-w-0 lg:w-64">
        <p className="text-sm font-semibold text-foreground">
          Démarrage · {done} étape{done > 1 ? "s" : ""} sur {steps.length}
        </p>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          aria-label="Progression du démarrage"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-wrap gap-2">
        {steps.map(step => {
          const finished = onboarding.steps[step.key];
          const Icon = finished ? CheckCircle2 : step.icon;
          return (
            <button
              key={step.key}
              type="button"
              disabled={finished}
              onClick={() => onNavigate(step.path)}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors ${finished ? "border-success/25 bg-success-soft text-success" : "border-input bg-card text-foreground hover:bg-accent"}`}
            >
              <Icon className="h-4 w-4" />
              {step.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        {done === steps.length && (
          <Button
            size="sm"
            onClick={() => complete.mutate()}
            disabled={pending}
          >
            {complete.isPending ? "Finalisation…" : "Terminer"}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                "Ignorer définitivement l’assistant de démarrage pour cette entreprise ?"
              )
            )
              skip.mutate();
          }}
          className="text-muted-foreground"
        >
          Ignorer
        </Button>
      </div>
    </Panel>
  );
}

function SalesTrend({
  data,
  loading,
}: {
  data: Array<{ day: string; revenueCents: number }>;
  loading: boolean;
}) {
  const lastIndex = data.length - 1;
  const compact = new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const weekTotal = data.reduce((sum, item) => sum + item.revenueCents, 0);
  return (
    <Panel className="h-full">
      <PanelHeader
        title="Ventes des 7 derniers jours"
        detail={`${formatCurrency(weekTotal)} encaissés sur la période`}
      />
      <div className="h-[280px] px-3 pb-4 sm:px-5">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : data.some(item => item.revenueCents) ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 22, right: 4, left: 4 }}>
              <XAxis
                dataKey="day"
                tickFormatter={value =>
                  new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(
                    new Date(value)
                  )
                }
                tick={{ fill: "var(--faint)", fontSize: 12 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={chartTooltipStyle}
                labelFormatter={value => formatDate(String(value))}
                formatter={value => [formatCurrency(Number(value)), "Ventes"]}
              />
              <Bar dataKey="revenueCents" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {data.map((item, index) => (
                  <Cell
                    key={item.day}
                    fill={
                      index === lastIndex ? "var(--primary)" : "var(--chart-2)"
                    }
                  />
                ))}
                <LabelList
                  dataKey="revenueCents"
                  position="top"
                  formatter={(value: unknown) =>
                    Number(value) ? compact.format(Number(value) / 100) : ""
                  }
                  style={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon={Activity}
            title="Aucune vente sur la période"
            detail="Encaissez une première vente pour voir la tendance."
          />
        )}
      </div>
    </Panel>
  );
}

function TodoSection({
  title,
  count,
  tone,
  onOpen,
  children,
}: {
  title: string;
  count: string;
  tone: "warning" | "danger" | "info" | "neutral";
  onOpen: () => void;
  children?: ReactNode;
}) {
  const toneClass = {
    warning: "bg-warning-soft text-warning",
    danger: "bg-destructive-soft text-destructive",
    info: "bg-info-soft text-info",
    neutral: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-2 text-left"
      >
        <span className="flex-1 text-sm font-semibold text-foreground group-hover:text-primary">
          {title}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass}`}
        >
          {count}
        </span>
        <ChevronRight className="h-4 w-4 text-faint" />
      </button>
      {children && <div className="mt-2 space-y-1">{children}</div>}
    </div>
  );
}

/** Une seule liste de ce qui demande une action, chaque ligne menant à sa page. */
function TodoPanel({
  data,
  loading,
  isAdmin,
  canSeeFinance,
  onNavigate,
}: {
  data?: DashboardData;
  loading: boolean;
  isAdmin: boolean;
  canSeeFinance: boolean;
  onNavigate: (path: string) => void;
}) {
  const summary = data?.summary;
  const lowStock = data?.lowStock ?? [];
  const lowStockCount = summary?.activeAlerts ?? lowStock.length;
  const invoices = data?.unpaidInvoices ?? [];
  const receivableCount = summary?.receivableCount ?? invoices.length;
  const inventories = summary?.draftInventories ?? 0;
  const payroll = isAdmin ? (summary?.duePayrollCents ?? 0) : 0;
  const budget = canSeeFinance ? summary?.expenseBudget : undefined;
  const budgetAlert = budget?.exceeded || budget?.warningReached;
  const nothing =
    !lowStockCount &&
    !receivableCount &&
    !inventories &&
    !payroll &&
    !budgetAlert;
  return (
    <Panel className="h-full">
      <PanelHeader title="À traiter" />
      <div className="px-5 pb-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : nothing ? (
          <EmptyState
            icon={CheckCircle2}
            title="Tout est à jour"
            detail="Aucun stock bas ni facture en attente."
          />
        ) : (
          <>
            {lowStockCount > 0 && (
              <TodoSection
                title="Stock bas"
                count={`${lowStockCount} produit${lowStockCount > 1 ? "s" : ""}`}
                tone="danger"
                onOpen={() => onNavigate("/alertes")}
              >
                {lowStock.slice(0, 3).map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onNavigate(`/produits/${product.id}`)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-accent"
                  >
                    <ProductImage
                      product={product}
                      className="h-8 w-8 text-xs"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {product.name}
                    </span>
                    <StatusPill
                      tone={product.quantity <= 0 ? "danger" : "warning"}
                    >
                      {product.quantity <= 0
                        ? "Rupture"
                        : `${product.quantity} / ${product.minimumQuantity}`}
                    </StatusPill>
                  </button>
                ))}
              </TodoSection>
            )}
            {receivableCount > 0 && (
              <TodoSection
                title="Factures à encaisser"
                count={formatCurrency(summary?.receivableCents ?? 0)}
                tone="warning"
                onOpen={() => onNavigate("/factures")}
              >
                {invoices.slice(0, 3).map(invoice => (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() =>
                      onNavigate(`/factures?facture=${invoice.id}`)
                    }
                    className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-foreground">
                        {invoice.customerName}
                      </span>
                      <span className="block text-xs text-faint">
                        {invoice.invoiceNumber}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-foreground">
                      {formatCurrency(invoice.balanceCents)}
                    </span>
                  </button>
                ))}
              </TodoSection>
            )}
            {inventories > 0 && (
              <TodoSection
                title="Inventaires à finaliser"
                count={String(inventories)}
                tone="info"
                onOpen={() => onNavigate("/inventaires")}
              />
            )}
            {payroll > 0 && (
              <TodoSection
                title="Paie à régler"
                count={formatCurrency(payroll)}
                tone="neutral"
                onOpen={() => onNavigate("/agents")}
              />
            )}
            {budgetAlert && budget && (
              <TodoSection
                title={
                  budget.exceeded ? "Budget dépassé" : "Seuil budget atteint"
                }
                count={`${budget.percentUsed} %`}
                tone={budget.exceeded ? "danger" : "warning"}
                onOpen={() => onNavigate("/depenses")}
              />
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function RecentSales({
  sales,
  onNavigate,
}: {
  sales: Array<{
    id: number;
    invoiceNumber: string;
    customerName: string;
    totalCents: number;
    createdAt: Date | string;
    channel?: string;
  }>;
  onNavigate: (path: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Dernières ventes"
        action={
          <PanelLink onClick={() => onNavigate("/factures")}>
            Toutes les factures
          </PanelLink>
        }
      />
      {sales.length ? (
        <>
          <div className="px-4 pb-2 sm:hidden">
            {sales.map(sale => (
              <button
                key={sale.id}
                onClick={() => onNavigate(`/factures/${sale.id}`)}
                className="flex w-full items-center gap-3 border-t border-border py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-primary">
                    {sale.invoiceNumber}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-faint">
                    {sale.customerName} · {formatDate(sale.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(sale.totalCents)}
                  </span>
                  <StatusPill tone="success">Payée</StatusPill>
                </span>
              </button>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Numéro
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Client
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Statut
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-2.5 text-right font-semibold"
                  >
                    Montant TTC
                  </th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr
                    key={sale.id}
                    onClick={() => onNavigate(`/factures/${sale.id}`)}
                    className="cursor-pointer border-t border-border hover:bg-accent/60"
                  >
                    <td className="px-5 py-3 font-semibold text-primary">
                      {sale.invoiceNumber}
                    </td>
                    <td className="px-5 py-3 text-foreground">
                      {sale.customerName}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone="success">
                        {sale.channel === "pos" ? "Payée · caisse" : "Payée"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">
                      {formatCurrency(sale.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState
          icon={ReceiptText}
          title="Aucune vente pour le moment"
          detail="Les dernières transactions apparaîtront ici."
        />
      )}
    </Panel>
  );
}

/** Dépenses du mois en une carte : total, budget et premières catégories. */
function ExpenseSummary({
  breakdown,
  total,
  netProfit,
  budget,
  loading,
  onNavigate,
}: {
  breakdown: Array<{ category: string; amountCents: number }>;
  total: number;
  netProfit: number;
  budget?: {
    configured: boolean;
    budgetCents: number;
    percentUsed: number;
    warningReached: boolean;
    exceeded: boolean;
  };
  loading: boolean;
  onNavigate: (path: string) => void;
}) {
  const top = [...breakdown]
    .sort((left, right) => right.amountCents - left.amountCents)
    .slice(0, 3);
  const percent = budget?.percentUsed ?? 0;
  return (
    <Panel>
      <PanelHeader
        title="Dépenses du mois"
        action={
          <PanelLink onClick={() => onNavigate("/depenses")}>
            Voir les dépenses <ArrowRight className="inline h-3.5 w-3.5" />
          </PanelLink>
        }
      />
      {loading ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid gap-5 px-5 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-[26px] font-bold tracking-tight text-foreground">
                {formatCurrency(total)}
              </p>
              <p className="text-[13px] text-muted-foreground">
                Bénéfice net{" "}
                <span
                  className={`font-semibold ${netProfit < 0 ? "text-destructive" : "text-success"}`}
                >
                  {formatCurrency(netProfit)}
                </span>
              </p>
            </div>
            {budget?.configured ? (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${budget.exceeded ? "bg-destructive" : budget.warningReached ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-faint">
                  {percent} % du budget de {formatCurrency(budget.budgetCents)}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate("/depenses")}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
              >
                <Target className="h-3.5 w-3.5" />
                Fixer un budget mensuel
              </button>
            )}
          </div>
          {top.length ? (
            <div className="space-y-2.5">
              {top.map(item => (
                <div key={item.category}>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex items-center gap-2 text-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            expenseColors[item.category] ?? "#98A2B3",
                        }}
                      />
                      {expenseLabels[item.category] ?? item.category}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(item.amountCents)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${total ? Math.round((item.amountCents / total) * 100) : 0}%`,
                        backgroundColor:
                          expenseColors[item.category] ?? "#98A2B3",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">
              <WalletCards className="h-4 w-4 shrink-0" />
              Aucune dépense enregistrée ce mois-ci.
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
}) {
  return (
    <div className="grid min-h-[180px] place-items-center px-6 pb-6 text-center">
      <div>
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-faint">
          <Icon className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
