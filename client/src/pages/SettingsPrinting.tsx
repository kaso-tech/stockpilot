import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, FileText, Printer, ReceiptText, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

type PrinterType = "browser" | "thermal";
type InvoiceTemplate = "classic" | "modern" | "minimal";

export default function SettingsPrinting() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: settings } = trpc.printingSettings.get.useQuery(undefined, { enabled: isAdmin });
  const [ticketHeader, setTicketHeader] = useState("Merci de votre achat");
  const [ticketFooter, setTicketFooter] = useState("À bientôt");
  const [ticketWidthMm, setTicketWidthMm] = useState<"58" | "80">("80");
  const [printerName, setPrinterName] = useState("Imprimante système");
  const [printerType, setPrinterType] = useState<PrinterType>("browser");
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplate>("classic");
  const [invoiceShowLogo, setInvoiceShowLogo] = useState(true);
  const [invoiceShowSignature, setInvoiceShowSignature] = useState(true);
  const [invoiceShowPaymentDetails, setInvoiceShowPaymentDetails] = useState(true);
  const [invoiceShowDelivery, setInvoiceShowDelivery] = useState(true);

  useEffect(() => {
    if (!settings) return;
    setTicketHeader(settings.ticketHeader);
    setTicketFooter(settings.ticketFooter);
    setTicketWidthMm(settings.ticketWidthMm);
    setPrinterName(settings.printerName);
    setPrinterType(settings.printerType);
    setInvoiceTemplate(settings.invoiceTemplate);
    setInvoiceShowLogo(settings.invoiceShowLogo);
    setInvoiceShowSignature(settings.invoiceShowSignature);
    setInvoiceShowPaymentDetails(settings.invoiceShowPaymentDetails);
    setInvoiceShowDelivery(settings.invoiceShowDelivery);
  }, [settings]);

  const save = trpc.printingSettings.save.useMutation({
    onSuccess: () => {
      utils.printingSettings.get.invalidate();
      utils.commerce.settings.get.invalidate();
      toast.success("Paramètres d’impression enregistrés.");
    },
    onError: error => toast.error(error.message),
  });

  if (!isAdmin) return <Restricted title="Impression et imprimante" description="Ces réglages sont réservés aux administrateurs." />;

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Périphériques</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Impression et imprimante</h1></header>
    <Card><CardContent className="space-y-5 p-6">
      <div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-primary" /><h2 className="font-semibold text-card-foreground">Tickets de caisse</h2></div>
      <Field label="Largeur du ticket"><Select value={ticketWidthMm} onValueChange={value => setTicketWidthMm(value as "58" | "80")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="58">58 mm</SelectItem><SelectItem value="80">80 mm</SelectItem></SelectContent></Select></Field>
      <Field label="En-tête du ticket"><Input value={ticketHeader} onChange={event => setTicketHeader(event.target.value)} maxLength={160} /></Field>
      <Field label="Pied du ticket"><Input value={ticketFooter} onChange={event => setTicketFooter(event.target.value)} maxLength={240} /></Field>
    </CardContent></Card>
    <Card><CardContent className="space-y-5 p-6">
      <div className="flex items-center gap-3"><Printer className="h-5 w-5 text-primary" /><h2 className="font-semibold text-card-foreground">Imprimante par défaut</h2></div>
      <Field label="Nom de l’imprimante"><Input value={printerName} onChange={event => setPrinterName(event.target.value)} maxLength={120} placeholder="Imprimante caisse principale" /></Field>
      <Field label="Type d’impression"><Select value={printerType} onValueChange={value => setPrinterType(value as PrinterType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="browser">Impression via le navigateur</SelectItem><SelectItem value="thermal">Imprimante thermique</SelectItem></SelectContent></Select></Field>
    </CardContent></Card>
    <Card><CardContent className="space-y-5 p-6"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-primary" /><h2 className="font-semibold text-card-foreground">Modèle de facture A4</h2></div><Field label="Style du modèle"><Select value={invoiceTemplate} onValueChange={value => setInvoiceTemplate(value as InvoiceTemplate)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="classic">Classique</SelectItem><SelectItem value="modern">Moderne</SelectItem><SelectItem value="minimal">Minimaliste</SelectItem></SelectContent></Select></Field><div className="grid gap-3 sm:grid-cols-2"><ToggleField label="Afficher le logo" checked={invoiceShowLogo} onCheckedChange={setInvoiceShowLogo} /><ToggleField label="Afficher la signature ou le cachet" checked={invoiceShowSignature} onCheckedChange={setInvoiceShowSignature} /><ToggleField label="Afficher le détail des règlements" checked={invoiceShowPaymentDetails} onCheckedChange={setInvoiceShowPaymentDetails} /><ToggleField label="Afficher l’adresse de livraison" checked={invoiceShowDelivery} onCheckedChange={setInvoiceShowDelivery} /></div><div className={`rounded-xl border p-4 ${invoiceTemplate === "modern" ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-muted/20"}`}><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Aperçu</p><div className="mt-3 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Votre entreprise</p><p className="text-xs text-muted-foreground">Facture #FAC-0001</p></div>{invoiceShowLogo && <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">LOGO</span>}</div><div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">Produit <span className="float-right">Total</span></div><div className="mt-2 text-xs font-semibold">Total TTC <span className="float-right">0 FCFA</span></div>{invoiceShowSignature && <div className="mt-4 border-t border-border pt-3 text-right text-[11px] text-muted-foreground">Signature & cachet</div>}</div></CardContent></Card>
    <div className="flex justify-end"><Button onClick={() => save.mutate({ ticketHeader, ticketFooter, ticketWidthMm, printerName, printerType, invoiceTemplate, invoiceShowLogo, invoiceShowSignature, invoiceShowPaymentDetails, invoiceShowDelivery })} disabled={save.isPending || !printerName.trim() || ticketHeader.trim().length < 2 || ticketFooter.trim().length < 2}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Enregistrement…" : "Enregistrer les paramètres"}</Button></div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-sm">{label}</Label>{children}</div>;
}

function ToggleField({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><Label className="text-sm font-medium">{label}</Label><input type="checkbox" checked={checked} onChange={event => onCheckedChange(event.target.checked)} className="h-4 w-4 accent-primary" /></div>;
}
