import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { formatCurrency } from "@/lib/format";
import { recommendedRestockQuantity, restockEstimateCents } from "@/lib/replenishmentRules";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCheck, CircleAlert, FileText, Printer, ShieldCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Alerts() {
  const [, setLocation] = useLocation();
  const { activeWarehouseId, activeWarehouse } = useActiveWarehouse();
  const { data: thresholdRows = [], isLoading } = trpc.warehouses.thresholds.list.useQuery({ warehouseId: activeWarehouseId ?? 0 }, { enabled: Boolean(activeWarehouseId) });
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const utils = trpc.useUtils();
  const acknowledge = trpc.warehouses.acknowledgeAlert.useMutation({ onSuccess: () => void utils.warehouses.thresholds.list.invalidate(), onError: () => undefined });
  const [orderOpen, setOrderOpen] = useState(false);
  const alerts = thresholdRows.filter(product => product.alert).sort((a, b) => (a.quantity - a.threshold) - (b.quantity - b.threshold));
  const orderLines = useMemo(() => alerts.map(product => ({
    ...product,
    id: product.productId,
    supplierName: suppliers.find(supplier => supplier.id === product.supplierId)?.name ?? "Fournisseur à définir",
    quantityToOrder: recommendedRestockQuantity(product.quantity, product.threshold),
    estimatedCents: restockEstimateCents(recommendedRestockQuantity(product.quantity, product.threshold), product.purchasePriceCents),
  })), [alerts, suppliers]);
  const total = orderLines.reduce((sum, line) => sum + line.estimatedCents, 0);
  const printOrder = () => {
    const content = `<h1>Bon de commande de réapprovisionnement</h1><p>Entrepôt : ${activeWarehouse?.name ?? ""}</p><p>Généré le ${new Date().toLocaleDateString("fr-FR")}</p><table border="1" cellpadding="8" cellspacing="0"><tr><th>Fournisseur</th><th>Produit</th><th>Référence</th><th>À commander</th><th>Estimation</th></tr>${orderLines.map(line => `<tr><td>${line.supplierName}</td><td>${line.name}</td><td>${line.reference}</td><td>${line.quantityToOrder} ${line.unit}</td><td>${formatCurrency(line.estimatedCents)}</td></tr>`).join("")}</table><p><b>Total estimé : ${formatCurrency(total)}</b></p>`;
    const popup = window.open("", "_blank", "width=820,height=720");
    if (!popup) return;
    popup.document.write(`<html><head><title>Bon de commande</title><style>body{font-family:Arial;padding:32px}table{width:100%;border-collapse:collapse}</style></head><body>${content}</body></html>`);
    popup.document.close(); popup.focus(); popup.print();
  };

  return <div className="mx-auto max-w-[1200px] space-y-6">
    <header><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Surveillance locale</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Alertes de seuil</h1><p className="mt-1.5 text-sm text-slate-400">Entrepôt actif : <span className="font-medium text-slate-200">{activeWarehouse?.name ?? "Chargement…"}</span></p></header>
    <Card className="border-amber-400/15 bg-gradient-to-r from-amber-400/[0.08] to-transparent shadow-none"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-300"><TriangleAlert className="h-5 w-5" /></span><div><p className="font-semibold text-amber-100">{alerts.length} alerte{alerts.length > 1 ? "s" : ""} active{alerts.length > 1 ? "s" : ""}</p><p className="mt-1 text-sm text-amber-100/60">Les alertes et seuils sont propres au dépôt actif.</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!alerts.length} onClick={() => setOrderOpen(true)} className="border-amber-300/30 text-amber-200"><FileText className="mr-2 h-4 w-4" />Bon de commande</Button><Button onClick={() => setLocation("/mouvements")} className="bg-amber-300 text-amber-950 hover:bg-amber-200">Créer une entrée <ArrowRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card>
    <Card className="border-white/[0.07] bg-[#111722] shadow-none"><CardContent className="p-0"><div className="divide-y divide-white/[0.06]">{isLoading ? <div className="px-6 py-12 text-center text-sm text-slate-500">Chargement des alertes…</div> : alerts.length ? alerts.map(product => { const gap = product.threshold - product.quantity; const urgency = product.alert?.urgency ?? "medium"; const coverage = product.alert?.coverageDays; const acknowledged = Boolean(product.alert?.acknowledgedAt); const urgencyLabel = urgency === "critical" ? "Critique" : urgency === "high" ? "Élevée" : "À surveiller"; return <div key={product.productId} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 place-items-center rounded-lg ${urgency === "critical" ? "bg-rose-400/10 text-rose-300" : urgency === "high" ? "bg-orange-400/10 text-orange-300" : "bg-amber-400/10 text-amber-300"}`}><CircleAlert className="h-4 w-4" /></span><span><p className="font-medium text-slate-100">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.reference} · {product.category}{coverage === null || coverage === undefined ? "" : ` · ${coverage} j de couverture`}</p></span></div><div className="flex flex-wrap items-center gap-3 sm:justify-end"><span className="text-right"><span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">Disponible</span><span className="mt-1 block text-sm font-semibold text-amber-300">{product.quantity} {product.unit}</span></span><span className="text-right"><span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">Seuil du dépôt</span><span className="mt-1 block text-sm text-slate-300">{product.threshold} {product.unit}</span></span><Badge className={`border-0 ${urgency === "critical" ? "bg-rose-400/10 text-rose-300" : urgency === "high" ? "bg-orange-400/10 text-orange-300" : "bg-amber-400/10 text-amber-300"}`}>{urgencyLabel}</Badge><Badge className="border-0 bg-rose-400/10 text-rose-300">Manque {gap}</Badge>{product.canAcknowledge && product.alert && <Button variant={acknowledged ? "outline" : "secondary"} size="sm" disabled={acknowledged || acknowledge.isPending} onClick={() => acknowledge.mutate({ alertId: product.alert!.id })} className={acknowledged ? "border-emerald-400/30 text-emerald-300" : "bg-primary text-primary-foreground"}><CheckCheck className="mr-2 h-4 w-4" />{acknowledged ? "Accusée" : "Accuser réception"}</Button>}</div></div>; }) : <div className="px-6 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-6 w-6" /></span><p className="mt-4 font-medium text-slate-200">Aucune rupture à anticiper</p><p className="mt-1 text-sm text-slate-500">Tous les niveaux du dépôt respectent leurs seuils configurés.</p></div>}</div></CardContent></Card>
    <Dialog open={orderOpen} onOpenChange={setOrderOpen}><DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#141b27] text-slate-100 sm:max-w-3xl"><DialogHeader><DialogTitle>Bon de commande de réapprovisionnement</DialogTitle></DialogHeader><p className="text-sm text-slate-400">Quantités proposées pour le dépôt actif.</p><div className="mt-2 divide-y divide-white/[0.07] rounded-xl border border-white/[0.08]">{orderLines.map(line => <div key={line.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1.2fr_1.5fr_auto_auto]"><span className="text-xs text-slate-500">{line.supplierName}</span><span className="font-medium">{line.name}<span className="ml-2 text-xs text-slate-500">{line.reference}</span></span><span className="text-amber-300">{line.quantityToOrder} {line.unit}</span><span className="text-right text-sm">{formatCurrency(line.estimatedCents)}</span></div>)}</div><p className="text-right text-lg font-semibold">Total estimé : {formatCurrency(total)}</p><DialogFooter><Button variant="ghost" onClick={() => setOrderOpen(false)}>Fermer</Button><Button onClick={printOrder} className="bg-primary text-primary-foreground"><Printer className="mr-2 h-4 w-4" />Imprimer</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
