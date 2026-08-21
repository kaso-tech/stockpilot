import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, formatSignedQuantity, movementLabels } from "@/lib/format";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Boxes,
  CircleAlert,
  PackagePlus,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocation } from "wouter";

const chartTooltipStyle = {
  background: "#131a26",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#e2e8f0",
  fontSize: "12px",
};

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.dashboard.get.useQuery();
  const isAdmin = user?.role === "admin";
  const summary = data?.summary;

  const cards = [
    { label: "Valeur de stock", value: formatCurrency(summary?.totalValueCents ?? 0), detail: "Valorisation au prix d’achat", icon: TrendingUp, color: "cyan" },
    { label: "Références actives", value: String(summary?.productCount ?? 0), detail: "Produits suivis dans le catalogue", icon: Boxes, color: "violet" },
    { label: "Alertes actives", value: String(summary?.activeAlerts ?? 0), detail: "Niveaux à surveiller", icon: BellRing, color: "amber" },
    { label: "Mouvements tracés", value: String(summary?.movementCount ?? 0), detail: "Sur les derniers mouvements", icon: Activity, color: "emerald" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
            <span className="text-xs font-medium text-slate-400">Espace opérationnel</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Vue d’ensemble</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-400">Suivez vos niveaux de stock et identifiez les actions prioritaires en un coup d’œil.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button onClick={() => setLocation("/produits")} variant="outline" className="h-10 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] hover:text-white">
              <PackagePlus className="mr-2 h-4 w-4" /> Nouveau produit
            </Button>
          )}
          <Button onClick={() => setLocation("/mouvements")} className="h-10 bg-cyan-400 text-slate-950 hover:bg-cyan-300">
            <ArrowUpRight className="mr-2 h-4 w-4" /> Enregistrer un mouvement
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;
          const colors: Record<string, string> = {
            cyan: "bg-cyan-400/10 text-cyan-300 ring-cyan-400/15",
            violet: "bg-violet-400/10 text-violet-300 ring-violet-400/15",
            amber: "bg-amber-400/10 text-amber-300 ring-amber-400/15",
            emerald: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/15",
          };
          return (
            <Card key={card.label} className="border-white/[0.07] bg-[#111722] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400">{card.label}</p>
                    {isLoading ? <Skeleton className="mt-3 h-8 w-24 bg-white/10" /> : <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{card.value}</p>}
                  </div>
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${colors[card.color]}`}><Icon className="h-5 w-5" /></span>
                </div>
                <p className="mt-4 text-xs text-slate-500">{card.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden border-white/[0.07] bg-[#111722] shadow-none">
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-6">
              <div>
                <p className="text-sm font-semibold text-white">Flux de stock</p>
                <p className="mt-1 text-xs text-slate-500">Entrées et sorties sur les sept derniers jours</p>
              </div>
              <Badge className="border border-cyan-400/15 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/10">7 jours</Badge>
            </div>
            <div className="h-[300px] p-4 sm:p-6">
              {data?.trend?.some(item => item.entries || item.exits) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="entries" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} /><stop offset="95%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
                      <linearGradient id="exits" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} /><stop offset="95%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" />
                    <XAxis dataKey="day" tickFormatter={value => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(value))} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} labelFormatter={value => formatDate(String(value))} />
                    <Area type="monotone" dataKey="entries" name="Entrées" stroke="#22d3ee" strokeWidth={2} fill="url(#entries)" />
                    <Area type="monotone" dataKey="exits" name="Sorties" stroke="#a78bfa" strokeWidth={2} fill="url(#exits)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center rounded-xl border border-dashed border-cyan-300/10 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.06),transparent_35%)] text-center">
                  <div>
                    <Activity className="mx-auto h-6 w-6 text-slate-600" />
                    <p className="mt-3 text-sm font-medium text-slate-300">Flux en attente de signal</p>
                    <p className="mt-1 text-xs text-slate-500">Tracez un premier mouvement pour activer la ligne de flux.</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.07] bg-[#111722] shadow-none">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
              <div><p className="text-sm font-semibold text-white">Seuils à surveiller</p><p className="mt-1 text-xs text-slate-500">Stock inférieur ou égal au minimum</p></div>
              <CircleAlert className="h-5 w-5 text-amber-300" />
            </div>
            <div className="divide-y divide-white/[0.06]">
              {data?.lowStock?.length ? data.lowStock.map(product => (
                <button key={product.id} onClick={() => setLocation("/alertes")} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.025]">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{product.name}</span><span className="mt-0.5 block text-xs text-slate-500">{product.reference}</span></span>
                  <span className="shrink-0 text-right"><span className="block text-sm font-semibold text-amber-300">{product.quantity} {product.unit}</span><span className="text-[11px] text-slate-500">Min. {product.minimumQuantity}</span></span>
                </button>
              )) : (
                <div className="px-5 py-10 text-center"><BellRing className="mx-auto h-6 w-6 text-emerald-400" /><p className="mt-3 text-sm font-medium text-slate-300">Aucune alerte active</p><p className="mt-1 text-xs text-slate-500">Vos seuils critiques sont sous contrôle.</p></div>
              )}
            </div>
            {data?.lowStock?.length ? <Button onClick={() => setLocation("/alertes")} variant="ghost" className="m-3 w-[calc(100%-1.5rem)] text-slate-300 hover:bg-white/[0.06] hover:text-white">Voir toutes les alertes <ArrowDownRight className="ml-2 h-4 w-4" /></Button> : null}
          </CardContent>
        </Card>
      </section>

      <Card className="border-white/[0.07] bg-[#111722] shadow-none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5 sm:px-6"><div><p className="text-sm font-semibold text-white">Derniers mouvements</p><p className="mt-1 text-xs text-slate-500">Traçabilité des opérations récentes</p></div><Button onClick={() => setLocation("/mouvements")} variant="ghost" className="text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200">Ouvrir le registre</Button></div>
          {data?.recentMovements?.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-white/[0.018] text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-6 py-3">Produit</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Quantité</th><th className="px-4 py-3">Motif</th><th className="px-6 py-3 text-right">Date</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data.recentMovements.map(movement => <tr key={movement.id} className="text-sm"><td className="px-6 py-4"><p className="font-medium text-slate-200">{movement.productName}</p><p className="mt-0.5 text-xs text-slate-500">{movement.productReference}</p></td><td className="px-4 py-4"><Badge className={`border-0 ${movement.type === "entry" ? "bg-emerald-400/10 text-emerald-300" : movement.type === "exit" ? "bg-rose-400/10 text-rose-300" : "bg-violet-400/10 text-violet-300"}`}>{movementLabels[movement.type]}</Badge></td><td className={`px-4 py-4 font-semibold ${movement.quantity >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSignedQuantity(movement.quantity)}</td><td className="max-w-[280px] truncate px-4 py-4 text-slate-400">{movement.reason}</td><td className="px-6 py-4 text-right text-xs text-slate-500">{formatDate(movement.occurredAt, true)}</td></tr>)}</tbody></table></div>
          ) : <div className="px-6 py-12 text-center text-sm text-slate-500">Les mouvements de stock apparaîtront ici après leur enregistrement.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
