import { useAuth } from "@/_core/hooks/useAuth";
import { CheckoutSheet } from "@/components/CheckoutSheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoiceEmailMessage, invoiceEmailSubject } from "@/lib/invoiceShare";
import { trpc } from "@/lib/trpc";
import { Download, Eye, Mail, Plus, Printer, ReceiptText, Trash2, Undo2, WalletCards } from "lucide-react";
import { jsPDF } from "jspdf";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Invoice = {
  id: number;
  invoiceNumber: string;
  totalCents: number;
  amountPaidCents: number;
  status: "draft" | "partial" | "paid" | "void";
  createdAt: Date | string;
  customerName?: string | null;
  salesAgentId?: number | null;
  cashierId?: number | null;
};

export default function Invoices() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const initial = Number(new URLSearchParams(window.location.search).get("facture")) || null;
  const [selectedId, setSelectedId] = useState<number | null>(initial);
  const [previewOpen, setPreviewOpen] = useState(Boolean(initial));
  const [checkoutSale, setCheckoutSale] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const utils = trpc.useUtils();
  const { data: transactions = [], isLoading } = trpc.transactions.list.useQuery();
  const { data: detail } = trpc.commerce.sales.detail.useQuery({ id: selectedId ?? 0 }, { enabled: Boolean(selectedId) });
  const { data: identity } = trpc.commerce.settings.get.useQuery();
  const { data: agents = [] } = trpc.commerce.agents.list.useQuery();
  const removeDraft = trpc.transactions.removeDraft.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      setDeleteTarget(null);
      setPreviewOpen(false);
      setSelectedId(null);
      window.history.replaceState({}, "", "/factures");
      toast.success("Facture non encaissée supprimée.");
    },
    onError: error => toast.error(error.message),
  });
  const refund = trpc.transactions.refund.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      utils.movements.list.invalidate();
      utils.products.list.invalidate();
      utils.dashboard.get.invalidate();
      setRefundTarget(null);
      setPreviewOpen(false);
      toast.success("Remboursement enregistré. Le stock a été réintégré.");
    },
    onError: error => toast.error(error.message),
  });
  const invoices = transactions.filter(item => item.channel === "invoice") as Invoice[];
  const canRefund = user?.role === "admin" || Boolean(identity?.sellerCanRefund);

  useEffect(() => {
    if (initial) setPreviewOpen(true);
  }, [initial]);

  const select = (id: number, preview = false) => {
    setSelectedId(id);
    setPreviewOpen(preview);
    window.history.replaceState({}, "", `/factures?facture=${id}`);
  };
  const askRefund = (invoice: Invoice) => {
    if (!canRefund) return toast.error("Le remboursement n’est pas autorisé pour les vendeurs.");
    setRefundTarget(invoice);
  };
  const print = (format: "a4" | "ticket") => {
    const node = document.getElementById("invoice-print");
    if (!node) return;
    const popup = window.open("", "stockpilot-invoice", "width=900,height=700");
    if (!popup) return;
    const copy = node.cloneNode(true) as HTMLElement;
    if (format === "ticket") copy.querySelectorAll(".a4-only").forEach(element => element.remove());
    popup.document.write(`<!doctype html><html><head><title>Facture</title><style>@page{size:${format === "ticket" ? "80mm auto" : "A4"};margin:12mm}body{font-family:Arial,sans-serif;color:#172033;max-width:${format === "ticket" ? "80mm" : "100%"};margin:0 auto}.row{display:flex;justify-content:space-between;gap:12px}.muted{color:#64748b;font-size:12px}.line{border-top:1px solid #dbe3ea;padding-top:12px;margin-top:12px}.signature{margin-top:32px;text-align:right}.signature.center{text-align:center}.signature.left{text-align:left}.signature img{max-width:180px;max-height:80px;object-fit:contain}</style></head><body>${copy.innerHTML}</body></html>`);
    let printTriggered = false;
    const triggerPrint = () => { if (printTriggered) return; printTriggered = true; popup.focus(); popup.print(); };
    popup.addEventListener("afterprint", () => popup.close(), { once: true });
    popup.addEventListener("load", triggerPrint, { once: true });
    popup.document.close();
    window.setTimeout(triggerPrint, 350);
  };
  const downloadPdf = () => {
    if (!detail) return;
    const file = createInvoicePdf(detail, identity);
    downloadFile(file);
    toast.success("PDF de la facture généré.");
  };
  const emailPdf = async () => {
    if (!detail) return;
    const email = detail.customer?.email;
    if (!email) return toast.error("L’adresse e-mail de ce client n’est pas renseignée.");
    const file = createInvoicePdf(detail, identity);
    const subject = invoiceEmailSubject(detail.sale.invoiceNumber);
    const message = invoiceEmailMessage({ customerName: detail.customer?.name, invoiceNumber: detail.sale.invoiceNumber, total: formatCurrency(detail.sale.totalCents) });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: subject, text: message, files: [file] }); toast.success("La facture est prête à être envoyée par e-mail."); } catch { return; }
    } else {
      downloadFile(file);
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\nLe PDF de la facture a été téléchargé : joignez-le à ce message.`)}`;
      toast.info("Le PDF est téléchargé. Joignez-le au message e-mail qui s’ouvre.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Facturation</p>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Factures</h1>
        </div>
        <Button onClick={() => setLocation("/factures/nouvelle")} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Créer une facture</Button>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-12 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card> : invoices.length ? invoices.map(invoice => {
          const remaining = Math.max(0, invoice.totalCents - invoice.amountPaidCents);
          return <button key={invoice.id} type="button" onClick={() => setLocation(`/factures/${invoice.id}`)} className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-[#111722] px-3 py-2.5 text-left shadow-sm transition hover:border-primary/45 hover:bg-[#141e2d]"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-100">{invoice.invoiceNumber}</p><StatusBadge status={invoice.status} /></div><p className="mt-1 truncate text-xs text-slate-400">{invoice.customerName || "Client comptoir"} · {formatDate(invoice.createdAt, true)}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-cyan-300">{formatCurrency(invoice.totalCents)}</p><p className="mt-0.5 text-[11px] text-slate-500">{remaining > 0 ? `Solde ${formatCurrency(remaining)}` : "Réglée"}</p></div><Eye className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-primary" /></button>;
        }) : <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aucune facture créée.</CardContent></Card>}
      </section>

      <Card className="hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Facture</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Règlement</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3" /></tr></thead>
              <tbody className="divide-y divide-border">
                {isLoading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">Chargement…</td></tr> : invoices.length ? invoices.map(invoice => <tr key={invoice.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4"><p className="font-semibold">{invoice.invoiceNumber}</p><p className="text-xs text-muted-foreground">{formatDate(invoice.createdAt, true)}</p></td>
                  <td className="px-4 py-4">{invoice.customerName || "—"}</td>
                  <td className="px-4 py-4"><StatusBadge status={invoice.status} /></td>
                  <td className="px-4 py-4 text-right font-semibold">{formatCurrency(invoice.totalCents)}</td>
                  <td className="px-4 py-4 text-right"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => select(invoice.id, true)}><Eye className="h-4 w-4 text-primary" /></Button>{(invoice.status === "draft" || invoice.status === "partial") && <Button size="sm" variant="outline" onClick={() => { setCheckoutSale(invoice); setPreviewOpen(false); }}><WalletCards className="mr-2 h-4 w-4" />Encaisser</Button>}{invoice.status === "draft" && <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(invoice)} className="text-rose-300"><Trash2 className="h-4 w-4" /></Button>}{(invoice.status === "paid" || invoice.status === "partial") && <Button size="sm" variant="outline" onClick={() => askRefund(invoice)} className="border-amber-400/30 text-amber-600"><Undo2 className="mr-2 h-4 w-4" />Rembourser</Button>}</div></td>
                </tr>) : <tr><td colSpan={5} className="px-5 py-16 text-center text-muted-foreground">Aucune facture créée.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Aperçu de facture</DialogTitle></DialogHeader>
          {detail ? <><div id="invoice-print"><InvoiceDocument detail={detail} identity={identity} /></div><div className="grid gap-2 sm:grid-cols-3"><Button variant="outline" onClick={downloadPdf}><Download className="mr-2 h-4 w-4" />Générer PDF</Button><Button variant="outline" onClick={() => print("a4")}><Printer className="mr-2 h-4 w-4" />Imprimer</Button><Button variant="outline" onClick={emailPdf}><Mail className="mr-2 h-4 w-4" />E-mail + PDF</Button><Button variant="outline" className="sm:col-span-3" onClick={() => print("ticket")}><ReceiptText className="mr-2 h-4 w-4" />Imprimer au format ticket</Button>{(detail.sale.status === "draft" || detail.sale.status === "partial") && <Button className="sm:col-span-3 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setCheckoutSale(detail.sale); setPreviewOpen(false); }}><WalletCards className="mr-2 h-4 w-4" />Encaisser le solde</Button>}{detail.sale.status === "draft" && <Button variant="outline" className="sm:col-span-3 border-rose-400/30 text-rose-300" onClick={() => setDeleteTarget(detail.sale)}><Trash2 className="mr-2 h-4 w-4" />Supprimer la facture</Button>}{(detail.sale.status === "paid" || detail.sale.status === "partial") && <Button variant="outline" className="sm:col-span-3 border-amber-400/30 text-amber-600" onClick={() => askRefund(detail.sale)}><Undo2 className="mr-2 h-4 w-4" />Rembourser la facture</Button>}</div></> : <p className="py-12 text-center text-muted-foreground">Chargement…</p>}
        </DialogContent>
      </Dialog>

      <CheckoutSheet open={Boolean(checkoutSale)} onOpenChange={(open: boolean) => !open && setCheckoutSale(null)} sale={checkoutSale} agents={agents} settings={identity} onComplete={() => { setCheckoutSale(null); utils.transactions.list.invalidate(); }} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible. Seules les factures non encaissées peuvent être supprimées.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteTarget && removeDraft.mutate({ saleId: deleteTarget.id })} className="bg-rose-600 text-white hover:bg-rose-700">Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(refundTarget)} onOpenChange={open => !open && setRefundTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Rembourser cette facture ?</AlertDialogTitle><AlertDialogDescription>Le règlement sera annulé, les articles seront réintégrés au stock et les commissions associées seront retirées. Cette action reste visible dans le journal d’activité.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => refundTarget && refund.mutate({ saleId: refundTarget.id })} className="bg-amber-600 text-white hover:bg-amber-700">Confirmer le remboursement</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const invoiceStatusMeta = { paid: ["Payée", "bg-emerald-500/10 text-emerald-600"], partial: ["Partielle", "bg-orange-500/10 text-orange-600"], draft: ["À encaisser", "bg-orange-500/10 text-orange-600"], void: ["Remboursée / annulée", "bg-rose-500/10 text-rose-600"] } as const;

