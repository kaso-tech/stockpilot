import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { escapeHtml } from "@/lib/html";
import {
  recommendedRestockQuantity,
  restockEstimateCents,
} from "@/lib/replenishmentRules";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  CircleAlert,
  FileText,
  Printer,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

export default function Alerts() {
  const [, setLocation] = useLocation();
  const { data: products = [], isLoading } = trpc.products.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const [orderOpen, setOrderOpen] = useState(false);
  const alerts = products
    .filter(product => product.quantity <= product.minimumQuantity)
    .sort(
      (a, b) =>
        a.quantity - a.minimumQuantity - (b.quantity - b.minimumQuantity)
    );
  const orderLines = useMemo(
    () =>
      alerts.map(product => ({
        ...product,
        supplierName:
          suppliers.find(supplier => supplier.id === product.supplierId)
            ?.name ?? "Fournisseur à définir",
        quantityToOrder: recommendedRestockQuantity(
          product.quantity,
          product.minimumQuantity
        ),
        estimatedCents: restockEstimateCents(
          recommendedRestockQuantity(product.quantity, product.minimumQuantity),
          product.purchasePriceCents
        ),
      })),
    [alerts, suppliers]
  );
  const total = orderLines.reduce((sum, line) => sum + line.estimatedCents, 0);
  const printOrder = () => {
    const content = `<h1>Bon de commande de réapprovisionnement</h1><p>Généré le ${new Date().toLocaleDateString("fr-FR")}</p><table border="1" cellpadding="8" cellspacing="0"><tr><th>Fournisseur</th><th>Produit</th><th>Référence</th><th>À commander</th><th>Estimation</th></tr>${orderLines.map(line => `<tr><td>${escapeHtml(line.supplierName)}</td><td>${escapeHtml(line.name)}</td><td>${escapeHtml(line.reference)}</td><td>${line.quantityToOrder} ${escapeHtml(line.unit)}</td><td>${formatCurrency(line.estimatedCents)}</td></tr>`).join("")}</table><p><b>Total estimé : ${formatCurrency(total)}</b></p>`;
    const popup = window.open("", "_blank", "width=820,height=720");
    if (!popup) return;
    popup.document.write(
      `<html><head><title>Bon de commande</title><style>body{font-family:Arial;padding:32px}table{width:100%;border-collapse:collapse}</style></head><body>${content}</body></html>`
    );
    popup.document.close();
    popup.focus();
    popup.print();
  };
  const { data: expiringLots = [] } = trpc.warehouses.expiringLots.useQuery({
    days: 30,
  });
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
          Surveillance
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Alertes de seuil
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Les alertes s’actualisent dès qu’un niveau de stock atteint ou descend
          sous son seuil personnalisé.
        </p>
      </header>
      {expiringLots.length > 0 && (
        <Link
          href="/depots"
          className="block rounded-xl border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm text-destructive hover:bg-destructive-soft"
        >
          {expiringLots.length} lot(s) périmé(s) ou à péremption sous 30 jours :{" "}
          {expiringLots
            .slice(0, 3)
            .map(
              lot =>
                `${lot.productName} (lot ${lot.lotNumber}, ${lot.expiryDate})`
            )
            .join(", ")}
          {expiringLots.length > 3 ? "…" : ""} — voir les dépôts →
        </Link>
      )}
      <Card className="border-warning/25 bg-gradient-to-r to-transparent shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
              <TriangleAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-warning">
                {alerts.length} alerte{alerts.length > 1 ? "s" : ""} active
                {alerts.length > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-sm text-warning">
                Priorisez les produits les plus proches de la rupture afin de
                limiter les indisponibilités.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!alerts.length}
              onClick={() => setOrderOpen(true)}
              className="border-warning/25 text-warning"
            >
              <FileText className="mr-2 h-4 w-4" />
              Bon de commande
            </Button>
            <Button
              onClick={() => setLocation("/mouvements")}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Créer une entrée <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="px-6 py-12 text-center text-sm text-faint">
                Chargement des alertes…
              </div>
            ) : alerts.length ? (
              alerts.map(product => {
                const gap = product.minimumQuantity - product.quantity;
                return (
                  <div
                    key={product.id}
                    className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-warning-soft text-warning">
                        <CircleAlert className="h-4 w-4" />
                      </span>
                      <span>
                        <p className="font-medium text-foreground">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs text-faint">
                          {product.reference} · {product.category}
                        </p>
                      </span>
                    </div>
                    <div className="flex items-center gap-6 sm:gap-10">
                      <span className="text-right">
                        <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
                          Disponible
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-warning">
                          {product.quantity} {product.unit}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
                          Seuil personnalisé
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {product.minimumQuantity} {product.unit}
                        </span>
                      </span>
                      <Badge className="border-0 bg-destructive-soft text-destructive">
                        Manque {gap}
                      </Badge>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-16 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-success-soft text-success">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <p className="mt-4 font-medium text-foreground">
                  Aucune rupture à anticiper
                </p>
                <p className="mt-1 text-sm text-faint">
                  Tous vos niveaux de stock respectent les seuils configurés.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card text-foreground sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bon de commande de réapprovisionnement</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Quantités proposées pour repasser au-dessus du seuil personnalisé de
            chaque produit.
          </p>
          <div className="mt-2 divide-y divide-border rounded-xl border border-border">
            {orderLines.map(line => (
              <div
                key={line.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[1.2fr_1.5fr_auto_auto]"
              >
                <span className="text-xs text-faint">{line.supplierName}</span>
                <span className="font-medium">
                  {line.name}
                  <span className="ml-2 text-xs text-faint">
                    {line.reference}
                  </span>
                </span>
                <span className="text-warning">
                  {line.quantityToOrder} {line.unit}
                </span>
                <span className="text-right text-sm">
                  {formatCurrency(line.estimatedCents)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-right text-lg font-semibold">
            Total estimé : {formatCurrency(total)}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOrderOpen(false)}>
              Fermer
            </Button>
            <Button
              onClick={printOrder}
              className="bg-primary text-primary-foreground"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
