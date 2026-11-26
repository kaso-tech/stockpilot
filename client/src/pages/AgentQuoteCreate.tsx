import { ProductImage } from "@/components/ProductImage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { formatCurrency } from "@/lib/format";
import { quoteShareText, whatsappLink } from "@/lib/quoteShare";
import { priceForQuantityTier } from "@/lib/priceTiers";
import { matchesSearch } from "@/lib/search";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, MessageCircle, Minus, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Line = { productId: number; quantity: number };

/** Devis préparé par l’agent commercial : client, produits, quantités ; validé ensuite en boutique. */
export default function AgentQuoteCreate() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { activeWarehouseId, activeWarehouse } = useActiveWarehouse();
  const { data: customers = [] } = trpc.commerce.customers.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery(activeWarehouseId ? { warehouseId: activeWarehouseId } : undefined);
  const { data: overview } = trpc.agentSpace.overview.useQuery();
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [shared, setShared] = useState<{ text: string; phone: string | null } | null>(null);
  const customer = customers.find(item => item.id === Number(customerId));
  const wholesale = customer?.type === "wholesale" && activeWarehouse?.wholesaleEnabled !== false;
  const priced = useMemo(() => lines.map(line => {
    const product = products.find(item => item.id === line.productId);
    if (!product) return null;
    const base = wholesale && product.wholesalePriceCents > 0 ? product.wholesalePriceCents : product.retailPriceCents;
    const { unitPriceCents } = priceForQuantityTier(base, line.quantity, wholesale ? product.wholesalePriceTiers : (product.retailPriceTiers ?? product.priceTiers));
    return { ...line, product, unitPriceCents, totalCents: unitPriceCents * line.quantity };
  }).filter((line): line is NonNullable<typeof line> => Boolean(line)), [lines, products, wholesale]);
  const estimateCents = priced.reduce((sum, line) => sum + line.totalCents, 0);
  const customerMatches = customerSearch.trim() ? customers.filter(item => matchesSearch(customerSearch, item.name, item.phone, item.email)).slice(0, 6) : [];
  const productMatches = productSearch.trim() ? products.filter(item => !lines.some(line => line.productId === item.id) && matchesSearch(productSearch, item.name, item.reference, item.category, item.description)).slice(0, 8) : [];
  const setQuantity = (productId: number, quantity: number) => setLines(current => current.map(line => line.productId === productId ? { ...line, quantity: Math.max(1, quantity) } : line));
  const create = trpc.transactions.createDraft.useMutation({
    onSuccess: result => {
      void utils.agentSpace.invalidate();
      toast.success(`Devis ${result.invoiceNumber} enregistré.`);
      setShared({ text: quoteShareText({ number: result.invoiceNumber, customerName: customer?.name ?? null, agentName: overview?.agent.name ?? null, items: priced.map(line => ({ productName: line.product.name, quantity: line.quantity, unitPriceCents: line.unitPriceCents, lineTotalCents: line.totalCents })), totalCents: result.totalCents, note: note.trim() || null }), phone: customer?.phone ?? null });
    },
    onError: error => toast.error(error.message),
  });
  const submit = () => {
    if (!customer) return toast.error("Choisissez le client du devis.");
    if (!priced.length) return toast.error("Ajoutez au moins un produit.");
    create.mutate({ channel: "quote", customerId: customer.id, warehouseId: activeWarehouseId ?? undefined, note: note.trim() || null, items: priced.map(line => ({ productId: line.productId, quantity: line.quantity })), salesAgentId: null, cashierId: null, salesAgentSelectionMade: true, cashierSelectionMade: true });
  };
  return <div className="mx-auto max-w-2xl space-y-5 pb-24">
    <header><Button variant="ghost" onClick={() => setLocation("/")} className="-ml-3 mb-2 text-muted-foreground"><ArrowLeft className="h-4 w-4" />Mon espace</Button><h1 className="text-[22px] font-bold tracking-tight text-foreground">Nouveau devis</h1><p className="mt-1 text-sm text-muted-foreground">Le devis vous est attribué. Il sera validé et encaissé en boutique ; vous pouvez l’envoyer au client par WhatsApp.</p></header>
    <section className="space-y-2 rounded-xl border border-border bg-card p-4"><p className="text-sm font-semibold">Client *</p>{customer ? <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5"><div className="min-w-0"><p className="truncate font-medium">{customer.name}</p><p className="text-xs text-faint">{customer.phone || "Téléphone non renseigné"}{wholesale ? " · tarif grossiste" : ""}</p></div><Button variant="ghost" size="sm" onClick={() => setCustomerId("")}>Changer</Button></div> : <><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" /><Input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} placeholder="Rechercher un client (nom ou téléphone)" className="pl-9" /></div>{customerMatches.map(item => <button key={item.id} type="button" onClick={() => { setCustomerId(String(item.id)); setCustomerSearch(""); }} className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-sm hover:bg-accent"><span className="font-medium">{item.name}</span><span className="text-xs text-faint">{item.phone}</span></button>)}<Button variant="outline" size="sm" onClick={() => setLocation("/clients?nouveau=1")}><UserPlus className="h-4 w-4" />Nouveau client</Button></>}</section>
    <section className="space-y-3 rounded-xl border border-border bg-card p-4"><p className="text-sm font-semibold">Produits *</p><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" /><Input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Rechercher un produit (nom, référence, description)" className="pl-9" /></div>
      {productMatches.map(product => <button key={product.id} type="button" onClick={() => { setLines(current => [...current, { productId: product.id, quantity: 1 }]); setProductSearch(""); }} className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-accent"><ProductImage product={product} className="h-9 w-9 text-xs" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}</span><span className="text-xs text-faint">{product.reference} · stock {product.quantity} {product.unit}</span></span><span className="text-sm font-semibold">{formatCurrency(product.retailPriceCents)}</span></button>)}
      {priced.length ? <div className="divide-y divide-border rounded-lg border border-border">{priced.map(line => <div key={line.productId} className="space-y-2 px-3 py-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-medium leading-snug">{line.product.name}</p><p className="text-xs text-faint">{formatCurrency(line.unitPriceCents)} / {line.product.unit}</p></div><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" aria-label={`Retirer ${line.product.name}`} onClick={() => setLines(current => current.filter(item => item.productId !== line.productId))}><Trash2 className="h-4 w-4" /></Button></div><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-1"><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Diminuer" onClick={() => setQuantity(line.productId, line.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button><Input aria-label={`Quantité ${line.product.name}`} type="number" min="1" inputMode="numeric" value={line.quantity} onChange={event => setQuantity(line.productId, Number(event.target.value) || 1)} className="h-8 w-16 text-center" /><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Augmenter" onClick={() => setQuantity(line.productId, line.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button></div><p className="text-right text-sm font-semibold">{formatCurrency(line.totalCents)}</p></div></div>)}</div> : <p className="py-4 text-center text-sm text-faint">Recherchez un produit pour l’ajouter au devis.</p>}
    </section>
    <section className="space-y-2 rounded-xl border border-border bg-card p-4"><p className="text-sm font-semibold">Note pour le client</p><Textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Conditions, délai de livraison…" className="min-h-20" /></section>
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0"><div className="mx-auto flex max-w-2xl items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Total estimé{priced.length ? " (TVA éventuelle en plus)" : ""}</p><p className="text-lg font-bold">{formatCurrency(estimateCents)}</p></div><Button onClick={submit} disabled={create.isPending} className="h-11 bg-primary px-6 text-primary-foreground hover:bg-primary/90">{create.isPending ? "Enregistrement…" : "Enregistrer le devis"}</Button></div></div>
    <Dialog open={Boolean(shared)} onOpenChange={value => { if (!value) { setShared(null); setLocation("/"); } }}><DialogContent className="border-border bg-popover text-foreground"><DialogHeader><DialogTitle>Devis enregistré</DialogTitle></DialogHeader><pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">{shared?.text}</pre><DialogFooter className="gap-2 sm:gap-2"><Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]"><a href={whatsappLink(shared?.phone ?? null, shared?.text ?? "")} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />Envoyer au client</a></Button><Button variant="ghost" onClick={() => { setShared(null); setLocation("/"); }}>Terminé</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
