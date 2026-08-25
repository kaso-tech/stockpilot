import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Eye, FileText, Plus } from "lucide-react";
import { useLocation } from "wouter";

export default function Quotes() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: transactions = [], isLoading } = trpc.transactions.list.useQuery();
  const quotes = transactions.filter(item => item.channel === "quote");
  if (user?.role !== "admin" && user?.role !== "seller") return <div className="mx-auto max-w-5xl py-16 text-center text-muted-foreground">Accès réservé aux utilisateurs autorisés.</div>;
  return <div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Documents commerciaux</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Devis</h1></div><Button onClick={() => setLocation("/devis/nouveau")} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" />Créer un devis</Button></header><section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{isLoading ? <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-12 text-center text-sm text-muted-foreground">Chargement…</CardContent></Card> : quotes.length ? quotes.map(quote => <button key={quote.id} type="button" onClick={() => setLocation(`/devis/${quote.id}`)} className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.07] bg-[#111722] px-3 py-2.5 text-left shadow-sm transition hover:border-primary/45 hover:bg-[#141e2d]"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-100">{quote.invoiceNumber}</p><Badge className="border-0 bg-sky-500/10 text-sky-300">Devis</Badge></div><p className="mt-1 truncate text-xs text-slate-400">{quote.customerName || "Client"} · {formatDate(quote.createdAt, true)}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-cyan-300">{formatCurrency(quote.totalCents)}</p><p className="mt-0.5 text-[11px] text-slate-500">{quote.status === "paid" ? "Accepté" : "En attente"}</p></div><Eye className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-primary" /></button>) : <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-16 text-center"><FileText className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-4 text-sm text-slate-300">Aucun devis créé.</p><Button onClick={() => setLocation("/devis/nouveau")} className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">Créer le premier devis</Button></CardContent></Card>}</section></div>;
}
