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
  // Même règle que l'accueil : sous le seuil de l'entrepôt (ou, à défaut, le seuil minimum du produit).
  const alerts = thresholdRows.filter(product => product.alert || product.low).map(product => ({ ...product, threshold: product.effectiveThreshold || product.threshold })).sort((a, b) => (a.quantity - a.threshold) - (b.quantity - b.threshold));
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
    <header><h1 className="text-[22px] font-bold tracking-tight text-foreground">Alertes de seuil</h1><p className="mt-0.5 text-[13px] text-muted-foreground">Entrepôt actif : <span className="font-medium text-foreground">{activeWarehouse?.name ?? "Chargement…"}</span></p></header>
    <Card className="border-warning/25 bg-gradient-to-r to-transparent shadow-none gap-0 py-0"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning "><TriangleAlert className="h-5 w-5" /></span><div><p className="font-semibold text-warning ">{alerts.length} alerte{alerts.length > 1 ? "s" : ""} active{alerts.length > 1 ? "s" : ""}</p><p className="mt-1 text-sm text-warning ">Les alertes et seuils sont propres au dépôt actif.</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!alerts.length} onClick={() => setOrderOpen(true)} className="border-warning/40 text-warning hover:bg-warning-soft "><FileText className="mr-2 h-4 w-4" />Bon de commande</Button><Button onClick={() => setLocation("/mouvements")} className="bg-primary text-primary-foreground hover:bg-primary/90">Créer une entrée <ArrowRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card>
    <Card className="border-border bg-card shadow-none gap-0 py-0"><CardContent className="p-0"><div className="divide-y divide-border">{isLoading ? <div className="px-6 py-12 text-center text-sm text-faint">Chargement des alertes…</div> : alerts.length ? alerts.map(product => { const gap = product.threshold - product.quantity; const urgency = product.alert?.urgency ?? "medium"; const coverage = product.alert?.coverageDays; const acknowledged = Boolean(product.alert?.acknowledgedAt); const urgencyLabel = urgency === "critical" ? "Critique" : urgency === "high" ? "Élevée" : "À surveiller"; return <div key={product.productId} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-8 w-8 place-items-center rounded-lg ${urgency === "critical" ? "bg-destructive-soft text-destructive " : urgency === "high" ? "bg-warning-soft text-warning " : "bg-warning-soft text-warning "}`}><CircleAlert className="h-4 w-4" /></span><span><p className="font-medium text-foreground">{product.name}</p><p className="mt-1 text-xs text-faint">{product.reference} · {product.category}{coverage === null || coverage === undefined ? "" : ` · ${coverage} j de couverture`}</p></span></div><div className="flex flex-wrap items-center gap-3 sm:justify-end"><span className="text-right"><span className="block text-xs font-semibold text-muted-foreground">Disponible</span><span className="mt-1 block text-sm font-semibold text-warning ">{product.quantity} {product.unit}</span></span><span className="text-right"><span className="block text-xs font-semibold text-muted-foreground">Seuil du dépôt</span><span className="mt-1 block text-sm text-muted-foreground">{product.threshold} {product.unit}</span></span><Badge className={`border-0 ${urgency === "critical" ? "bg-destructive-soft text-destructive " : urgency === "high" ? "bg-warning-soft text-warning " : "bg-warning-soft text-warning "}`}>{urgencyLabel}</Badge><Badge className="border-0 bg-destructive-soft text-destructive ">Manque {gap}</Badge>{product.canAcknowledge && product.alert && <Button variant={acknowledged ? "outline" : "secondary"} size="sm" disabled={acknowledged || acknowledge.isPending} onClick={() => acknowledge.mutate({ alertId: product.alert!.id })} className={acknowledged ? "border-success/25 text-success " : "bg-primary text-primary-foreground"}><CheckCheck className="mr-2 h-4 w-4" />{acknowledged ? "Accusée" : "Accuser réception"}</Button>}</div></div>; }) : <div className="px-6 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-success-soft text-success"><ShieldCheck className="h-6 w-6" /></span><p className="mt-4 font-medium text-foreground">Aucune rupture à anticiper</p><p className="mt-1 text-sm text-faint">Tous les niveaux du dépôt respectent leurs seuils configurés.</p></div>}</div></CardContent></Card>
    <Dialog open={orderOpen} onOpenChange={setOrderOpen}><DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-popover text-foreground sm:max-w-3xl"><DialogHeader><DialogTitle>Bon de commande de réapprovisionnement</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Quantités proposées pour le dépôt actif.</p><div className="mt-2 divide-y divide-border rounded-xl border border-border">{orderLines.map(line => <div key={line.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1.2fr_1.5fr_auto_auto]"><span className="text-xs text-faint">{line.supplierName}</span><span className="font-medium">{line.name}<span className="ml-2 text-xs text-faint">{line.reference}</span></span><span className="text-warning">{line.quantityToOrder} {line.unit}</span><span className="text-right text-sm">{formatCurrency(line.estimatedCents)}</span></div>)}</div><p className="text-right text-lg font-semibold">Total estimé : {formatCurrency(total)}</p><DialogFooter><Button variant="ghost" onClick={() => setOrderOpen(false)}>Fermer</Button><Button onClick={printOrder} className="bg-primary text-primary-foreground"><Printer className="mr-2 h-4 w-4" />Imprimer</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
