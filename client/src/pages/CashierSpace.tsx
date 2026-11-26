import { CheckoutSheet } from "@/components/CheckoutSheet";
import { StatCard } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Banknote, CheckCircle2, Lock, ShoppingCart, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type QueueTicket = { id: number; invoiceNumber: string; status: string; totalCents: number; amountPaidCents: number; balanceCents: number; createdAt: Date; customerName: string | null; sellerName: string | null; salesAgentId: number | null; cashierId: number | null; items: Array<{ productName: string; quantity: number; lineTotalCents: number }> };

const methodLabels: Record<string, string> = { cash: "Espèces", mobile_money: "Mobile money", card: "Carte", bank_transfer: "Virement", credit: "Crédit client" };
const toCents = (value: string) => Math.max(0, Math.round((Number(value.replace(/\s/g, "").replace(",", ".")) || 0) * 100));

/** Espace caissier : tickets à encaisser, vente rapide et caisse du jour avec clôture. */
export default function CashierSpace() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { activeWarehouseId, activeWarehouse } = useActiveWarehouse();
  const context = trpc.cashierSpace.context.useQuery();
  const warehouseInput = { warehouseId: activeWarehouseId ?? 0 };
  const queue = trpc.cashierSpace.queue.useQuery(warehouseInput, { enabled: Boolean(activeWarehouseId) && context.isSuccess, refetchInterval: 15_000 });
  const summary = trpc.accounting.cash.summary.useQuery(warehouseInput, { enabled: Boolean(activeWarehouseId) && context.isSuccess, refetchInterval: 30_000 });
  const [checkoutTicket, setCheckoutTicket] = useState<QueueTicket | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeForm, setCloseForm] = useState({ openingFloat: "", countedCash: "", note: "" });
  const refresh = () => { void utils.cashierSpace.queue.invalidate(); void utils.accounting.cash.summary.invalidate(); };
  const close = trpc.accounting.cash.close.useMutation({
    onSuccess: result => { refresh(); setClosing(false); toast.success("Caisse clôturée.", { description: result.differenceCents === 0 ? "Aucun écart." : `Écart : ${formatCurrency(result.differenceCents)}` }); },
    onError: error => toast.error(error.message),
  });
  if (context.isLoading) return <div className="py-20 text-center text-sm text-faint">Chargement de votre caisse…</div>;
  if (context.error || !context.data) return <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Ma caisse</h1><p className="mt-2 text-sm text-muted-foreground">{context.error?.message ?? "Espace indisponible."}</p></section>;
  const tickets = (queue.data ?? []) as QueueTicket[];
  const day = summary.data;
  const closed = Boolean(day?.closure);
  const expectedCash = toCents(closeForm.openingFloat) + (day?.totals.cash ?? 0);
  const submitClose = () => {
    if (!activeWarehouseId || !day) return;
    if (closeForm.countedCash.trim() === "") return toast.error("Saisissez le montant compté dans la caisse.");
    close.mutate({ warehouseId: activeWarehouseId, businessDay: day.businessDay, openingFloatCents: toCents(closeForm.openingFloat), countedCashCents: toCents(closeForm.countedCash), note: closeForm.note.trim() || null });
  };
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-medium text-primary">Caisse · {activeWarehouse?.name ?? "Entrepôt"}</p><h1 className="text-[22px] font-bold tracking-tight text-foreground">Bonjour {context.data.cashier.name.split(" ")[0]}</h1></div>
      <Button onClick={() => setLocation("/pos")} className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"><ShoppingCart className="h-5 w-5" />Vente rapide</Button>
    </header>

    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-semibold text-foreground">À encaisser</p><p className="text-xs text-faint">Tickets préparés en attente de paiement · mis à jour automatiquement</p></div><Badge className={`border-0 ${tickets.length ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>{tickets.length}</Badge></div>
      {queue.isLoading ? <p className="px-5 py-10 text-center text-sm text-faint">Chargement…</p> : tickets.length ? <div className="divide-y divide-border">{tickets.map(ticket => <div key={ticket.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{ticket.customerName ?? "Client de passage"}</p>{ticket.status === "partial" && <Badge className="border-0 bg-warning-soft text-warning">Paiement partiel</Badge>}</div><p className="mt-0.5 text-xs text-faint">{ticket.invoiceNumber} · {formatDate(ticket.createdAt, true)}{ticket.sellerName ? ` · préparé par ${ticket.sellerName}` : ""}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.items.map(item => `${item.productName} × ${item.quantity}`).join(" · ")}</p></div>
        <div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className="text-lg font-bold text-foreground">{formatCurrency(ticket.balanceCents)}</p>{ticket.amountPaidCents > 0 && <p className="text-xs text-faint">sur {formatCurrency(ticket.totalCents)}</p>}</div><Button onClick={() => setCheckoutTicket(ticket)} disabled={closed} className="h-11 min-w-32 bg-primary text-primary-foreground hover:bg-primary/90"><Banknote className="h-4 w-4" />Encaisser</Button></div>
      </div>)}</div> : <div className="flex flex-col items-center gap-2 px-5 py-10 text-center"><CheckCircle2 className="h-8 w-8 text-success" /><p className="text-sm text-muted-foreground">Aucun ticket en attente.</p></div>}
    </section>

    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-foreground">Ma caisse du jour{day ? ` · ${formatDate(`${day.businessDay}T12:00:00`)}` : ""}</h2>{closed ? <Badge className="border-0 bg-success-soft text-success"><Lock className="mr-1 h-3 w-3" />Clôturée</Badge> : <Button variant="outline" disabled={!day} onClick={() => { setCloseForm({ openingFloat: "", countedCash: "", note: "" }); setClosing(true); }}><Lock className="h-4 w-4" />Clôturer la caisse</Button>}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total encaissé" value={formatCurrency(day?.totalCents ?? 0)} tone="primary" note={`${day?.documentCount ?? 0} ticket(s) ou facture(s)`} />
        {Object.entries(day?.totals ?? {}).filter(([, cents]) => cents > 0).map(([method, cents]) => <StatCard key={method} label={methodLabels[method] ?? method} value={formatCurrency(cents)} />)}
      </div>
      {closed && day?.closure && <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Clôture : attendu {formatCurrency(day.closure.expectedCashCents)}, compté {formatCurrency(day.closure.countedCashCents)}, écart <span className={day.closure.differenceCents === 0 ? "text-success" : "text-warning"}>{formatCurrency(day.closure.differenceCents)}</span>. Les nouveaux encaissements du jour ne sont plus proposés dans cet espace.</p>}
    </section>

    <CheckoutSheet open={checkoutTicket !== null} onOpenChange={open => !open && setCheckoutTicket(null)} sale={checkoutTicket ? { id: checkoutTicket.id, totalCents: checkoutTicket.totalCents, amountPaidCents: checkoutTicket.amountPaidCents, invoiceNumber: checkoutTicket.invoiceNumber, channel: "pos", salesAgentId: checkoutTicket.salesAgentId, cashierId: context.data.cashier.id } : null} agents={context.data.agents} settings={context.data.settings as never} onComplete={() => { setCheckoutTicket(null); refresh(); }} />

    <Dialog open={closing} onOpenChange={setClosing}><DialogContent className="border-border bg-popover text-foreground"><DialogHeader><DialogTitle>Clôturer la caisse</DialogTitle></DialogHeader>
      <div className="space-y-4"><div className="rounded-xl bg-muted/50 p-3 text-sm"><p className="text-muted-foreground">Espèces encaissées aujourd’hui</p><p className="text-lg font-semibold">{formatCurrency(day?.totals.cash ?? 0)}</p></div>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Fond de caisse du matin (FCFA)</span><Input inputMode="decimal" value={closeForm.openingFloat} onChange={event => setCloseForm(current => ({ ...current, openingFloat: event.target.value }))} placeholder="0" /></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Espèces comptées dans la caisse (FCFA) *</span><Input inputMode="decimal" value={closeForm.countedCash} onChange={event => setCloseForm(current => ({ ...current, countedCash: event.target.value }))} placeholder="Montant compté" /></label>
        <p className="text-sm text-muted-foreground">Attendu : <span className="font-semibold text-foreground">{formatCurrency(expectedCash)}</span>{closeForm.countedCash.trim() !== "" && <> · écart <span className={toCents(closeForm.countedCash) - expectedCash === 0 ? "text-success" : "text-warning"}>{formatCurrency(toCents(closeForm.countedCash) - expectedCash)}</span></>}</p>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Note</span><Textarea value={closeForm.note} onChange={event => setCloseForm(current => ({ ...current, note: event.target.value }))} placeholder="Explication d’un écart, remise au gérant…" className="min-h-16" /></label>
      </div>
      <DialogFooter><Button variant="ghost" onClick={() => setClosing(false)}>Annuler</Button><Button onClick={submitClose} disabled={close.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90"><Wallet className="h-4 w-4" />{close.isPending ? "Clôture…" : "Valider la clôture"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
