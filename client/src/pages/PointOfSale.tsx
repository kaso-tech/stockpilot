import { BarcodeCameraDialog } from "@/components/BarcodeCameraDialog";
import { computeVatBreakdown, vatRatesLabel } from "@shared/pricing";
import {
  calculateDiscount,
  DiscountEditor,
  discountPayload,
  noDiscount,
  type DiscountForm,
} from "@/components/DiscountEditor";
import { CheckoutSheet } from "@/components/CheckoutSheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import {
  isCheckoutShortcut,
  stockAfterCartSelection,
} from "@/lib/posCartRules";
import { priceForQuantityTier } from "@/lib/priceTiers";
import {
  recommendedRestockQuantity,
  restockEstimateCents,
} from "@/lib/replenishmentRules";
import { trpc } from "@/lib/trpc";
import { useOffline, type OfflinePosDraft } from "@/contexts/OfflineContext";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Keyboard,
  Minus,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CartItem = { productId: number; quantity: number; discount: DiscountForm };
type PurchaseItem = {
  id: number;
  name: string;
  reference: string;
  unit: string;
  quantity: number;
  minimumQuantity: number;
  quantityToOrder: number;
  supplierId: number | null;
  supplierName: string;
  estimateCents: number;
};
type CheckoutSale = {
  id: number | null;
  totalCents: number;
  invoiceNumber: string;
  channel: "pos";
  offlineDraft?: OfflinePosDraft;
};

