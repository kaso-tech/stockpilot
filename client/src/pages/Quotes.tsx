import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { createInvoicePdf, downloadFile, InvoiceDocument } from "./Invoices";
import { Download, Eye, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Quotes() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: transactions = [], isLoading } = trpc.transactions.list.useQuery();
  const { data: detail } = trpc.commerce.sales.detail.useQuery({ id: selectedId ?? 0 }, { enabled: Boolean(selectedId) });
  const quotes = transactions.filter(item => item.channel === "quote");
  const identity = trpc.commerce.settings.get.useQuery().data;
  if (user?.role !== "admin" && user?.role !== "seller") return <div className="mx-auto max-w-5xl py-16 text-center text-muted-foreground">Accès réservé aux utilisateurs autorisés.</div>;
  return <div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Documents commerciaux</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Devis</h1><p className="mt-2 text-sm text-slate-400">Créez des propositions commerciales avec TVA et frais de livraison figés.</p></div><Button onClick={() => setLocation("/devis/nouveau")} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Créer un devis</Button></header>{isLoading ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card> : quotes.length ? <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{quotes.map(quote => <button key={quote.id} type="button" onClick={() => setSelectedId(quote.id)} className="group rounded-xl border border-white/[0.07] bg-[#111722] p-4 text-left transition hover:border-primary/45"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-white">{quote.invoiceNumber}</p><p className="mt-1 truncate text-xs text-slate-400">{quote.customerName || "Client"} · {formatDate(quote.createdAt, true)}</p></div><Badge className="border-0 bg-sky-500/10 text-sky-300">Devis</Badge></div><div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3"><span className="text-sm text-slate-400">Total TTC</span><span className="font-semibold text-cyan-300">{formatCurrency(quote.totalCents)}</span></div><Eye className="mt-3 h-4 w-4 text-slate-600 transition group-hover:text-primary" /></button>)}</section> : <Card className="border-dashed border-white/10 bg-[#111722]"><CardContent className="py-16 text-center"><FileText className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-4 text-sm text-slate-300">Aucun devis créé.</p><Button onClick={() => setLocation("/devis/nouveau")} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">Créer le premier devis</Button></CardContent></Card>}<Dialog open={Boolean(selectedId)} onOpenChange={open => !open && setSelectedId(null)}><DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Aperçu du devis</DialogTitle></DialogHeader>{detail?.sale.channel === "quote" ? <><div id="quote-print"><InvoiceDocument detail={detail} identity={identity} documentLabel="Devis" /></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { downloadFile(createInvoicePdf(detail, identity, "Devis")); toast.success("PDF du devis généré."); }}><Download className="mr-2 h-4 w-4" />Télécharger le PDF</Button><Button variant="outline" onClick={() => window.print()}>Imprimer</Button></div></> : <p className="py-12 text-center text-muted-foreground">Chargement…</p>}</DialogContent></Dialog></div>;
}
