import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill, type StatusTone } from "@/components/StatusPill";
import { ProductImage } from "@/components/ProductImage";
import {
  dashboardPreferencesForRole,
  normalizeDashboardPreferences,
} from "@/lib/dashboardPreferences";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  BellRing,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--popover-foreground)",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgb(var(--shadow-color) / 0.08)",
};
const expenseLabels: Record<string, string> = {
  rent: "Loyer",
  energy: "Énergie",
  connection: "Connexion",
  salary: "Salaire",
  agent_payments: "Paiements agents",
  marketing: "Marketing",
  supplies: "Fournitures",
  taxes: "Impôts",
  other: "Autre",
};
/** Palette catégorielle sobre, lisible en clair comme en sombre. */
const expenseColors: Record<string, string> = {
  rent: "#0B6E76",
  energy: "#1D4ED8",
  connection: "#7C3AED",
  salary: "#B54708",
  agent_payments: "#E8853D",
  marketing: "#C11574",
  supplies: "#157F4F",
  taxes: "#B42318",
  other: "#98A2B3",
};
const toneIcon: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  info: "bg-info-soft text-info",
  neutral: "bg-muted text-muted-foreground",
};

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
  const { data: onboarding, isLoading: onboardingLoading } =
    trpc.onboarding.status.useQuery(undefined, { enabled: isAdmin });
  const onboardingComplete = trpc.onboarding.complete.useMutation({
    onSuccess: () => window.location.reload(),
  });
  const onboardingSkip = trpc.onboarding.skip.useMutation({
    onSuccess: () => window.location.reload(),
  });
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
  const priorities = [
    {
      label: "Stock critique",
      count: summary?.activeAlerts ?? 0,
      detail: "référence(s) au seuil",
      icon: BellRing,
      path: "/alertes",
      tone: "warning" as StatusTone,
      currency: false,
    },
    {
      label: "Inventaires ouverts",
      count: summary?.draftInventories ?? 0,
      detail: "session(s) à finaliser",
      icon: ClipboardCheck,
      path: "/inventaires",
      tone: "info" as StatusTone,
      currency: false,
    },
    ...(isAdmin
      ? [
          {
            label: "Paie à régler",
            count: summary?.duePayrollCents ?? 0,
            detail: "solde de la période",
            icon: WalletCards,
            path: "/agents",
            tone: "neutral" as StatusTone,
            currency: true,
          },
          {
            label: "Dépenses du mois",
            count: summary?.monthlyExpenseCents ?? 0,
            detail: `dont paie ${formatCurrency(summary?.monthlyAgentPaymentCents ?? 0)}`,
            icon: WalletCards,
            path: "/depenses",
            tone: "neutral" as StatusTone,
            currency: true,
          },
        ]
      : []),
  ];
  const today = capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date())
  );

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

      {isAdmin && !onboardingLoading && onboarding && !onboarding.completed && (
        <Panel>
          <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                Démarrage guidé
              </p>
              <h2 className="mt-1.5 text-base font-semibold text-foreground">
                Préparez votre espace pour la première vente
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Renseignez les trois éléments essentiels. Votre progression est
                mémorisée automatiquement.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[620px]">
              {[
                {
                  key: "product",
                  label: "Premier produit",
                  detail: "Ajoutez une référence",
                  icon: Boxes,
                  path: "/produits?nouveau=1",
                },
                {
                  key: "customer",
                  label: "Premier client",
                  detail: "Créez une fiche client",
                  icon: UserPlus,
                  path: "/clients?nouveau=1",
                },
                {
                  key: "paymentMethod",
                  label: "Encaissement",
                  detail: "Activez un moyen",
                  icon: CreditCard,
                  path: "/parametres/pos",
                },
              ].map(step => {
                const done =
                  onboarding.steps[step.key as keyof typeof onboarding.steps];
                const Icon = step.icon;
                return (
                  <button
                    key={step.key}
                    onClick={() => (done ? undefined : setLocation(step.path))}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${done ? "border-success/25 bg-success-soft" : "border-border bg-card hover:border-primary/40 hover:bg-accent"}`}
                  >
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-lg ${done ? "bg-card text-success" : "bg-primary-soft text-primary"}`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {step.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {done ? "Terminé" : step.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">
            {onboarding.steps.product &&
              onboarding.steps.customer &&
              onboarding.steps.paymentMethod && (
                <Button
                  onClick={() => onboardingComplete.mutate()}
                  disabled={
                    onboardingComplete.isPending || onboardingSkip.isPending
                  }
                >
                  {onboardingComplete.isPending
                    ? "Finalisation…"
                    : "Terminer la configuration"}
                </Button>
              )}
            <Button
              variant="ghost"
              onClick={() => {
                if (
                  window.confirm(
                    "Ignorer définitivement l’assistant de démarrage pour cette entreprise ?"
                  )
                )
                  onboardingSkip.mutate();
              }}
              disabled={
                onboardingComplete.isPending || onboardingSkip.isPending
              }
              className="text-muted-foreground"
            >
              {onboardingSkip.isPending ? "Ignoré…" : "Ignorer définitivement"}
            </Button>
          </div>
        </Panel>
      )}

      {preferences.metrics && (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
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

      {(preferences.salesTrend || preferences.lowStock) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
          {preferences.salesTrend && (
            <SalesTrend data={data?.salesTrend ?? []} loading={isLoading} />
          )}
          {preferences.lowStock && (
            <LowStock
              products={data?.lowStock ?? []}
              stockValue={summary?.totalValueCents ?? 0}
              productCount={summary?.productCount ?? 0}
              onNavigate={setLocation}
            />
          )}
        </section>
      )}

      {preferences.recentSales && (
        <RecentSales sales={data?.recentSales ?? []} onNavigate={setLocation} />
      )}

      {(preferences.unpaidInvoices || preferences.priorities) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
          {preferences.unpaidInvoices && (
            <OutstandingInvoices
              invoices={data?.unpaidInvoices ?? []}
              onNavigate={setLocation}
            />
          )}
          {preferences.priorities && (
            <PriorityList priorities={priorities} onNavigate={setLocation} />
          )}
        </section>
      )}

      {canSeeFinance && (preferences.expenses || preferences.budget) && (
        <section
          className={`grid grid-cols-1 gap-4 ${preferences.expenses && preferences.budget ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}
        >
          {preferences.expenses && (
            <ExpenseChart
              breakdown={summary?.expenseBreakdown ?? []}
              total={summary?.monthlyExpenseCents ?? 0}
              netProfit={summary?.monthlyOperatingProfitCents ?? 0}
              loading={isLoading}
            />
          )}
          {preferences.budget && (
            <BudgetPanel budget={summary?.expenseBudget} loading={isLoading} />
          )}
        </section>
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
  return (
    <Panel>
      <PanelHeader
        title="Ventes des 7 derniers jours"
        detail="Chiffre d’affaires encaissé, par jour"
      />
      <div className="h-[260px] px-3 pb-4 sm:px-5">
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
                contentStyle={tooltipStyle}
                labelFormatter={value => formatDate(String(value))}
                formatter={value => [formatCurrency(Number(value)), "Ventes"]}
              />
              <Bar dataKey="revenueCents" radius={[6, 6, 0, 0]} maxBarSize={40}>
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

function LowStock({
  products,
  stockValue,
  productCount,
  onNavigate,
}: {
  products: Array<{
    id: number;
    name: string;
    reference: string;
    quantity: number;
    unit: string;
    minimumQuantity: number;
    imageUrl?: string | null;
    imageThumbUrl?: string | null;
  }>;
  stockValue: number;
  productCount: number;
  onNavigate: (path: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Stock à surveiller"
        detail={`Valeur du stock ${formatCurrency(stockValue)} · ${productCount} références`}
        action={
          products.length ? (
            <PanelLink onClick={() => onNavigate("/bons-commande")}>
              Préparer une commande
            </PanelLink>
          ) : undefined
        }
      />
      {products.length ? (
        <div className="px-5 pb-2">
          {products.map(product => (
            <button
              key={product.id}
              onClick={() => onNavigate(`/produits/${product.id}`)}
              className="flex w-full items-center gap-3 border-t border-border py-2.5 text-left hover:bg-accent/60"
            >
              <ProductImage product={product} className="h-9 w-9 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {product.name}
                </span>
                <span className="mt-0.5 block text-xs text-faint">
                  {product.reference} · seuil {product.minimumQuantity}
                </span>
              </span>
              <StatusPill tone={product.quantity <= 0 ? "danger" : "warning"}>
                {product.quantity <= 0
                  ? "Rupture"
                  : `${product.quantity} ${product.unit}`}
              </StatusPill>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BellRing}
          title="Aucune alerte active"
          detail="Tous les produits sont au-dessus de leur seuil."
        />
      )}
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

function OutstandingInvoices({
  invoices,
  onNavigate,
}: {
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    customerName: string;
    balanceCents: number;
    status: string;
    createdAt: Date | string;
  }>;
  onNavigate: (path: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Factures à encaisser"
        detail="Soldes en attente de règlement"
        action={
          <PanelLink onClick={() => onNavigate("/factures")}>
            Voir tout
          </PanelLink>
        }
      />
      {invoices.length ? (
        <div className="px-5 pb-2">
          {invoices.map(invoice => (
            <button
              key={invoice.id}
              onClick={() => onNavigate(`/factures?facture=${invoice.id}`)}
              className="flex w-full items-center gap-3 border-t border-border py-2.5 text-left hover:bg-accent/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {invoice.invoiceNumber}
                </span>
                <span className="mt-0.5 block truncate text-xs text-faint">
                  {invoice.customerName} · {formatDate(invoice.createdAt)}
                </span>
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(invoice.balanceCents)}
              </span>
              <StatusPill
                tone={invoice.status === "partial" ? "warning" : "info"}
              >
                {invoice.status === "partial" ? "Partielle" : "À encaisser"}
              </StatusPill>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ReceiptText}
          title="Aucune facture impayée"
          detail="Les soldes à encaisser apparaîtront ici."
        />
      )}
    </Panel>
  );
}

function PriorityList({
  priorities,
  onNavigate,
}: {
  priorities: Array<{
    label: string;
    count: number;
    detail: string;
    icon: typeof BellRing;
    path: string;
    tone: StatusTone;
    currency: boolean;
  }>;
  onNavigate: (path: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader title="Priorités" detail="Ce qui demande une action" />
      <div className="px-5 pb-2">
        {priorities.map(priority => {
          const Icon = priority.icon;
          return (
            <button
              key={priority.label}
              onClick={() => onNavigate(priority.path)}
              className="flex w-full items-center gap-3 border-t border-border py-2.5 text-left hover:bg-accent/60"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneIcon[priority.tone]}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {priority.label}
                </span>
                <span className="block text-xs text-faint">
                  {priority.detail}
                </span>
              </span>
              <span className="text-sm font-semibold text-foreground">
                {priority.currency
                  ? formatCurrency(priority.count)
                  : priority.count}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function ExpenseChart({
  breakdown,
  total,
  netProfit,
  loading,
}: {
  breakdown: Array<{ category: string; amountCents: number }>;
  total: number;
  netProfit: number;
  loading: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Répartition des dépenses"
        detail="Charges d’exploitation et paiements agents du mois"
        action={
          <span className="text-[13px] text-muted-foreground">
            Bénéfice net{" "}
            <span
              className={`font-semibold ${netProfit < 0 ? "text-destructive" : "text-success"}`}
            >
              {formatCurrency(netProfit)}
            </span>
          </span>
        }
      />
      {loading ? (
        <div className="h-[280px] p-5">
          <Skeleton className="h-full w-full" />
        </div>
      ) : breakdown.length ? (
        <div className="grid gap-5 px-5 pb-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
          <div className="relative h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="amountCents"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={66}
                  outerRadius={96}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {breakdown.map(item => (
                    <Cell
                      key={item.category}
                      fill={expenseColors[item.category] ?? "#98A2B3"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={value => formatCurrency(Number(value))}
                  labelFormatter={label =>
                    expenseLabels[String(label)] ?? String(label)
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-xs text-faint">Total</p>
                <p className="mt-0.5 text-base font-semibold text-foreground">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {breakdown.map(item => (
              <div
                key={item.category}
                className="flex items-center justify-between gap-3 border-t border-border py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        expenseColors[item.category] ?? "#98A2B3",
                    }}
                  />
                  {expenseLabels[item.category] ?? item.category}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="font-semibold text-foreground">
                    {formatCurrency(item.amountCents)}
                  </span>
                  <span className="ml-2 text-xs text-faint">
                    {total ? Math.round((item.amountCents / total) * 100) : 0} %
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={WalletCards}
          title="Aucune dépense ce mois-ci"
          detail="Les catégories apparaîtront ici après l’enregistrement de charges."
        />
      )}
    </Panel>
  );
}

function BudgetPanel({
  budget,
  loading,
}: {
  budget?: {
    configured: boolean;
    budgetCents: number;
    spentCents: number;
    remainingCents: number;
    percentUsed: number;
    warningPercent: number;
    warningReached: boolean;
    exceeded: boolean;
  };
  loading: boolean;
}) {
  if (loading)
    return (
      <Panel className="min-h-[260px] p-5">
        <Skeleton className="h-full min-h-[220px] w-full" />
      </Panel>
    );
  const configured = budget?.configured ?? false;
  const percent = budget?.percentUsed ?? 0;
  const warning = budget?.warningReached ?? false;
  const exceeded = budget?.exceeded ?? false;
  return (
    <Panel>
      <PanelHeader title="Budget dépenses" detail="Suivi du mois en cours" />
      {configured ? (
        <div className="px-5 pb-5">
          <p className="text-[26px] font-bold tracking-tight text-foreground">
            {formatCurrency(budget!.budgetCents)}
          </p>
          <p
            className={`mt-1 text-[13px] font-medium ${exceeded ? "text-destructive" : warning ? "text-warning" : "text-muted-foreground"}`}
          >
            {exceeded
              ? `Dépassement de ${formatCurrency(Math.abs(budget!.remainingCents))}`
              : warning
                ? `Seuil d’alerte (${budget!.warningPercent} %) atteint`
                : `${formatCurrency(budget!.remainingCents)} restant`}
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${exceeded ? "bg-destructive" : warning ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <span className="text-faint">
              {formatCurrency(budget!.spentCents)} consommés
            </span>
            <span className="font-semibold text-foreground">{percent} %</span>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="Budget non défini"
          detail="Fixez un plafond mensuel dans Dépenses."
        />
      )}
    </Panel>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof BellRing;
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
