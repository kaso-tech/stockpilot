import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Printer, ReceiptText, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

type PrinterType = "browser" | "thermal";

export default function SettingsPrinting() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: settings } = trpc.commerce.settings.get.useQuery(undefined, { enabled: isAdmin });
  const [ticketHeader, setTicketHeader] = useState("Merci de votre achat");
  const [ticketFooter, setTicketFooter] = useState("À bientôt");
  const [ticketWidthMm, setTicketWidthMm] = useState<"58" | "80">("80");
  const [printerName, setPrinterName] = useState("Imprimante système");
  const [printerType, setPrinterType] = useState<PrinterType>("browser");

  useEffect(() => {
    if (!settings) return;
    setTicketHeader(settings.ticketHeader || "Merci de votre achat");
    setTicketFooter(settings.ticketFooter || "À bientôt");
    setTicketWidthMm(settings.ticketWidthMm || "80");
    setPrinterName(settings.printerName || "Imprimante système");
    setPrinterType(settings.printerType || "browser");
  }, [settings]);

  const save = trpc.commerce.settings.save.useMutation({
    onSuccess: () => {
      utils.commerce.settings.get.invalidate();
      toast.success("Paramètres d’impression enregistrés.");
    },
    onError: error => toast.error(error.message),
  });

  if (!isAdmin) return <Restricted title="Impression et imprimante" description="Ces réglages sont réservés aux administrateurs." />;

  const saveSettings = () => save.mutate({
    defaultSalesAgentId: settings?.defaultSalesAgentId ?? null,
    defaultCashierId: settings?.defaultCashierId ?? null,
    requireSalesAgent: settings?.requireSalesAgent ?? false,
    requireCashier: settings?.requireCashier ?? false,
    currency: settings?.currency ?? "XOF",
    ticketHeader,
    ticketFooter,
    ticketWidthMm,
    printerName,
    printerType,
  });

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Périphériques</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Impression et imprimante</h1></header>
    <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="space-y-5 p-6">
      <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-primary" /><div><h2 className="font-semibold text-slate-100">Tickets de caisse</h2><p className="mt-1 text-sm text-slate-400">Configurez le format et les textes imprimés sur les tickets.</p></div></div>
      <Field label="Largeur du ticket"><Select value={ticketWidthMm} onValueChange={value => setTicketWidthMm(value as "58" | "80")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="58">58 mm</SelectItem><SelectItem value="80">80 mm</SelectItem></SelectContent></Select></Field>
      <Field label="En-tête du ticket"><Input value={ticketHeader} onChange={event => setTicketHeader(event.target.value)} maxLength={160} /></Field>
      <Field label="Pied du ticket"><Input value={ticketFooter} onChange={event => setTicketFooter(event.target.value)} maxLength={240} /></Field>
    </CardContent></Card>
    <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="space-y-5 p-6">
      <div className="flex items-center gap-3"><Printer className="h-5 w-5 text-primary" /><div><h2 className="font-semibold text-slate-100">Imprimante par défaut</h2><p className="mt-1 text-sm text-slate-400">Choisissez le comportement d’impression utilisé par votre entreprise.</p></div></div>
      <Field label="Nom de l’imprimante"><Input value={printerName} onChange={event => setPrinterName(event.target.value)} maxLength={120} placeholder="Imprimante caisse principale" /></Field>
      <Field label="Type d’impression"><Select value={printerType} onValueChange={value => setPrinterType(value as PrinterType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="browser">Impression via le navigateur</SelectItem><SelectItem value="thermal">Imprimante thermique</SelectItem></SelectContent></Select></Field>
      <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4 text-sm text-slate-400">Le mode navigateur ouvre la boîte d’impression standard. Le mode thermique conserve la préférence pour une intégration caisse compatible, sans stocker d’adresse réseau ni de secret.</div>
    </CardContent></Card>
    <div className="flex justify-end"><Button onClick={saveSettings} disabled={save.isPending || !printerName.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90"><Save className="mr-2 h-4 w-4" />{save.isPending ? "Enregistrement…" : "Enregistrer les paramètres"}</Button></div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-sm text-slate-200">{label}</Label>{children}</div>;
}
