import { BarcodeCameraDialog } from "@/components/BarcodeCameraDialog";
import { calculateDiscount, DiscountEditor, discountPayload, noDiscount, type DiscountForm } from "@/components/DiscountEditor";
import { CheckoutSheet } from "@/components/CheckoutSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { isCheckoutShortcut, stockAfterCartSelection } from "@/lib/posCartRules";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Camera, ChevronDown, ChevronUp, Keyboard, Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CartItem = { productId: number; quantity: number; discount: DiscountForm };

export default function PointOfSale() {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: agents = [] } = trpc.commerce.agents.list.useQuery();
  const { data: settings } = trpc.commerce.settings.get.useQuery();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartCollapsed, setCartCollapsed] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [invoiceDiscount, setInvoiceDiscount] = useState<DiscountForm>(noDiscount);
  const [checkoutSale, setCheckoutSale] = useState<{ id: number; totalCents: number; invoiceNumber: string } | null>(null);

  const available = useMemo(() => products.filter(product => product.quantity > 0 && [product.name, product.reference].some(value => value.toLowerCase().includes(query.toLowerCase()))), [products, query]);
  const lines = cart.map(item => {
    const product = products.find(value => value.id === item.productId);
    if (!product) return null;
    const subtotalCents = product.retailPriceCents * item.quantity;
    const discountCents = calculateDiscount(subtotalCents, item.discount);
    const { remainingAfterSale, isLowStock } = stockAfterCartSelection(product.quantity, item.quantity, product.minimumQuantity);
    return { ...item, product, subtotalCents, discountCents, totalCents: subtotalCents - discountCents, remainingAfterSale, isLowStock };
  }).filter(Boolean) as Array<CartItem & { product: typeof products[number]; subtotalCents: number; discountCents: number; totalCents: number; remainingAfterSale: number; isLowStock: boolean }>;
  const subtotalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const lineNetCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const invoiceDiscountCents = calculateDiscount(lineNetCents, invoiceDiscount);
  const totalCents = lineNetCents - invoiceDiscountCents;

  const add = (productId: number) => setCart(current => {
    const product = products.find(item => item.id === productId);
    const item = current.find(value => value.productId === productId);
    if (!product) return current;
    setCartCollapsed(false);
    return item ? current.map(value => value.productId === productId ? { ...value, quantity: Math.min(value.quantity + 1, product.quantity) } : value) : [...current, { productId, quantity: 1, discount: noDiscount }];
  });
  const quantity = (productId: number, next: number) => setCart(current => next <= 0 ? current.filter(item => item.productId !== productId) : current.map(item => item.productId === productId ? { ...item, quantity: Math.min(next, products.find(product => product.id === productId)?.quantity ?? next) } : item));
  const setLineDiscount = (productId: number, discount: DiscountForm) => setCart(current => current.map(item => item.productId === productId ? { ...item, discount } : item));
  const clearCart = () => { setCart([]); setInvoiceDiscount(noDiscount); setCartCollapsed(false); };
  const draft = trpc.transactions.createDraft.useMutation({ onSuccess: result => { utils.transactions.list.invalidate(); setCheckoutSale(result); }, onError: error => toast.error(error.message) });
  const openCheckout = useCallback(() => {
    if (!cart.length) return toast.error("Ajoutez au moins un produit au panier.");
    draft.mutate({ channel: "pos", customerId: null, salesAgentId: null, cashierId: null, note: null, invoiceDiscount: discountPayload(invoiceDiscount), items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, discount: discountPayload(item.discount) })) });
  }, [cart, draft, invoiceDiscount]);
  const handleCode = (code: string) => { const product = products.find(item => item.reference.toLowerCase() === code.trim().toLowerCase()); if (!product) return toast.error("Aucun produit ne correspond à ce code."); add(product.id); setQuery(""); toast.success(`${product.name} ajouté au panier.`); };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!isCheckoutShortcut({ key: event.key, targetTag: target?.tagName, isContentEditable: target?.isContentEditable, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey })) return;
      if (!cart.length || draft.isPending) return;
      event.preventDefault();
      openCheckout();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [cart.length, draft.isPending, openCheckout]);

  const bottomSpacing = cart.length ? cartCollapsed ? "pb-24 sm:pb-28" : "pb-[27rem] sm:pb-[31rem]" : "";
  return <div className={`mx-auto max-w-[1600px] space-y-5 ${bottomSpacing}`}><header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#007B8B]">Vente comptoir</p><h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">Point de vente</h1></div>{cart.length > 0 && <button type="button" onClick={() => setCartCollapsed(false)} className="inline-flex items-center gap-2 self-start rounded-xl border border-[#007B8B]/20 bg-[#007B8B]/[0.07] px-3 py-2 text-sm font-medium text-[#007B8B]"><ShoppingCart className="h-4 w-4" />{cart.length} article{cart.length > 1 ? "s" : ""} au panier{cartCollapsed && " · Ouvrir"}</button>}</header><section className="rounded-2xl border border-border bg-card p-5"><div className="flex max-w-xl gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un produit ou une référence" className="pl-9" /></div><Button aria-label="Scanner un code-barres" variant="outline" size="icon" onClick={() => setCameraOpen(true)}><Camera className="h-4 w-4" /></Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{available.map(product => { const isLowStock = stockAfterCartSelection(product.quantity, 0, product.minimumQuantity).isLowStock; return <button key={product.id} onClick={() => add(product.id)} className={`rounded-xl border p-4 text-left transition hover:border-[#007B8B]/40 hover:bg-[#007B8B]/5 ${isLowStock ? "border-amber-500/50 bg-amber-500/[0.04]" : "border-border"}`}><p className="truncate font-medium">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">{product.reference} · {product.quantity} {product.unit}</p>{isLowStock && <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />Stock faible · seuil {product.minimumQuantity}</p>}<div className="mt-4 flex items-center justify-between"><span className="font-semibold text-[#007B8B]">{formatCurrency(product.retailPriceCents)}</span><Plus className="h-4 w-4" /></div></button>})}</div>{!available.length && <p className="py-14 text-center text-sm text-muted-foreground">Aucun produit disponible.</p>}</section><BarcodeCameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onDetected={handleCode} /><CheckoutSheet open={Boolean(checkoutSale)} onOpenChange={open => !open && setCheckoutSale(null)} sale={checkoutSale ? { ...checkoutSale, channel: "pos" } : null} agents={agents} settings={settings} onComplete={() => { clearCart(); setCheckoutSale(null); utils.products.list.invalidate(); }} />{cart.length > 0 && !checkoutSale && <aside aria-label="Panier de vente" className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-3xl overflow-hidden rounded-t-[1.75rem] border border-border bg-card shadow-[0_-16px_45px_rgba(15,23,42,0.18)] sm:bottom-5 sm:rounded-[1.75rem]"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#007B8B]/10 text-[#007B8B]"><ShoppingCart className="h-5 w-5" /></span><div><h2 className="font-semibold">Panier · {cart.length} article{cart.length > 1 ? "s" : ""}</h2>{!cartCollapsed && <p className="text-xs text-muted-foreground">Les articles sélectionnés restent visibles.</p>}</div></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" aria-label={cartCollapsed ? "Ouvrir le panier" : "Réduire le panier"} title={cartCollapsed ? "Ouvrir le panier" : "Réduire le panier"} onClick={() => setCartCollapsed(value => !value)}>{cartCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button><Button variant="ghost" size="sm" onClick={clearCart} className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"><Trash2 className="mr-1.5 h-4 w-4" />Vider</Button></div></div>{cartCollapsed ? <div className="flex items-center justify-between bg-muted/30 px-5 py-3"><span className="text-sm text-muted-foreground">Total à payer</span><button type="button" onClick={() => setCartCollapsed(false)} className="font-semibold text-[#007B8B]">{formatCurrency(totalCents)} · Ouvrir</button></div> : <><div className="max-h-[16.75rem] divide-y divide-border overflow-y-auto px-5 sm:max-h-[20rem]">{lines.map(line => <div key={line.productId} className="grid min-h-[5.25rem] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3"><div className="min-w-0"><p className="truncate font-medium">{line.product.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatCurrency(line.product.retailPriceCents)} l’unité</p>{line.isLowStock && <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />Stock faible · {line.remainingAfterSale} restant{line.product.minimumQuantity > 0 ? ` · seuil ${line.product.minimumQuantity}` : ""}</p>}<div className="mt-1 hidden sm:block"><DiscountEditor compact label="Remise" value={line.discount} onChange={discount => setLineDiscount(line.productId, discount)} /></div></div><div className="flex items-center overflow-hidden rounded-xl border border-border bg-background"><Button aria-label={`Retirer une unité de ${line.product.name}`} size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={() => quantity(line.productId, line.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button><span className="w-6 text-center text-sm font-semibold">{line.quantity}</span><Button aria-label={`Ajouter une unité de ${line.product.name}`} size="icon" variant="ghost" className="h-8 w-8 rounded-none" onClick={() => quantity(line.productId, line.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button></div><p className="min-w-20 text-right font-semibold">{formatCurrency(line.totalCents)}</p></div>)}</div><div className="space-y-3 border-t border-border bg-muted/30 px-5 py-4"><DiscountEditor compact label="Remise sur le panier" value={invoiceDiscount} onChange={setInvoiceDiscount} /><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total à payer</span><span className="text-2xl font-semibold tracking-tight">{formatCurrency(totalCents)}</span></div><Button onClick={openCheckout} disabled={draft.isPending} className="h-12 w-full bg-[#007B8B] text-base text-white hover:bg-[#006976]">{draft.isPending ? "Préparation…" : <><Keyboard className="mr-2 h-4 w-4" />Encaisser <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-xs">F9</span></>}</Button></div></>}</aside>}</div>;
}
