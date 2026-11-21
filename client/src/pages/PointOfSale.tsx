import { ProductImage } from "@/components/ProductImage";
import { BarcodeCameraDialog } from "@/components/BarcodeCameraDialog";
import { computeVatBreakdown, vatRatesLabel } from "@shared/pricing";
import {
  calculateDiscount,
  DiscountEditor,
  discountPayload,
  noDiscount,
  type DiscountForm,
} from "@/components/DiscountEditor";
import { useAuth } from "@/_core/hooks/useAuth";
import { CheckoutSheet } from "@/components/CheckoutSheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
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
  TicketCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

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
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { activeWarehouseId, setActiveWarehouseId } = useActiveWarehouse();
  const isAdmin = user?.role === "admin";
  const { isOnline, pendingProductQuantitiesByWarehouse, lastLocalSnapshotAt } = useOffline();
  const { data: warehouses = [] } = trpc.warehouses.list.useQuery();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  useEffect(() => { if (selectedWarehouseId === null && warehouses.length) setSelectedWarehouseId(warehouses.find(warehouse => warehouse.isDefault)?.id ?? warehouses.find(warehouse => warehouse.active)?.id ?? null); }, [selectedWarehouseId, warehouses]);
  useEffect(() => { if (isAdmin && activeWarehouseId && activeWarehouseId !== selectedWarehouseId) { setCart([]); setSelectedWarehouseId(activeWarehouseId); } }, [activeWarehouseId, isAdmin, selectedWarehouseId]);
  const { data: products = [] } = trpc.products.list.useQuery(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : undefined);
  const pendingProductQuantities = pendingProductQuantitiesByWarehouse[selectedWarehouseId ?? 0] ?? {};
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: agents = [] } = trpc.commerce.agents.list.useQuery(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : undefined);
  const { data: settings } = trpc.commerce.settings.get.useQuery();
  const { data: transactions = [] } = trpc.transactions.list.useQuery(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : undefined);
  const { data: sellerDiscountPermissions } =
    trpc.sellerDiscountPermissions.get.useQuery(undefined, {
      enabled: user?.role === "seller",
    });
  const canLineDiscount =
    user?.role !== "seller" ||
    Boolean(sellerDiscountPermissions?.sellerCanLineDiscount);
  const canCartDiscount =
    user?.role !== "seller" ||
    Boolean(sellerDiscountPermissions?.sellerCanCartDiscount);
  const [query, setQuery] = useState("");
  const [showPhotos, setShowPhotos] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [purchaseListOpen, setPurchaseListOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  // Sur téléphone, le panier reste une barre de total pour laisser la place aux produits.
  const [cartCollapsed, setCartCollapsed] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [invoiceDiscount, setInvoiceDiscount] =
    useState<DiscountForm>(noDiscount);
  const [posApplyVat, setPosApplyVat] = useState(true);
  const [checkoutSale, setCheckoutSale] = useState<CheckoutSale | null>(null);
  // Ticket en attente rappelé dans le panier : modifiable, encaissable sous le même numéro, ou annulable.
  const [recalled, setRecalled] = useState<{ id: number; invoiceNumber: string } | null>(null);
  // Quand le panneau du panier apparaît, la grille se réorganise : on ignore brièvement les touches suivantes.
  const tapGuardUntil = useRef(0);
  const pendingTickets = useMemo(() => transactions.filter(ticket => ticket.channel === "pos" && (ticket.status === "draft" || ticket.status === "partial") && (!selectedWarehouseId || ticket.warehouseId === selectedWarehouseId)).slice(0, 4), [selectedWarehouseId, transactions]);

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
          (!lowStockOnly || isLowStock(product))
        );
      }),
    [isLowStock, lowStockOnly, pendingProductQuantities, products, query]
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
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.subtotalCents,
    0
  );
  const lineNetCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const invoiceDiscountCents = calculateDiscount(lineNetCents, invoiceDiscount);
  const taxableSubtotalCents = lineNetCents - invoiceDiscountCents;
  const sellerCanToggleVat = user?.role !== "seller" || Boolean(settings?.sellerCanToggleVat);
  const applyVat = Boolean(settings?.vatEnabled) && (sellerCanToggleVat ? posApplyVat : true);
  const vatRateBasisPoints = applyVat
    ? (settings.vatRateBasisPoints ?? 0)
    : 0;
  const vatBreakdown = computeVatBreakdown(
    lines.map(line => ({
      netCents: line.totalCents,
      vatRateBasisPoints: applyVat
        ? (line.product.vatRateBasisPoints ?? vatRateBasisPoints)
        : 0,
    })),
    invoiceDiscountCents
  );
  const vatCents = vatBreakdown.vatCents;
  const totalCents = taxableSubtotalCents + vatCents;

  const add = (productId: number) => {
    if (Date.now() < tapGuardUntil.current) return;
    if (!cart.length && typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) tapGuardUntil.current = Date.now() + 450;
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
  };
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
    setCartCollapsed(true);
    setRecalled(null);
  };
  // Vente numérotée créée par « Encaisser » : annulée (et tracée) si l'encaissement est abandonné.
  // Un ticket mis en attente puis repris n'est jamais annulé automatiquement.
  const freshDraftId = useRef<number | null>(null);
  const abandonDraft = trpc.transactions.removeDraft.useMutation({ onSuccess: () => utils.transactions.list.invalidate(), onError: () => undefined });
  const draft = trpc.transactions.createDraft.useMutation({
    onSuccess: result => {
      utils.transactions.list.invalidate();
      // Un ticket rappelé reste en attente si l'encaissement est abandonné : il n'est jamais supprimé automatiquement.
      if (recalled) setRecalled({ id: result.id, invoiceNumber: result.invoiceNumber });
      else freshDraftId.current = result.id;
      setCheckoutSale({ ...result, channel: "pos" });
    },
    onError: error => toast.error(error.message),
  });
  const savePendingTicket = trpc.transactions.createDraft.useMutation({
    onSuccess: result => {
      utils.transactions.list.invalidate();
      clearCart();
      toast.success(recalled ? `${result.invoiceNumber} mis à jour, toujours à encaisser.` : `${result.invoiceNumber} est enregistré à encaisser plus tard.`);
    },
    onError: error => toast.error(error.message),
  });
  const openCheckout = useCallback(() => {
    if (!cart.length)
      return toast.error("Ajoutez au moins un produit au panier.");
    const offlineDraft: OfflinePosDraft = {
      channel: "pos",
      warehouseId: selectedWarehouseId ?? 0,
      customerId: null,
      salesAgentId: null,
      cashierId: null,
      salesAgentSelectionMade: false,
      cashierSelectionMade: false,
      note: null,
      deliveryAddress: null,
      invoiceDiscount: discountPayload(invoiceDiscount),
      applyVat,
      vatRateBasisPoints: applyVat ? vatRateBasisPoints : undefined,
      items: lines.map(line => ({
        productId: line.productId,
        productName: line.product.name,
        productReference: line.product.reference,
        vatRateBasisPoints: applyVat ? (line.product.vatRateBasisPoints ?? vatRateBasisPoints) : 0,
        unitPriceCents: line.unitPriceCents,
        lineTotalCents: line.totalCents,
        quantity: line.quantity,
        discount: discountPayload(line.discount),
      })),
    };
    if (!isOnline && recalled) return toast.error("Connectez-vous pour encaisser un ticket mis en attente.");
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
      replacesSaleId: recalled?.id,
      warehouseId: selectedWarehouseId ?? undefined,
      customerId: null,
      salesAgentId: null,
      cashierId: null,
      note: null,
      invoiceDiscount: discountPayload(invoiceDiscount),
      applyVat,
      vatRateBasisPoints: applyVat ? vatRateBasisPoints : undefined,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        discount: discountPayload(item.discount),
      })),
    });
  }, [cart, draft, invoiceDiscount, isOnline, lines, recalled, selectedWarehouseId, totalCents]);
  const cancelTicket = trpc.transactions.removeDraft.useMutation({
    onSuccess: () => { toast.success(`Ticket ${recalled?.invoiceNumber ?? ""} annulé et supprimé.`); void utils.transactions.list.invalidate(); clearCart(); },
    onError: error => toast.error(error.message),
  });
  const confirmCancelTicket = () => {
    if (!recalled) return;
    if (window.confirm(`Annuler le ticket ${recalled.invoiceNumber} ? Il n’a pas été encaissé : il sera supprimé (une trace reste dans le journal d’audit).`)) cancelTicket.mutate({ saleId: recalled.id });
  };
  /** Rappelle un ticket en attente dans le panier ; un ticket déjà partiellement réglé s'encaisse directement. */
  const recallTicket = async (ticket: (typeof pendingTickets)[number]) => {
    if (ticket.amountPaidCents > 0 || ticket.status !== "draft") { freshDraftId.current = null; setCheckoutSale({ id: ticket.id, totalCents: ticket.totalCents, invoiceNumber: ticket.invoiceNumber, channel: "pos" }); return; }
    if (cart.length && !window.confirm(recalled ? `Laisser ${recalled.invoiceNumber} en attente sans enregistrer vos changements et ouvrir ${ticket.invoiceNumber} ?` : "Le panier en cours sera remplacé par ce ticket. Continuer ?")) return;
    try {
      const detail = await utils.commerce.sales.detail.fetch({ id: ticket.id });
      const toForm = (type: string | null | undefined, value: number | null | undefined): DiscountForm => type === "percent" || type === "fixed" ? { type, value: String((value ?? 0) / 100) } : noDiscount;
      const items = detail.items.filter((item: any) => products.some(product => product.id === item.productId));
      if (items.length < detail.items.length) toast.warning("Certains produits du ticket ne sont plus disponibles dans cet entrepôt.");
      setCart(items.map((item: any) => ({ productId: item.productId, quantity: item.quantity, discount: toForm(item.discountType, item.discountValue) })));
      setInvoiceDiscount(toForm(detail.sale.invoiceDiscountType, detail.sale.invoiceDiscountValue));
      if (settings?.vatEnabled) setPosApplyVat(detail.sale.vatCents > 0);
      setRecalled({ id: ticket.id, invoiceNumber: ticket.invoiceNumber });
      setCartCollapsed(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ticket introuvable."); }
  };
  const handleCode = (code: string) => {
    const product = products.find(
      item => item.reference.toLowerCase() === code.trim().toLowerCase()
    );
    if (!product) return toast.error("Aucun produit ne correspond à ce code.");
    add(product.id);
    setQuery("");
    toast.success(`${product.name} ajouté au panier.`);
  };
  const holdTicket = () => {
    if (!cart.length) return toast.error("Ajoutez au moins un produit au panier.");
    if (!isOnline) return toast.error("Connectez-vous pour enregistrer un ticket à encaisser plus tard.");
    savePendingTicket.mutate({
      channel: "pos",
      replacesSaleId: recalled?.id,
      warehouseId: selectedWarehouseId ?? undefined,
      customerId: null,
      salesAgentId: null,
      cashierId: null,
      note: null,
      invoiceDiscount: discountPayload(invoiceDiscount),
      applyVat,
      vatRateBasisPoints: applyVat ? vatRateBasisPoints : undefined,
      items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, discount: discountPayload(item.discount) })),
    });
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

  const cartUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  // Le panneau n’apparaît que s’il contient quelque chose (ou un ticket rappelé, même vidé).
  const showCart = cart.length > 0 || recalled !== null;
  const closeCheckout = (abandoned: boolean) => {
    const id = freshDraftId.current;
    freshDraftId.current = null;
    setCheckoutSale(null);
    // Encaissement abandonné : la vente numérotée créée à l'instant est annulée, le panier reste intact.
    if (abandoned && id && isOnline) abandonDraft.mutate({ saleId: id });
  };
  const cartLines = (
    <div className="divide-y divide-border">
      {lines.map(line => (
        <div key={line.productId} className="animate-slide-in flex gap-3 px-4 py-3">
          <ProductImage product={line.product} className="h-12 w-12 text-base" rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{line.product.name}</p>
              <p className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(line.totalCents)}</p>
            </div>
            <p className="text-xs text-muted-foreground">{formatCurrency(line.unitPriceCents)} l’unité{line.tierMinQuantity ? <span className="font-medium text-primary"> · palier {line.tierMinQuantity}+</span> : null}</p>
            {line.isLowStock && <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning"><AlertTriangle className="h-3 w-3" />Stock faible · {line.remainingAfterSale} restant · seuil {line.product.minimumQuantity}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center overflow-hidden rounded-lg border border-border bg-background">
                <Button aria-label={`Retirer une unité de ${line.product.name}`} size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={() => quantity(line.productId, line.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                <Input aria-label={`Quantité de ${line.product.name}`} type="number" inputMode="numeric" min="1" max={line.product.quantity} value={line.quantity} onChange={event => { const next = Number(event.target.value); if (Number.isSafeInteger(next) && next > 0) quantity(line.productId, next); }} className="h-8 w-12 rounded-none border-y-0 px-1 text-center text-sm font-semibold" />
                <Button aria-label={`Ajouter une unité de ${line.product.name}`} size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={() => quantity(line.productId, line.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              <Button aria-label={`Retirer ${line.product.name} du panier`} size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-destructive-soft hover:text-destructive" onClick={() => quantity(line.productId, 0)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            {canLineDiscount && <div className="mt-2"><DiscountEditor compact label="Remise" value={line.discount} onChange={discount => setLineDiscount(line.productId, discount)} /></div>}
          </div>
        </div>
      ))}
    </div>
  );
  const cartFooter = (
    <div className="space-y-3 border-t border-border bg-muted/40 px-4 py-4">
      {canCartDiscount && <DiscountEditor compact label="Remise sur le panier" value={invoiceDiscount} onChange={setInvoiceDiscount} />}
      {settings?.vatEnabled && <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"><div className="flex items-center gap-2 font-medium">{sellerCanToggleVat ? <Checkbox id="pos-vat" checked={posApplyVat} onCheckedChange={value => setPosApplyVat(value === true)} /> : null}<label htmlFor={sellerCanToggleVat ? "pos-vat" : undefined}>TVA appliquée</label></div>{!sellerCanToggleVat && <span className="text-xs text-muted-foreground">Configuration de l’entreprise</span>}</div>}
      <div className="space-y-1 text-sm text-muted-foreground">
        <div className="flex items-center justify-between"><span>Sous-total net</span><span>{formatCurrency(taxableSubtotalCents)}</span></div>
        {vatCents > 0 && <div className="flex items-center justify-between"><span>TVA ({vatRatesLabel(vatBreakdown.byRate.filter(rate => rate.vatCents > 0).map(rate => rate.vatRateBasisPoints)) || `${(vatRateBasisPoints / 100).toFixed(2)} %`})</span><span>{formatCurrency(vatCents)}</span></div>}
      </div>
      <div className="flex items-baseline justify-between"><span className="text-sm font-medium text-foreground">Total TTC</span><span className="text-2xl font-bold tracking-tight text-foreground">{formatCurrency(totalCents)}</span></div>
      <Button onClick={openCheckout} disabled={!cart.length || draft.isPending} className="h-12 w-full text-base">{draft.isPending ? "Préparation…" : <><Keyboard className="h-4 w-4" />{isOnline ? "Encaisser" : "Encaisser hors connexion"}<span className="ml-1 rounded bg-primary-foreground/15 px-1.5 py-0.5 text-xs">F9</span></>}</Button>
      <Button variant="outline" onClick={holdTicket} disabled={!cart.length || savePendingTicket.isPending || !isOnline} className="h-10 w-full"><TicketCheck className="h-4 w-4" />{savePendingTicket.isPending ? "Enregistrement…" : recalled ? "Enregistrer et remettre en attente" : "Mettre en attente"}</Button>
      {recalled && <Button variant="ghost" onClick={confirmCancelTicket} disabled={cancelTicket.isPending || !isOnline} className="h-10 w-full text-destructive hover:bg-destructive-soft hover:text-destructive"><XCircle className="h-4 w-4" />{cancelTicket.isPending ? "Annulation…" : "Annuler le ticket"}</Button>}
    </div>
  );
  const cartHeader = (onClose?: () => void) => (
    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><ShoppingCart className="h-[18px] w-[18px]" />{cartUnits > 0 && <span key={cartUnits} className="animate-pop absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{cartUnits}</span>}</span>
        <div className="min-w-0"><h2 className="truncate text-base font-semibold text-foreground">{recalled ? `Ticket ${recalled.invoiceNumber}` : "Panier"}</h2><p className="text-xs text-muted-foreground">{recalled ? "En attente · " : ""}{cart.length ? `${cart.length} article${cart.length > 1 ? "s" : ""}` : "Vide"}</p></div>
      </div>
      <div className="flex items-center gap-1">
        {!recalled && cart.length > 0 && <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive hover:bg-destructive-soft hover:text-destructive"><Trash2 className="h-4 w-4" />Vider</Button>}
        {onClose && <Button variant="outline" size="sm" onClick={onClose}><ChevronDown className="h-4 w-4" />Continuer</Button>}
      </div>
    </div>
  );
  return (
    <div className="mx-auto max-w-[1600px] pb-24 md:pb-0">
      <div className={`grid items-start gap-5 ${showCart ? "md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]" : ""}`}>
        <div className="min-w-0 space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight text-foreground">Vente rapide</h1>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Touchez un produit pour l’ajouter au panier.{!showCart && <span className="ml-2 hidden items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground md:inline-flex"><ShoppingCart className="h-3 w-3" />Panier vide</span>}</p>
            </div>
            <label className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">Entrepôt<select value={selectedWarehouseId ? String(selectedWarehouseId) : ""} onChange={event => { const nextId = Number(event.target.value); if (nextId && nextId !== selectedWarehouseId && cart.length && !window.confirm("Changer d’entrepôt videra le panier en cours. Continuer ?")) return; if (nextId !== selectedWarehouseId) clearCart(); if (isAdmin && nextId) setActiveWarehouseId(nextId); setSelectedWarehouseId(nextId || null); }} className="min-w-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" disabled={!warehouses.length}>{warehouses.filter(warehouse => warehouse.active).map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.isDefault ? " · Principal" : ""}</option>)}</select></label>
          </header>
          {pendingTickets.some(ticket => ticket.id !== recalled?.id) && (
            <section aria-label="Tickets à encaisser" className="surface rounded-xl border border-border bg-card px-4 py-3">
              <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-semibold text-foreground"><TicketCheck className="h-4 w-4 text-warning" />En attente d’encaissement</span><button type="button" onClick={() => setLocation("/tickets?statut=unpaid")} className="text-[13px] font-medium text-primary hover:underline">Voir tout</button></div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{pendingTickets.filter(ticket => ticket.id !== recalled?.id).map(ticket => <button key={ticket.id} type="button" onClick={() => void recallTicket(ticket)} className="lift shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-left hover:border-warning/40"><span className="block text-xs font-semibold text-foreground">{ticket.invoiceNumber}</span><span className="mt-0.5 block text-sm font-semibold text-warning">{formatCurrency(ticket.totalCents - ticket.amountPaidCents)}</span></button>)}</div>
            </section>
          )}
          <section className="surface rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un produit ou une référence" className="pl-9" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" aria-pressed={showPhotos} onClick={() => setShowPhotos(value => !value)}>{showPhotos ? "Masquer les photos" : "Afficher les photos"}</Button>
                <Button aria-label="Scanner un code-barres" variant="outline" size="icon" onClick={() => setCameraOpen(true)}><Camera className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" aria-pressed={lowStockOnly} onClick={() => setLowStockOnly(value => !value)} className={lowStockOnly ? "border-warning bg-warning-soft text-warning hover:bg-warning-soft" : ""}><AlertTriangle className="h-4 w-4" />Stock faible</Button>
                <Button type="button" variant="outline" disabled={!lowStockOnly || !purchaseItems.length} onClick={() => setPurchaseListOpen(true)}><ClipboardList className="h-4 w-4" />Liste d’achats</Button>
              </div>
            </div>
            {lowStockOnly && <p className="mt-3 text-xs text-muted-foreground">La liste d’achats regroupe les produits filtrés et propose une quantité suffisante pour dépasser le seuil de sécurité.</p>}
            <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))]">
              {available.map(product => {
                const productIsLowStock = isLowStock(product);
                const pendingQuantity = pendingProductQuantities[product.id] ?? 0;
                const estimatedQuantity = product.quantity - pendingQuantity;
                const inCart = cart.find(item => item.productId === product.id)?.quantity ?? 0;
                return (
                  <button key={product.id} type="button" onClick={() => add(product.id)} className={`lift relative flex flex-col overflow-hidden rounded-xl border bg-card text-left ${inCart ? "border-primary ring-1 ring-primary" : productIsLowStock ? "border-warning/40" : "border-border hover:border-primary/40"}`}>
                    {inCart > 0 && <span key={inCart} className="animate-pop absolute right-2 top-2 z-10 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow">{inCart}</span>}
                    {showPhotos && <ProductImage product={product} full className="aspect-square w-full border-b border-border text-3xl" rounded="rounded-none" />}
                    <div className="flex flex-1 flex-col p-3">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{product.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{product.reference} · {product.quantity} {product.unit}</p>
                      {!isOnline && <p className="mt-1 text-xs font-medium text-warning">Stock estimé : {estimatedQuantity} {product.unit}{pendingQuantity ? ` · ${pendingQuantity} en attente` : ""}</p>}
                      {product.priceTiers?.length ? <p className="mt-1 text-xs font-medium text-primary">Paliers dès {product.priceTiers[0].minQuantity} {product.unit}</p> : null}
                      {productIsLowStock && <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning"><AlertTriangle className="h-3 w-3" />Seuil {product.minimumQuantity}</p>}
                      <div className="mt-auto flex items-center justify-between pt-2"><span className="font-semibold text-primary">{formatCurrency(product.retailPriceCents)}</span><span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary"><Plus className="h-4 w-4" /></span></div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!isOnline && <p className="mt-3 text-xs text-warning">Les quantités affichées sont une estimation locale{lastLocalSnapshotAt ? ` enregistrée le ${new Date(lastLocalSnapshotAt).toLocaleString("fr-FR")}` : ""}. La validation finale du stock est effectuée lors de la synchronisation.</p>}
            {!available.length && <p className="py-14 text-center text-sm text-muted-foreground">{lowStockOnly ? "Aucun produit en stock faible ne correspond à votre recherche." : "Aucun produit disponible."}</p>}
          </section>
        </div>
        {/* Tablette et ordinateur : panier toujours visible à droite, les produits restent accessibles. */}
        {showCart && <aside aria-label="Panier de vente" className="animate-slide-in surface sticky top-20 hidden max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-xl border border-border bg-card md:flex">
          {cartHeader()}
          <div className="min-h-0 flex-1 overflow-y-auto">{cart.length ? cartLines : <p className="px-6 py-12 text-center text-sm text-muted-foreground">Le ticket ne contient plus d’article.</p>}</div>
          {cartFooter}
        </aside>}
      </div>
      {/* Téléphone : barre de total en bas, panier plein écran à la demande. */}
      {showCart && cartCollapsed && !checkoutSale && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCartCollapsed(false)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><ShoppingCart className="h-5 w-5" /><span key={cartUnits} className="animate-pop absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{cartUnits}</span></span>
              <span className="min-w-0"><span className="block text-xs text-muted-foreground">{recalled ? `Ticket ${recalled.invoiceNumber}` : "Voir le panier"} <ChevronUp className="inline h-3 w-3" /></span><span className="block truncate text-lg font-bold text-foreground">{formatCurrency(totalCents)}</span></span>
            </button>
            <Button onClick={openCheckout} disabled={draft.isPending} className="h-11 px-5">{draft.isPending ? "Préparation…" : "Encaisser"}</Button>
          </div>
        </div>
      )}
      {showCart && !cartCollapsed && !checkoutSale && (
        <div role="dialog" aria-modal="true" aria-label="Panier de vente" className="animate-enter fixed inset-0 z-40 flex flex-col bg-card md:hidden">
          {cartHeader(() => setCartCollapsed(true))}
          <div className="min-h-0 flex-1 overflow-y-auto">{cart.length ? cartLines : <p className="px-6 py-12 text-center text-sm text-muted-foreground">Le ticket ne contient plus d’article.</p>}</div>
          {cartFooter}
        </div>
      )}
      <BarcodeCameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onDetected={handleCode} />
      <CheckoutSheet
        open={Boolean(checkoutSale)}
        onOpenChange={open => !open && closeCheckout(false)}
        onAbandon={() => closeCheckout(true)}
        sale={checkoutSale}
        agents={agents}
        settings={settings}
        onComplete={() => {
          freshDraftId.current = null;
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
          <div className="flex items-center justify-between rounded-xl bg-primary/[0.06] px-4 py-3">
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
    </div>
  );
}
