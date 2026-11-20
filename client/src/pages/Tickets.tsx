import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckoutSheet, printPosReceipt } from "@/components/CheckoutSheet";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/format";
import { documentParticipantNames, documentParticipantOptionLabel, matchesDocumentParticipant } from "@/lib/documentParticipants";
import { trpc } from "@/lib/trpc";
import { useActiveWarehouse } from "@/contexts/ActiveWarehouseContext";
import { Download, Eye, FileText, Printer, ReceiptText, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { downloadCommercialDocumentsCsv } from "@/lib/documentCsv";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type TicketStatus = "draft" | "partial" | "paid" | "void";
type Ticket = { id: number; invoiceNumber: string; totalCents: number; amountPaidCents: number; status: TicketStatus; refundedAt?: Date | string | null; createdAt: Date | string; sellerUserId?: number | null; salesAgentId?: number | null; cashierId?: number | null };

const statusMeta: Record<TicketStatus, [string, string]> = {
  draft: ["À encaisser", "bg-warning-soft text-warning"],
  partial: ["Partiel", "bg-warning-soft text-warning"],
  paid: ["Encaissé", "bg-success-soft text-success"],
  void: ["Retourné", "bg-destructive-soft text-destructive"],
};
/** Un ticket « void » sans remboursement est un ticket annulé avant encaissement. */
const ticketStatus = (ticket: { status: string; refundedAt?: Date | string | null }): [string, string] => ticket.status === "void" && !ticket.refundedAt ? ["Annulé", "bg-muted text-muted-foreground"] : statusMeta[ticket.status as TicketStatus] ?? statusMeta.draft;

export default function Tickets() {
  const { user } = useAuth();
  const { activeWarehouseId } = useActiveWarehouse();
  const [, setLocation] = useLocation();
  const { data: transactions = [], isLoading } = trpc.transactions.list.useQuery(user?.role === "admin" && activeWarehouseId ? { warehouseId: activeWarehouseId } : undefined);
  const { data: agents = [] } = trpc.commerce.agents.list.useQuery();
  const { data: documentParticipants = [] } = trpc.commerce.documentParticipants.useQuery();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TicketStatus | "unpaid">("all");
  const [agentId, setAgentId] = useState("all");
  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">("all");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [checkoutTicket, setCheckoutTicket] = useState<Ticket | null>(null);
  const { data: settings } = trpc.commerce.settings.get.useQuery();
  const { data: ticketDetail, isLoading: isDetailLoading } = trpc.commerce.sales.detail.useQuery({ id: selectedTicketId ?? 0 }, { enabled: selectedTicketId !== null });
  const tickets = useMemo(() => (transactions as Ticket[]).filter(ticket => {
    if ((ticket as any).channel !== "pos") return false;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || ticket.invoiceNumber.toLowerCase().includes(term);
    const matchesStatus = status === "all" || (status === "unpaid" ? ticket.status === "draft" || ticket.status === "partial" : ticket.status === status);
    const matchesAgent = matchesDocumentParticipant(ticket, agentId);
    const created = new Date(ticket.createdAt).getTime(); const now = Date.now();
    const matchesPeriod = period === "all" || (period === "today" ? created >= new Date().setHours(0, 0, 0, 0) : period === "week" ? created >= now - 7 * 86_400_000 : created >= now - 31 * 86_400_000);
    return matchesSearch && matchesStatus && matchesAgent && matchesPeriod;
  }), [agentId, period, search, status, transactions]);
  const openTickets = tickets.filter(ticket => ticket.status === "draft" || ticket.status === "partial").length;
  const exportFilteredTickets = () => downloadCommercialDocumentsCsv("tickets-filtres.csv", tickets.map(ticket => ({ reference: ticket.invoiceNumber, date: ticket.createdAt, client: "Client comptoir", statut: ticketStatus(ticket)[0], agent: documentParticipantNames(ticket, documentParticipants), totalCents: ticket.totalCents, encaisseCents: ticket.amountPaidCents })));

  const utils = trpc.useUtils();
  const cancelTicket = trpc.transactions.removeDraft.useMutation({ onSuccess: () => { toast.success("Ticket annulé."); void utils.transactions.list.invalidate(); if (selectedTicketId) void utils.commerce.sales.detail.invalidate({ id: selectedTicketId }); }, onError: error => toast.error(error.message) });
  const selectedTicket = ticketDetail?.sale;
  const selectedItems = ticketDetail?.items ?? [];
  const selectedOpen = selectedTicket?.status === "draft" || selectedTicket?.status === "partial";
  const convertToInvoice = () => {
    if (!ticketDetail) return;
    sessionStorage.setItem("stockpilot-ticket-to-invoice", JSON.stringify({
      sourceTicketId: ticketDetail.sale.id,
      customerId: ticketDetail.sale.customerId ?? null,
      salesAgentId: ticketDetail.sale.salesAgentId ?? null,
      cashierId: ticketDetail.sale.cashierId ?? null,
      items: selectedItems.map((item: any) => ({ productId: item.productId, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
    }));
    setSelectedTicketId(null);
    setLocation(`/factures/nouvelle?fromTicket=${ticketDetail.sale.id}`);
  };
  const printSelectedTicket = () => {
    if (!ticketDetail) return;
    const popup = window.open("", "stockpilot-pos-receipt", "width=460,height=760");
    if (!printPosReceipt(ticketDetail, settings, popup)) popup?.close();
  };
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-[22px] font-bold tracking-tight text-foreground">Tickets de caisse</h1></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportFilteredTickets}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button><Button onClick={() => setLocation("/pos")} className="bg-primary text-primary-foreground hover:bg-primary/90"><ReceiptText className="mr-2 h-4 w-4" />Nouvelle vente</Button></div></header>
    <section className="rounded-xl border border-border bg-card p-4"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(150px,.45fr))]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-faint" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ticket, référence…" className="h-10 w-full rounded-xl border border-border bg-muted pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary/70" /></label><select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground"><option value="all">Tous les statuts</option><option value="unpaid">Non encaissés</option><option value="paid">Encaissés</option><option value="void">Retournés ou annulés</option></select><select value={agentId} onChange={event => setAgentId(event.target.value)} className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground"><option value="all">Tous les intervenants</option>{documentParticipants.map(participant => <option key={participant.key} value={participant.key}>{documentParticipantOptionLabel(participant)}</option>)}</select><select value={period} onChange={event => setPeriod(event.target.value as typeof period)} className="h-10 rounded-xl border border-border bg-muted px-3 text-sm text-foreground"><option value="all">Toutes les dates</option><option value="today">Aujourd’hui</option><option value="week">7 derniers jours</option><option value="month">30 derniers jours</option></select></div><p className="mt-3 text-xs text-faint">{tickets.length} ticket{tickets.length > 1 ? "s" : ""} affiché{tickets.length > 1 ? "s" : ""} · {openTickets} à encaisser</p></section>
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{isLoading ? <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-12 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card> : tickets.length ? tickets.map(ticket => { const remaining = ticket.status === "void" ? 0 : Math.max(0, ticket.totalCents - ticket.amountPaidCents); return <button key={ticket.id} type="button" onClick={() => setSelectedTicketId(ticket.id)} className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition hover:border-primary/45 hover:bg-card"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-foreground">{ticket.invoiceNumber}</p><Badge className={`border-0 ${ticketStatus(ticket)[1]}`}>{ticketStatus(ticket)[0]}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{formatDate(ticket.createdAt, true)}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-primary">{formatCurrency(ticket.totalCents)}</p><p className="mt-0.5 text-xs text-faint">{ticket.status === "void" ? ticketStatus(ticket)[0] : remaining > 0 ? `Solde ${formatCurrency(remaining)}` : "Soldé"}</p></div><Eye className="h-4 w-4 shrink-0 text-faint transition group-hover:text-primary" /></button>; }) : <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-16 text-center"><ReceiptText className="mx-auto h-7 w-7 text-faint" /><p className="mt-4 text-sm text-muted-foreground">Aucun ticket ne correspond aux filtres.</p><Button onClick={() => setLocation("/pos")} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">Démarrer une vente rapide</Button></CardContent></Card>}</section>
    <Dialog open={selectedTicketId !== null} onOpenChange={open => !open && setSelectedTicketId(null)}><DialogContent className="max-w-xl border-border bg-card text-foreground"><DialogHeader><DialogTitle className="flex items-center gap-2 text-foreground"><ReceiptText className="h-5 w-5 text-primary" />{selectedTicket?.invoiceNumber || "Ticket"}</DialogTitle></DialogHeader>{isDetailLoading || !selectedTicket ? <p className="py-10 text-center text-sm text-muted-foreground">Chargement du ticket…</p> : <div className="space-y-4"><div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-3"><div><p className="text-xs text-muted-foreground">Créé le {formatDate(selectedTicket.createdAt, true)}</p><Badge className={`mt-1 border-0 ${ticketStatus(selectedTicket)[1]}`}>{ticketStatus(selectedTicket)[0]}</Badge></div><div className="text-right"><p className="text-lg font-semibold text-primary">{formatCurrency(selectedTicket.totalCents)}</p>{selectedTicket.status !== "void" && <p className="text-xs text-muted-foreground">Solde {formatCurrency(Math.max(0, selectedTicket.totalCents - selectedTicket.amountPaidCents))}</p>}</div></div><div className="max-h-56 space-y-2 overflow-y-auto">{selectedItems.map((item: any) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span className="min-w-0 truncate text-foreground">{item.productName} <span className="text-faint">× {item.quantity}</span></span><span className="ml-3 shrink-0 font-medium text-foreground">{formatCurrency(item.lineTotalCents)}</span></div>)}</div></div>}<DialogFooter className="flex flex-wrap gap-2 sm:justify-end"><Button variant="outline" onClick={printSelectedTicket} disabled={!selectedTicket}><Printer className="mr-2 h-4 w-4" />Imprimer</Button>{selectedTicket?.status !== "void" && <Button variant="outline" onClick={convertToInvoice} disabled={!selectedTicket}><FileText className="mr-2 h-4 w-4" />Convertir en facture</Button>}{selectedTicket?.status === "draft" && selectedTicket.amountPaidCents === 0 && <Button variant="outline" disabled={cancelTicket.isPending} onClick={() => window.confirm(`Annuler le ticket ${selectedTicket.invoiceNumber} ? Il restera visible avec le statut « Annulé ». Aucun stock n’est modifié.`) && cancelTicket.mutate({ saleId: selectedTicket.id })} className="border-destructive/30 text-destructive hover:bg-destructive-soft hover:text-destructive"><XCircle className="mr-2 h-4 w-4" />Annuler le ticket</Button>}{selectedOpen && <Button onClick={() => setCheckoutTicket(selectedTicket as Ticket)} className="bg-primary text-primary-foreground hover:bg-primary/90"><ReceiptText className="mr-2 h-4 w-4" />Encaisser</Button>}</DialogFooter></DialogContent></Dialog>
    <CheckoutSheet open={checkoutTicket !== null} onOpenChange={open => !open && setCheckoutTicket(null)} sale={checkoutTicket ? { id: checkoutTicket.id, totalCents: checkoutTicket.totalCents, amountPaidCents: checkoutTicket.amountPaidCents, invoiceNumber: checkoutTicket.invoiceNumber, channel: "pos", salesAgentId: checkoutTicket.salesAgentId, cashierId: checkoutTicket.cashierId } : null} agents={agents as any} settings={settings} onComplete={() => { setCheckoutTicket(null); setSelectedTicketId(null); }} />
  </div>;
}