export default function PointOfSale() {
  const utils = trpc.useUtils();
  const { isOnline, pendingProductQuantities } = useOffline();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: agents = [] } = trpc.commerce.agents.list.useQuery();
  const { data: settings } = trpc.commerce.settings.get.useQuery();
  const [query, setQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const [purchaseListOpen, setPurchaseListOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  // Sur téléphone, le panier reste replié en barre de total pour laisser la place aux produits.
  const [cartCollapsed, setCartCollapsed] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [invoiceDiscount, setInvoiceDiscount] =
    useState<DiscountForm>(noDiscount);
  const [checkoutSale, setCheckoutSale] = useState<CheckoutSale | null>(null);

  const isLowStock = useCallback(
    (product: (typeof products)[number]) =>
      stockAfterCartSelection(product.quantity, 0, product.minimumQuantity)
        .isLowStock,
    []
  );
  const available = useMemo(
    () =>
      products.filter(product => {
        const matchesSearch = [product.name, product.reference].some(value =>
          value.toLowerCase().includes(query.toLowerCase())
        );
        return (
          product.quantity - (pendingProductQuantities[product.id] ?? 0) > 0 &&
          matchesSearch &&
          (categoryId === null || product.categoryId === categoryId) &&
          (!lowStockOnly || isLowStock(product))
        );
      }),
    [
      categoryId,
      isLowStock,
      lowStockOnly,
      pendingProductQuantities,
      products,
      query,
    ]
  );
  const purchaseItems = useMemo<PurchaseItem[]>(() => {
    if (!lowStockOnly) return [];
    return available.filter(isLowStock).map(product => {
      const quantityToOrder = recommendedRestockQuantity(
        product.quantity,
        product.minimumQuantity
      );
      return {
        id: product.id,
        name: product.name,
        reference: product.reference,
        unit: product.unit,
        quantity: product.quantity,
        minimumQuantity: product.minimumQuantity,
        quantityToOrder,
        supplierId: product.supplierId,
        supplierName:
          suppliers.find(supplier => supplier.id === product.supplierId)
            ?.name ?? "Fournisseur non assigné",
        estimateCents: restockEstimateCents(
          quantityToOrder,
          product.purchasePriceCents
        ),
      };
    });
  }, [available, lowStockOnly, suppliers, isLowStock]);
  const purchaseGroups = useMemo(() => {
    return purchaseItems.reduce<
      Array<{ supplierName: string; items: PurchaseItem[] }>
    >((groups, item) => {
      const group = groups.find(
        candidate => candidate.supplierName === item.supplierName
      );
      if (group) group.items.push(item);
      else groups.push({ supplierName: item.supplierName, items: [item] });
      return groups;
    }, []);
  }, [purchaseItems]);
  const purchaseTotalCents = purchaseItems.reduce(
    (sum, item) => sum + item.estimateCents,
    0
  );
  const lines = cart
    .map(item => {
      const product = products.find(value => value.id === item.productId);
      if (!product) return null;
      const pricing = priceForQuantityTier(
        product.retailPriceCents,
        item.quantity,
        product.retailPriceTiers ?? product.priceTiers
      );
      const subtotalCents = pricing.unitPriceCents * item.quantity;
      const discountCents = calculateDiscount(subtotalCents, item.discount);
      const { remainingAfterSale, isLowStock: lineIsLowStock } =
        stockAfterCartSelection(
          product.quantity,
          item.quantity,
          product.minimumQuantity
        );
      return {
        ...item,
        product,
        unitPriceCents: pricing.unitPriceCents,
        tierMinQuantity: pricing.tierMinQuantity,
        subtotalCents,
        discountCents,
        totalCents: subtotalCents - discountCents,
        remainingAfterSale,
        isLowStock: lineIsLowStock,
      };
    })
    .filter(Boolean) as Array<
    CartItem & {
      product: (typeof products)[number];
      unitPriceCents: number;
      tierMinQuantity: number | null;
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
      remainingAfterSale: number;
      isLowStock: boolean;
    }
  >;
  const lineNetCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const invoiceDiscountCents = calculateDiscount(lineNetCents, invoiceDiscount);
  const taxableSubtotalCents = lineNetCents - invoiceDiscountCents;
  const vatRateBasisPoints = settings?.vatEnabled
    ? (settings.vatRateBasisPoints ?? 0)
    : 0;
  // Même calcul que le serveur : taux du produit, sinon taux de l'entreprise (9.6).
  const vatCents = computeVatBreakdown(
    lines.map(line => ({
      netCents: line.totalCents,
      vatRateBasisPoints: settings?.vatEnabled
        ? (line.product.vatRateBasisPoints ?? vatRateBasisPoints)
        : 0,
    })),
    invoiceDiscountCents
  ).vatCents;
  const totalCents = taxableSubtotalCents + vatCents;

  const add = (productId: number) =>
    setCart(current => {
      const product = products.find(item => item.id === productId);
      const item = current.find(value => value.productId === productId);
      if (!product) return current;
      const availableQuantity = Math.max(
        0,
        product.quantity - (pendingProductQuantities[productId] ?? 0)
      );
      return item
        ? current.map(value =>
            value.productId === productId
              ? {
                  ...value,
                  quantity: Math.min(value.quantity + 1, availableQuantity),
                }
              : value
          )
        : availableQuantity > 0
          ? [...current, { productId, quantity: 1, discount: noDiscount }]
          : current;
    });
  const quantity = (productId: number, next: number) =>
    setCart(current =>
      next <= 0
        ? current.filter(item => item.productId !== productId)
        : current.map(item =>
            item.productId === productId
              ? {
                  ...item,
                  quantity: Math.min(
                    next,
                    Math.max(
                      0,
                      (products.find(product => product.id === productId)
                        ?.quantity ?? next) -
                        (pendingProductQuantities[productId] ?? 0)
                    )
                  ),
                }
              : item
          )
    );
  const setLineDiscount = (productId: number, discount: DiscountForm) =>
    setCart(current =>
      current.map(item =>
        item.productId === productId ? { ...item, discount } : item
      )
    );
  const clearCart = () => {
    setCart([]);
    setInvoiceDiscount(noDiscount);
    setCartCollapsed(false);
  };
  const draft = trpc.transactions.createDraft.useMutation({
    onSuccess: result => {
      utils.transactions.list.invalidate();
      setCheckoutSale({ ...result, channel: "pos" });
    },
    onError: error => toast.error(error.message),
  });
  const openCheckout = useCallback(() => {
    if (!cart.length)
      return toast.error("Ajoutez au moins un produit au panier.");
    const offlineDraft: OfflinePosDraft = {
      channel: "pos",
      customerId: null,
      salesAgentId: null,
      cashierId: null,
      salesAgentSelectionMade: false,
      cashierSelectionMade: false,
      note: null,
      deliveryAddress: null,
      invoiceDiscount: discountPayload(invoiceDiscount),
      items: lines.map(line => ({
        productId: line.productId,
        productName: line.product.name,
        productReference: line.product.reference,
        unitPriceCents: line.unitPriceCents,
        lineTotalCents: line.totalCents,
        quantity: line.quantity,
        discount: discountPayload(line.discount),
      })),
    };
    if (!isOnline) {
      setCheckoutSale({
        id: null,
        totalCents,
        invoiceNumber: "Vente hors connexion",
        channel: "pos",
        offlineDraft,
      });
      return;
    }
    draft.mutate({
      channel: "pos",
      customerId: null,
      salesAgentId: null,
      cashierId: null,
      note: null,
      invoiceDiscount: discountPayload(invoiceDiscount),
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        discount: discountPayload(item.discount),
      })),
    });
  }, [cart, draft, invoiceDiscount, isOnline, lines, totalCents]);
  const handleCode = (code: string) => {
    const product = products.find(
      item => item.reference.toLowerCase() === code.trim().toLowerCase()
    );
    if (!product) return toast.error("Aucun produit ne correspond à ce code.");
    add(product.id);
    setQuery("");
    toast.success(`${product.name} ajouté au panier.`);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !isCheckoutShortcut({
          key: event.key,
          targetTag: target?.tagName,
          isContentEditable: target?.isContentEditable,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        })
      )
        return;
      if (!cart.length || draft.isPending) return;
      event.preventDefault();
      openCheckout();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [cart.length, draft.isPending, openCheckout]);

  const usedCategories = categories.filter(category =>
    products.some(product => product.categoryId === category.id)
  );
  const bottomSpacing = cart.length
    ? cartCollapsed
      ? "pb-36 sm:pb-40 lg:pb-0"
      : "pb-[27rem] sm:pb-[31rem] lg:pb-0"
    : "";
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div
      className={`mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] ${bottomSpacing}`}
    >
      <section className="min-w-0 space-y-[18px]">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-[22px] font-bold tracking-tight text-foreground">
            Vente rapide
          </h1>
          <span
            className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${isOnline ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}
          >
            <span
              className={`h-[7px] w-[7px] rounded-full ${isOnline ? "bg-success" : "bg-warning"}`}
            />
            {isOnline ? "Caisse en ligne" : "Caisse hors connexion"}
          </span>
        </header>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex h-12 flex-1 items-center gap-2.5 rounded-[10px] border border-input bg-card px-3.5 text-faint focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && query.trim()) {
                  const exact = products.find(
                    item =>
                      item.reference.toLowerCase() ===
                      query.trim().toLowerCase()
                  );
                  if (exact) handleCode(query);
                  else if (available.length === 1) {
                    add(available[0].id);
                    setQuery("");
                  }
                }
              }}
              placeholder="Nom, référence ou code-barres"
              aria-label="Rechercher un produit"
              className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-faint"
            />
          </label>
          <div className="flex gap-2">
            <Button
              aria-label="Scanner un code-barres"
              variant="outline"
              className="h-12 w-12 px-0"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={lowStockOnly}
              onClick={() => setLowStockOnly(value => !value)}
              className={`h-12 ${lowStockOnly ? "border-warning bg-warning-soft text-warning hover:bg-warning-soft" : ""}`}
            >
              <AlertTriangle className="h-4 w-4" />
              Stock faible
            </Button>
            {lowStockOnly && (
              <Button
                type="button"
                variant="outline"
                disabled={!purchaseItems.length}
                onClick={() => setPurchaseListOpen(true)}
                className="h-12"
              >
                <ClipboardList className="h-4 w-4" />
                Liste d’achats
              </Button>
            )}
          </div>
        </div>
        {usedCategories.length > 0 && (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Catégories"
          >
            {[
              { id: null as number | null, name: "Tout" },
              ...usedCategories,
            ].map(category => {
              const active = categoryId === category.id;
              return (
                <button
                  key={category.id ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoryId(category.id)}
                  className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-accent"}`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        )}
        {lowStockOnly && (
          <p className="text-[13px] text-muted-foreground">
            La liste d’achats regroupe les produits filtrés et propose une
            quantité suffisante pour dépasser le seuil de sécurité.
          </p>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {available.map(product => {
            const productIsLowStock = isLowStock(product);
            const inCart = cart.some(item => item.productId === product.id);
            const remaining =
              product.quantity - (pendingProductQuantities[product.id] ?? 0);
            return (
              <button
                key={product.id}
                onClick={() => add(product.id)}
                className={`flex min-h-[112px] flex-col gap-1.5 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/60 hover:bg-accent/40 ${inCart ? "border-primary ring-1 ring-primary" : "border-border"}`}
              >
                <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                  {product.name}
                </span>
                <span
                  className={`text-xs font-medium ${productIsLowStock ? "text-warning" : "text-faint"}`}
                >
                  {productIsLowStock ? "Stock bas" : "En stock"} · {remaining}{" "}
                  {product.unit}
                </span>
                {product.priceTiers?.length ? (
                  <span className="text-[11px] font-medium text-primary">
                    Paliers dès {product.priceTiers[0].minQuantity}{" "}
                    {product.unit}
                  </span>
                ) : null}
                <span className="mt-auto text-base font-bold text-foreground">
                  {formatCurrency(product.retailPriceCents)}
                </span>
              </button>
            );
          })}
        </div>
        {!available.length && (
          <p className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            {lowStockOnly
              ? "Aucun produit en stock faible ne correspond à votre recherche."
              : query || categoryId !== null
                ? "Aucun produit ne correspond à votre recherche."
                : "Aucun produit disponible."}
          </p>
        )}
      </section>
      <BarcodeCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetected={handleCode}
      />
      <CheckoutSheet
        open={Boolean(checkoutSale)}
        onOpenChange={open => !open && setCheckoutSale(null)}
        sale={checkoutSale}
        agents={agents}
        settings={settings}
        onComplete={() => {
          clearCart();
          setCheckoutSale(null);
          utils.products.list.invalidate();
        }}
      />
      <Dialog open={purchaseListOpen} onOpenChange={setPurchaseListOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Liste d’achats fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {purchaseGroups.map(group => (
              <section
                key={group.supplierName}
                className="rounded-xl border border-border"
              >
                <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3 font-medium">
                  <PackagePlus className="h-4 w-4 text-primary" />
                  {group.supplierName}
                </div>
                <div className="divide-y divide-border">
                  {group.items.map(item => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.reference} · Stock actuel {item.quantity}{" "}
                          {item.unit} · Seuil {item.minimumQuantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">
                          + {item.quantityToOrder} {item.unit}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.estimateCents > 0
                            ? formatCurrency(item.estimateCents)
                            : "Coût d’achat non renseigné"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Estimation des achats
            </span>
            <span className="text-lg font-semibold text-primary">
              {formatCurrency(purchaseTotalCents)}
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPurchaseListOpen(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <aside
        aria-label="Panier de vente"
        className={`fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:bottom-5 sm:rounded-2xl lg:sticky lg:top-[5.5rem] lg:bottom-auto lg:z-0 lg:mx-0 lg:max-h-[calc(100vh-7.5rem)] lg:max-w-none lg:self-start lg:rounded-xl lg:shadow-none ${cart.length > 0 && !checkoutSale ? "flex" : "hidden lg:flex"}`}
      >
        <div
          className={`flex flex-col gap-2.5 border-b border-border px-5 lg:px-6 lg:py-5 ${cartCollapsed ? "py-2.5" : "py-4"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-semibold text-foreground">
              Panier · {itemCount} article{itemCount > 1 ? "s" : ""}
            </h2>
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Vider
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={
                  cartCollapsed ? "Ouvrir le panier" : "Réduire le panier"
                }
                title={cartCollapsed ? "Ouvrir le panier" : "Réduire le panier"}
                onClick={() => setCartCollapsed(value => !value)}
              >
                {cartCollapsed ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        {cartCollapsed && (
          <div className="flex items-center gap-3 px-5 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setCartCollapsed(false)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block text-xs text-muted-foreground">
                Total TTC · voir le détail
              </span>
              <span className="block truncate text-xl font-bold tracking-tight text-foreground">
                {formatCurrency(totalCents)}
              </span>
            </button>
            <Button
              onClick={openCheckout}
              disabled={draft.isPending || !cart.length}
              className="h-12 rounded-xl px-6 text-base font-bold"
            >
              {draft.isPending ? "Préparation…" : "Encaisser"}
            </Button>
          </div>
        )}
        <div
          className={`min-h-0 flex-1 flex-col ${cartCollapsed ? "hidden lg:flex" : "flex"}`}
        >
          {lines.length ? (
            <div className="max-h-[16.75rem] min-h-0 flex-1 overflow-y-auto px-5 sm:max-h-[20rem] lg:max-h-none lg:px-6">
              {lines.map(line => (
                <div
                  key={line.productId}
                  className="flex items-center gap-3 border-b border-border py-3.5 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {line.product.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-faint">
                      {formatCurrency(line.unitPriceCents)} × {line.quantity}
                    </p>
                    {line.tierMinQuantity && (
                      <p className="mt-0.5 text-[11px] font-medium text-primary">
                        Palier {line.tierMinQuantity}+ retenu
                      </p>
                    )}
                    {line.isLowStock && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        {line.remainingAfterSale} restant · seuil{" "}
                        {line.product.minimumQuantity}
                      </p>
                    )}
                    <div className="mt-1 hidden sm:block">
                      <DiscountEditor
                        compact
                        label="Remise"
                        value={line.discount}
                        onChange={discount =>
                          setLineDiscount(line.productId, discount)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center overflow-hidden rounded-[10px] border border-input">
                    <button
                      type="button"
                      aria-label={`Retirer une unité de ${line.product.name}`}
                      className="grid h-11 w-11 place-items-center text-muted-foreground hover:bg-accent"
                      onClick={() =>
                        quantity(line.productId, line.quantity - 1)
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-9 text-center text-[15px] font-semibold">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Ajouter une unité de ${line.product.name}`}
                      className="grid h-11 w-11 place-items-center text-muted-foreground hover:bg-accent"
                      onClick={() =>
                        quantity(line.productId, line.quantity + 1)
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="w-24 shrink-0 text-right text-[15px] font-semibold text-foreground">
                    {formatCurrency(line.totalCents)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center px-6 py-10 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-faint">
                  <ShoppingCart className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-foreground">
                  Panier vide
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Touchez un produit ou scannez un code-barres.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-2.5 border-t border-border bg-muted/40 px-5 py-5 lg:px-6">
            <DiscountEditor
              compact
              label="Remise sur le panier"
              value={invoiceDiscount}
              onChange={setInvoiceDiscount}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{vatCents > 0 ? "Sous-total HT" : "Sous-total"}</span>
              <span>{formatCurrency(taxableSubtotalCents)}</span>
            </div>
            {vatCents > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  TVA{" "}
                  {vatRatesLabel(
                    lines.map(line =>
                      settings?.vatEnabled
                        ? (line.product.vatRateBasisPoints ??
                          vatRateBasisPoints)
                        : 0
                    )
                  )}
                </span>
                <span>{formatCurrency(vatCents)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-1.5">
              <span className="text-base font-semibold text-foreground">
                Total TTC
              </span>
              <span className="text-[28px] font-bold tracking-tight text-foreground">
                {formatCurrency(totalCents)}
              </span>
            </div>
            <Button
              onClick={openCheckout}
              disabled={draft.isPending || !cart.length}
              className="mt-1.5 h-14 w-full rounded-xl text-[17px] font-bold"
            >
              {draft.isPending
                ? "Préparation…"
                : `${isOnline ? "Encaisser" : "Encaisser hors connexion"} ${formatCurrency(totalCents)}`}
            </Button>
            <p className="hidden items-center justify-center gap-1.5 text-center text-xs text-faint sm:flex">
              <Keyboard className="h-3.5 w-3.5" />
              F9 pour encaisser
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
