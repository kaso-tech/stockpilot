import { useAuth } from "@/_core/hooks/useAuth";
import { CheckoutSheet } from "@/components/CheckoutSheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceEmailMessage, invoiceEmailSubject } from "@/lib/invoiceShare";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Mail, Printer, ReceiptText, Trash2, Undo2, WalletCards } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import { InvoiceDocument, StatusBadge, createInvoicePdf, downloadFile } from "./Invoices";

export default function InvoiceDetail() {
  const [, params] = useRoute("/factures/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const id = Number(params?.id);
  const utils = trpc.useUtils();
  const { data: detail, isLoading } = trpc.commerce.sales.detail.useQuery({ id }, { enabled: Number.isFinite(id) && id > 0 });
  const { data: identity } = trpc.commerce.settings.get.useQuery();
  const { data: agents = [] } = trpc.commerce.agents.list.useQuery();
  const [checkout, setCheckout] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const removeDraft = trpc.transactions.removeDraft.useMutation({ onSuccess: () => { utils.transactions.list.invalidate(); toast.success("Facture non encaissée supprimée."); setLocation("/factures"); }, onError: error => toast.error(error.message) });
  const refund = trpc.transactions.refund.useMutation({ onSuccess: () => { utils.transactions.list.invalidate(); utils.movements.list.invalidate(); utils.products.list.invalidate(); utils.dashboard.get.invalidate(); setConfirmRefund(false); toast.success("Remboursement enregistré. Le stock a été réintégré."); }, onError: error => toast.error(error.message) });
  if (isLoading || !detail) return <div className="mx-auto max-w-6xl py-16 text-center text-sm text-muted-foreground">Chargement de la facture…</div>;
  const sale = detail.sale;
  const canRefund = user?.role === "admin" || Boolean(identity?.sellerCanRefund);
  const print = (format: "a4" | "ticket") => { const node = document.getElementById("invoice-print"); if (!node) return; const popup = window.open("", "stockpilot-invoice", "width=900,height=700"); if (!popup) return; const copy = node.cloneNode(true) as HTMLElement; if (format === "ticket") copy.querySelectorAll(".a4-only").forEach(element => element.remove()); popup.document.write(`<!doctype html><html><head><title>Facture</title><style>@page{size:${format === "ticket" ? "80mm auto" : "A4"};margin:12mm}body{font-family:Arial,sans-serif;color:#172033;max-width:${format === "ticket" ? "80mm" : "100%"};margin:0 auto}.row{display:flex;justify-content:space-between;gap:12px}.muted{color:#64748b;font-size:12px}.line{border-top:1px solid #dbe3ea;padding-top:12px;margin-top:12px}.signature{margin-top:32px;text-align:right}.signature.center{text-align:center}.signature.left{text-align:left}.signature img{max-width:180px;max-height:80px;object-fit:contain}</style></head><body>${copy.innerHTML}</body></html>`); popup.document.close(); popup.focus(); window.setTimeout(() => { popup.print(); popup.close(); }, 250); };
  const downloadPdf = () => { const file = createInvoicePdf(detail, identity); downloadFile(file); toast.success("PDF de la facture généré."); };
  const emailPdf = async () => { const email = detail.customer?.email; if (!email) return toast.error("L’adresse e-mail du client n’est pas renseignée."); const file = createInvoicePdf(detail, identity); const subject = invoiceEmailSubject(sale.invoiceNumber); const message = invoiceEmailMessage({ customerName: detail.customer?.name, invoiceNumber: sale.invoiceNumber, total: formatCurrency(sale.totalCents) }); if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ title: subject, text: message, files: [file] }); toast.success("La facture est prête à être envoyée par e-mail."); } catch { return; } } else { downloadFile(file); window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\nLe PDF de la facture a été téléchargé : joignez-le à ce message.`)}`; toast.info("Le PDF est téléchargé. Joignez-le au message e-mail qui s’ouvre."); } };
  const paid = sale.amountPaidCents || 0; const remaining = Math.max(0, sale.totalCents - paid);
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="outline" onClick={() => setLocation("/factures")}><ArrowLeft className="mr-2 h-4 w-4" />Retour aux factures</Button>
      <StatusBadge status={sale.status} />
    </header>
    <section className="rounded-2xl border border-white/[0.07] bg-[#111722] p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Facture</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{sale.invoiceNumber}</h1><p className="mt-2 text-sm text-slate-500">Émise le {formatDate(sale.createdAt, true)}</p></div>
        <div className="grid grid-cols-2 gap-3 text-right"><Info label="Total" value={formatCurrency(sale.totalCents)} /><Info label="Solde" value={formatCurrency(remaining)} /></div>
      </div>
      <div className="mt-6 grid gap-4 border-t border-white/[0.07] pt-5 sm:grid-cols-2 lg:grid-cols-4"><Info label="Client" value={detail.customer?.name || "Client comptoir"} /><Info label="Vendeur" value={detail.participants?.seller?.name || "—"} /><Info label="Agent commercial" value={detail.participants?.salesAgent?.name || "Aucun"} /><Info label="Caissier" value={detail.participants?.cashier?.name || "Aucun"} /></div>
      {sale.deliveryAddress && <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] p-3 text-sm text-slate-300"><span className="font-medium text-cyan-300">Livraison :</span> {sale.deliveryAddress}</div>}
    </section>
    <section className="grid gap-5 lg:grid-cols-[1.5fr_.75fr]">
      <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="p-5"><h2 className="font-semibold text-white">Articles facturés</h2><div className="mt-4 space-y-3">{detail.items.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="min-w-0"><p className="truncate font-medium text-slate-200">{item.productName}</p><p className="mt-1 text-xs text-slate-500">{item.quantity} × {formatCurrency(item.unitPriceCents)}{item.productReference ? ` · ${item.productReference}` : ""}</p></div><p className="shrink-0 font-semibold text-cyan-300">{formatCurrency(item.lineTotalCents)}</p></div>)}</div></CardContent></Card>
      <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="p-5"><h2 className="font-semibold text-white">Règlements</h2><div className="mt-4 space-y-3"><Info label="Encaissé" value={formatCurrency(paid)} /><Info label="Reste à encaisser" value={formatCurrency(remaining)} /><div className="border-t border-white/[0.07] pt-3"><p className="text-xs text-slate-500">Moyens utilisés</p><div className="mt-2 space-y-1 text-sm text-slate-300">{detail.payments.length ? detail.payments.map((payment: any) => <p key={payment.id}>{payment.method} · {formatCurrency(payment.amountCents)}</p>) : <p>Aucun règlement enregistré.</p>}</div></div></div></CardContent></Card>
    </section>
    <section className="rounded-2xl border border-white/[0.07] bg-[#111722] p-5"><div id="invoice-print" className="rounded-xl bg-white p-5 text-slate-900"><InvoiceDocument detail={detail} identity={identity} /></div></section>
    <section className="rounded-2xl border border-white/[0.07] bg-[#111722] p-5"><h2 className="font-semibold text-white">Actions</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Button variant="outline" onClick={downloadPdf}><Download className="mr-2 h-4 w-4" />PDF</Button><Button variant="outline" onClick={() => print("a4")}><Printer className="mr-2 h-4 w-4" />Imprimer A4</Button><Button variant="outline" onClick={() => print("ticket")}><ReceiptText className="mr-2 h-4 w-4" />Imprimer ticket</Button><Button variant="outline" onClick={emailPdf}><Mail className="mr-2 h-4 w-4" />E-mail + PDF</Button>{(sale.status === "draft" || sale.status === "partial") && <Button className="sm:col-span-2 lg:col-span-4 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCheckout(sale)}><WalletCards className="mr-2 h-4 w-4" />Encaisser le solde</Button>}{sale.status === "draft" && <Button variant="outline" className="sm:col-span-2 lg:col-span-4 border-rose-400/30 text-rose-300" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Supprimer la facture</Button>}{(sale.status === "paid" || sale.status === "partial") && <Button variant="outline" disabled={!canRefund} className="sm:col-span-2 lg:col-span-4 border-amber-400/30 text-amber-300" onClick={() => canRefund ? setConfirmRefund(true) : toast.error("Le remboursement n’est pas autorisé pour les vendeurs.")}><Undo2 className="mr-2 h-4 w-4" />Rembourser la facture</Button>}</div></section>
    <CheckoutSheet open={Boolean(checkout)} onOpenChange={open => !open && setCheckout(null)} sale={checkout} agents={agents} settings={identity} onComplete={() => { setCheckout(null); utils.transactions.list.invalidate(); }} />
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible. Seules les factures non encaissées peuvent être supprimées.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction className="bg-rose-600 text-white" onClick={() => removeDraft.mutate({ saleId: sale.id })}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={confirmRefund} onOpenChange={setConfirmRefund}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Rembourser cette facture ?</AlertDialogTitle><AlertDialogDescription>Le stock sera réintégré et les commissions associées seront annulées.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction className="bg-amber-600 text-white" onClick={() => refund.mutate({ saleId: sale.id })}>Confirmer le remboursement</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 truncate font-medium text-slate-200">{value}</p></div>; }