export function StatusBadge({ status }: { status: Invoice["status"] }) {
  return <Badge className={`border-0 ${invoiceStatusMeta[status][1]}`}>{invoiceStatusMeta[status][0]}</Badge>;
}

export function InvoiceDocument({ detail, identity, documentLabel }: { detail: any; identity: any; documentLabel?: string }) {
  const customer = detail.customer;
  const lineDiscounts = detail.items.reduce((sum: number, item: any) => sum + (item.discountCents || 0), 0);
  const vatCents = detail.sale.vatCents || 0;
  const deliveryFeeCents = detail.sale.deliveryFeeCents || 0;
  return <article><header className="row"><div><p className="muted">{identity?.companyName || "StockPilot"}</p><h2>{documentLabel || (detail.sale.channel === "quote" ? "Devis" : "Facture")} {detail.sale.invoiceNumber}</h2><p className="muted">{formatDate(detail.sale.createdAt, true)}</p></div><StatusBadge status={detail.sale.status} /></header><section className="line row"><div><p className="muted">Facturé à</p><p><b>{customer?.name || "Client comptoir"}</b></p>{detail.sale.deliveryAddress && <p className="muted">Livraison : {detail.sale.deliveryAddress}</p>}</div><div className="text-right"><p className="muted">Total encaissé</p><p><b>{formatCurrency(detail.sale.amountPaidCents || 0)} / {formatCurrency(detail.sale.totalCents)}</b></p></div></section><section className="line space-y-3">{detail.items.map((item: any) => <div className="row" key={item.id}><div><b>{item.productName}</b><p className="muted">{item.quantity} × {formatCurrency(item.unitPriceCents)}</p></div><b>{formatCurrency(item.lineTotalCents)}</b></div>)}</section><section className="line space-y-1"><div className="row muted"><span>Sous-total</span><span>{formatCurrency(detail.sale.subtotalCents || 0)}</span></div>{lineDiscounts > 0 && <div className="row muted"><span>Remises lignes</span><span>-{formatCurrency(lineDiscounts)}</span></div>}{detail.sale.invoiceDiscountCents > 0 && <div className="row muted"><span>Remise facture</span><span>-{formatCurrency(detail.sale.invoiceDiscountCents)}</span></div>}{vatCents > 0 && <div className="row"><span>TVA ({((detail.sale.vatRateBasisPoints || 0) / 100).toFixed(2)} %)</span><span>{formatCurrency(vatCents)}</span></div>}{deliveryFeeCents > 0 && <div className="row"><span>Frais de livraison</span><span>{formatCurrency(deliveryFeeCents)}</span></div>}<div className="row"><span>Total TTC</span><b>{formatCurrency(detail.sale.totalCents)}</b></div></section><section className={`a4-only signature ${identity?.companySignatureAlignment || "right"}`}><p className="muted">{identity?.companyAgreementLabel || "Bon pour accord"}</p>{identity?.companySignatureUrl && <img src={identity.companySignatureUrl} alt="Signature ou cachet" />}</section></article>;
}

