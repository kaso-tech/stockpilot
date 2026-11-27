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
import { Banknote, CheckCircle2, Lock, Search, ShoppingCart, Undo2, Wallet, XCircle } from "lucide-react";
import { formatQueueNumber, playAlert } from "@/lib/notifySound";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type QueueTicket = { id: number; invoiceNumber: string; queueNumber: number | null; holdLabel: string | null; queuedAt: Date | null; beingCollectedElsewhere: boolean; status: string; totalCents: number; amountPaidCents: number; balanceCents: number; createdAt: Date; customerName: string | null; sellerName: string | null; salesAgentId: number | null; cashierId: number | null; items: Array<{ productName: string; quantity: number; lineTotalCents: number }> };

const methodLabels: Record<string, string> = { cash: "Espèces", mobile_money: "Mobile money", card: "Carte", bank_transfer: "Virement", credit: "Crédit client" };
const toCents = (value: string) => Math.max(0, Math.round((Number(value.replace(/\s/g, "").replace(",", ".")) || 0) * 100));

/** Espace caissier : tickets à encaisser, vente rapide et caisse du jour avec clôture. */
export default function CashierSpace() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { activeWarehouseId, activeWarehouse } = useActiveWarehouse();
  const context = trpc.cashierSpace.context.useQuery();
  const warehouseInput = { warehouseId: activeWarehouseId ?? 0 };
  const queue = trpc.cashierSpace.queue.useQuery(warehouseInput, { enabled: Boolean(activeWarehouseId) && context.isSuccess, refetchInterval: 5_000 });
  const summary = trpc.accounting.cash.summary.useQuery(warehouseInput, { enabled: Boolean(activeWarehouseId) && context.isSuccess, refetchInterval: 30_000 });
  const [checkoutTicket, setCheckoutTicket] = useState<QueueTicket | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<{ kind: "return" | "cancel"; ticket: QueueTicket } | null>(null);
  const [reason, setReason] = useState("");
  const lock = trpc.posTickets.lock.useMutation({ onError: error => { toast.error(error.message); void utils.cashierSpace.queue.invalidate(); } });
  const unlock = trpc.posTickets.unlock.useMutation();
  const returnToSeller = trpc.posTickets.returnToSeller.useMutation({ onSuccess: () => { toast.success("Ticket renvoyé au vendeur."); setAction(null); refresh(); }, onError: error => toast.error(error.message) });
  const cancelQueued = trpc.posTickets.cancelQueued.useMutation({ onSuccess: () => { toast.success("Ticket annulé."); setAction(null); refresh(); }, onError: error => toast.error(error.message) });
  /** Ouvre l’encaissement après avoir verrouillé le ticket (personne d’autre ne peut le modifier ou l’encaisser). */
  const startCheckout = async (ticket: QueueTicket) => { try { await lock.mutateAsync({ saleId: ticket.id }); setCheckoutTicket(ticket); } catch { /* message affiché */ } };
  const closeCheckout = () => { if (checkoutTicket) unlock.mutate({ saleId: checkoutTicket.id }); setCheckoutTicket(null); };
  // Alerte à l’arrivée d’un nouveau ticket dans la file.
  const knownTickets = useRef<Set<number> | null>(null);
  useEffect(() => {
    const rows = queue.data as QueueTicket[] | undefined;
    if (!rows) return;
    const ids = new Set(rows.map(row => row.id));
    if (knownTickets.current) { const fresh = rows.filter(row => !knownTickets.current!.has(row.id)); if (fresh.length) { playAlert("info"); toast.info(fresh.length === 1 ? `Nouveau ticket n° ${formatQueueNumber(fresh[0].queueNumber)}${fresh[0].holdLabel ? ` · ${fresh[0].holdLabel}` : ""}` : `${fresh.length} nouveaux tickets en caisse`); } }
    knownTickets.current = ids;
  }, [queue.data]);
  const [closing, setClosing] = useState(false);
  const [closeForm, setCloseForm] = useState({ openingFloat: "", countedCash: "", note: "" });
  const refresh = () => { void utils.cashierSpace.queue.invalidate(); void utils.accounting.cash.summary.invalidate(); };
  const close = trpc.accounting.cash.close.useMutation({
    onSuccess: result => { refresh(); setClosing(false); toast.success("Caisse clôturée.", { description: result.differenceCents === 0 ? "Aucun écart." : `Écart : ${formatCurrency(result.differenceCents)}` }); },
    onError: error => toast.error(error.message),
  });
  if (context.isLoading) return <div className="py-20 text-center text-sm text-faint">Chargement de votre caisse…</div>;
  if (context.error || !context.data) return <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Ma caisse</h1><p className="mt-2 text-sm text-muted-foreground">{context.error?.message ?? "Espace indisponible."}</p></section>;
  const allTickets = (queue.data ?? []) as QueueTicket[];
  const searchValue = search.trim().toLowerCase();
  const tickets = searchValue ? allTickets.filter(ticket => String(ticket.queueNumber ?? "").padStart(3, "0").includes(searchValue.replace(/^0+/, "")) || formatQueueNumber(ticket.queueNumber).includes(searchValue) || (ticket.holdLabel ?? "").toLowerCase().includes(searchValue) || (ticket.customerName ?? "").toLowerCase().includes(searchValue)) : allTickets;
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
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-semibold text-foreground">À encaisser</p><p className="text-xs text-faint">Tickets préparés en attente de paiement · mis à jour automatiquement</p></div><Badge className={`border-0 ${allTickets.length ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>{allTickets.length}</Badge></div>
      {allTickets.length > 3 && <div className="border-b border-border px-5 py-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" /><Input inputMode="numeric" value={search} onChange={event => setSearch(event.target.value)} placeholder="N° du ticket ou repère du client" className="h-10 pl-9" /></div></div>}
      {queue.isLoading ? <p className="px-5 py-10 text-center text-sm text-faint">Chargement…</p> : tickets.length ? <div className="divide-y divide-border">{tickets.map(ticket => <div key={ticket.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-primary/10 font-mono text-xl font-bold text-primary">{formatQueueNumber(ticket.queueNumber)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{ticket.holdLabel || ticket.customerName || "Client de passage"}</p>{ticket.beingCollectedElsewhere && <Badge className="border-0 bg-muted text-muted-foreground">En cours sur un autre poste</Badge>}{ticket.status === "partial" && <Badge className="border-0 bg-warning-soft text-warning">Paiement partiel</Badge>}</div><p className="mt-0.5 text-xs text-faint">{ticket.invoiceNumber} · {formatDate(ticket.createdAt, true)}{ticket.sellerName ? ` · préparé par ${ticket.sellerName}` : ""}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.items.map(item => `${item.productName} × ${item.quantity}`).join(" · ")}</p></div>
        <div className="flex items-center justify-between gap-4 sm:justify-end"><div className="text-right"><p className="text-lg font-bold text-foreground">{formatCurrency(ticket.balanceCents)}</p>{ticket.amountPaidCents > 0 && <p className="text-xs text-faint">sur {formatCurrency(ticket.totalCents)}</p>}</div><div className="flex flex-col gap-1.5"><Button onClick={() => void startCheckout(ticket)} disabled={closed || ticket.beingCollectedElsewhere || lock.isPending} className="h-11 min-w-32 bg-primary text-primary-foreground hover:bg-primary/90"><Banknote className="h-4 w-4" />Encaisser</Button><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" disabled={ticket.beingCollectedElsewhere} onClick={() => { setReason(""); setAction({ kind: "return", ticket }); }} className="h-7 px-2 text-xs"><Undo2 className="h-3.5 w-3.5" />Renvoyer</Button><Button variant="ghost" size="sm" disabled={ticket.beingCollectedElsewhere || ticket.amountPaidCents > 0} onClick={() => { setReason(""); setAction({ kind: "cancel", ticket }); }} className="h-7 px-2 text-xs text-destructive hover:text-destructive"><XCircle className="h-3.5 w-3.5" />Annuler</Button></div></div></div>
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

    <CheckoutSheet open={checkoutTicket !== null} onOpenChange={open => !open && closeCheckout()} sale={checkoutTicket ? { id: checkoutTicket.id, totalCents: checkoutTicket.totalCents, amountPaidCents: checkoutTicket.amountPaidCents, invoiceNumber: checkoutTicket.invoiceNumber, channel: "pos", salesAgentId: checkoutTicket.salesAgentId, cashierId: context.data.cashier.id } : null} agents={context.data.agents} settings={context.data.settings as never} onComplete={() => { setCheckoutTicket(null); refresh(); }} />

    <Dialog open={Boolean(action)} onOpenChange={open => !open && setAction(null)}><DialogContent className="border-border bg-popover text-foreground"><DialogHeader><DialogTitle>{action?.kind === "return" ? "Renvoyer au vendeur" : "Annuler le ticket"} n° {formatQueueNumber(action?.ticket.queueNumber)}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{action?.kind === "return" ? "Le ticket revient dans les paniers du vendeur, qui est prévenu avec votre motif." : "Le ticket est annulé ; aucun stock n’a été sorti. Le vendeur est prévenu."}</p><div className="flex flex-wrap gap-2">{(action?.kind === "return" ? ["Le client veut changer un article", "Le client veut ajouter un article", "Erreur de quantité"] : ["Client parti", "Le client a renoncé", "Ticket en double"]).map(item => <Button key={item} type="button" variant="outline" size="sm" onClick={() => setReason(item)}>{item}</Button>)}</div><Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Motif *" className="min-h-16" /><DialogFooter><Button variant="ghost" onClick={() => setAction(null)}>Retour</Button><Button disabled={reason.trim().length < 2 || returnToSeller.isPending || cancelQueued.isPending} onClick={() => { if (!action) return; if (action.kind === "return") returnToSeller.mutate({ saleId: action.ticket.id, reason: reason.trim() }); else cancelQueued.mutate({ saleId: action.ticket.id, reason: reason.trim() }); }} className={action?.kind === "cancel" ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}>{action?.kind === "return" ? "Renvoyer au vendeur" : "Annuler le ticket"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={closing} onOpenChange={setClosing}><DialogContent className="border-border bg-popover text-foreground"><DialogHeader><DialogTitle>Clôturer la caisse</DialogTitle></DialogHeader>
      <div className="space-y-4">{allTickets.length > 0 && <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning"><p className="font-semibold">{allTickets.length} ticket(s) encore en attente</p><p className="mt-0.5 text-xs">{allTickets.slice(0, 8).map(ticket => `n° ${formatQueueNumber(ticket.queueNumber)}`).join(", ")} — encaissez-les, renvoyez-les ou annulez-les avant de clôturer.</p></div>}<div className="rounded-xl bg-muted/50 p-3 text-sm"><p className="text-muted-foreground">Espèces encaissées aujourd’hui</p><p className="text-lg font-semibold">{formatCurrency(day?.totals.cash ?? 0)}</p></div>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Fond de caisse du matin (FCFA)</span><Input inputMode="decimal" value={closeForm.openingFloat} onChange={event => setCloseForm(current => ({ ...current, openingFloat: event.target.value }))} placeholder="0" /></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Espèces comptées dans la caisse (FCFA) *</span><Input inputMode="decimal" value={closeForm.countedCash} onChange={event => setCloseForm(current => ({ ...current, countedCash: event.target.value }))} placeholder="Montant compté" /></label>
        <p className="text-sm text-muted-foreground">Attendu : <span className="font-semibold text-foreground">{formatCurrency(expectedCash)}</span>{closeForm.countedCash.trim() !== "" && <> · écart <span className={toCents(closeForm.countedCash) - expectedCash === 0 ? "text-success" : "text-warning"}>{formatCurrency(toCents(closeForm.countedCash) - expectedCash)}</span></>}</p>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Note</span><Textarea value={closeForm.note} onChange={event => setCloseForm(current => ({ ...current, note: event.target.value }))} placeholder="Explication d’un écart, remise au gérant…" className="min-h-16" /></label>
      </div>
      <DialogFooter><Button variant="ghost" onClick={() => setClosing(false)}>Annuler</Button><Button onClick={submitClose} disabled={close.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90"><Wallet className="h-4 w-4" />{close.isPending ? "Clôture…" : "Valider la clôture"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