export function createInvoicePdf(detail: any, identity: any, documentLabel?: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" }); let y = 56;
  doc.setFontSize(20); doc.setTextColor(0, 123, 139); doc.text(identity?.companyName || "StockPilot", 44, y); y += 26;
  doc.setFontSize(13); doc.setTextColor(15, 23, 42); doc.text(`${documentLabel || (detail.sale.channel === "quote" ? "Devis" : "Facture")} ${detail.sale.invoiceNumber}`, 44, y); y += 18;
  doc.setFontSize(9); doc.setTextColor(90, 101, 115); doc.text(formatDate(detail.sale.createdAt, true), 44, y); y += 28;
  doc.setDrawColor(0, 123, 139); doc.line(44, y, 552, y); y += 22;
  doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.text(`Client : ${detail.customer?.name || "Client comptoir"}`, 44, y); y += 16;
  if (detail.sale.deliveryAddress) { doc.setFontSize(9); doc.setTextColor(90, 101, 115); doc.text(`Livraison : ${detail.sale.deliveryAddress}`, 44, y, { maxWidth: 500 }); y += 28; }
  doc.setFontSize(9); doc.setTextColor(30, 41, 59); doc.text("Produit", 44, y); doc.text("Qté", 380, y); doc.text("Total", 552, y, { align: "right" }); y += 14;
  detail.items.forEach((item: any) => { if (y > 760) { doc.addPage(); y = 56; } doc.setDrawColor(220, 229, 237); doc.line(44, y, 552, y); y += 16; doc.setTextColor(30, 41, 59); doc.text(item.productName, 44, y, { maxWidth: 300 }); doc.text(String(item.quantity), 380, y); doc.text(formatCurrency(item.lineTotalCents), 552, y, { align: "right" }); y += 13; });
  y += 18; doc.setFontSize(9); doc.setTextColor(90, 101, 115); doc.text(`Sous-total : ${formatCurrency(detail.sale.subtotalCents || 0)}`, 552, y, { align: "right" }); y += 14; if (detail.sale.invoiceDiscountCents > 0) { doc.text(`Remise facture : -${formatCurrency(detail.sale.invoiceDiscountCents)}`, 552, y, { align: "right" }); y += 14; } if (detail.sale.vatCents > 0) { doc.text(`TVA (${((detail.sale.vatRateBasisPoints || 0) / 100).toFixed(2)} %) : ${formatCurrency(detail.sale.vatCents)}`, 552, y, { align: "right" }); y += 14; } if (detail.sale.deliveryFeeCents > 0) { doc.text(`Livraison : ${formatCurrency(detail.sale.deliveryFeeCents)}`, 552, y, { align: "right" }); y += 14; } doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.text(`Total TTC : ${formatCurrency(detail.sale.totalCents)}`, 552, y, { align: "right" });
  return new File([doc.output("blob")], `${detail.sale.invoiceNumber}.pdf`, { type: "application/pdf" });
}
export function downloadFile(file: File) { const url = URL.createObjectURL(file); const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url); }
