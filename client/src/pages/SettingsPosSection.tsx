import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ReceiptText, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

type AssignmentMode = "default" | "prompt";
export type SettingsPosSectionKind = "all" | "assignment" | "ticket" | "payments" | "seller";

export default function SettingsPosSection({ section = "all" }: { section?: SettingsPosSectionKind }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: settings } = trpc.commerce.settings.get.useQuery(undefined, { enabled: isAdmin });
  const { data: agents = [] } = trpc.commerce.agents.list.useQuery(undefined, { enabled: isAdmin });
  const [salesAgentId, setSalesAgentId] = useState("none");
  const [cashierId, setCashierId] = useState("none");
  const [salesAgentMode, setSalesAgentMode] = useState<AssignmentMode>("prompt");
  const [cashierMode, setCashierMode] = useState<AssignmentMode>("prompt");
  const [ticketHeader, setTicketHeader] = useState("Merci de votre achat");
  const [ticketFooter, setTicketFooter] = useState("À bientôt");
  const [ticketWidthMm, setTicketWidthMm] = useState<"58" | "80">("80");
  const [paymentCashEnabled, setPaymentCashEnabled] = useState(true);
  const [paymentMobileMoneyEnabled, setPaymentMobileMoneyEnabled] = useState(true);
  const [paymentCardEnabled, setPaymentCardEnabled] = useState(true);
  const [paymentBankTransferEnabled, setPaymentBankTransferEnabled] = useState(true);
  const [paymentCreditEnabled, setPaymentCreditEnabled] = useState(true);
  const [sellerCanOverridePrice, setSellerCanOverridePrice] = useState(false);
  const [sellerCanSellBelowPrice, setSellerCanSellBelowPrice] = useState(false);
  const [sellerMaxDiscountPercent, setSellerMaxDiscountPercent] = useState(0);
  const [sellerCanCancelInvoice, setSellerCanCancelInvoice] = useState(false);
  const [sellerCanRefund, setSellerCanRefund] = useState(false);
  const [sellerCanCorrectStock, setSellerCanCorrectStock] = useState(false);
  const [sellerCanEditPurchasePrice, setSellerCanEditPurchasePrice] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setSalesAgentId(settings.defaultSalesAgentId ? String(settings.defaultSalesAgentId) : "none");
    setCashierId(settings.defaultCashierId ? String(settings.defaultCashierId) : "none");
    setSalesAgentMode(settings.defaultSalesAgentId ? "default" : "prompt");
    setCashierMode(settings.defaultCashierId ? "default" : "prompt");
    setTicketHeader(settings.ticketHeader || "Merci de votre achat");
    setTicketFooter(settings.ticketFooter || "À bientôt");
    setTicketWidthMm(settings.ticketWidthMm || "80");
    setPaymentCashEnabled(settings.paymentCashEnabled ?? true);
    setPaymentMobileMoneyEnabled(settings.paymentMobileMoneyEnabled ?? true);
    setPaymentCardEnabled(settings.paymentCardEnabled ?? true);
    setPaymentBankTransferEnabled(settings.paymentBankTransferEnabled ?? true);
    setPaymentCreditEnabled(settings.paymentCreditEnabled ?? true);
    setSellerCanOverridePrice(settings.sellerCanOverridePrice ?? false);
    setSellerCanSellBelowPrice(settings.sellerCanSellBelowPrice ?? false);
    setSellerMaxDiscountPercent(settings.sellerMaxDiscountPercent ?? 0);
    setSellerCanCancelInvoice(settings.sellerCanCancelInvoice ?? false);
    setSellerCanRefund(settings.sellerCanRefund ?? false);
    setSellerCanCorrectStock(settings.sellerCanCorrectStock ?? false);
    setSellerCanEditPurchasePrice(settings.sellerCanEditPurchasePrice ?? false);
  }, [settings]);

  const save = trpc.commerce.settings.save.useMutation({
    onSuccess: () => { utils.commerce.settings.get.invalidate(); toast.success("Réglages enregistrés."); },
    onError: error => toast.error(error.message),
  });
  if (!isAdmin) return <Restricted title="Réglages du point de vente" description="Ces réglages sont réservés aux administrateurs." />;

  const salesAgents = agents.filter(agent => agent.type === "sales_agent" && agent.active);
  const cashiers = agents.filter(agent => agent.type === "cashier" && agent.active);
  const saveSettings = () => save.mutate({
    defaultSalesAgentId: salesAgentMode === "default" && salesAgentId !== "none" ? Number(salesAgentId) : null,
    defaultCashierId: cashierMode === "default" && cashierId !== "none" ? Number(cashierId) : null,
    requireSalesAgent: false,
    requireCashier: false,
    currency: settings?.currency ?? "XOF",
    ticketHeader,
    ticketFooter,
    ticketWidthMm,
    paymentCashEnabled,
    paymentMobileMoneyEnabled,
    paymentCardEnabled,
    paymentBankTransferEnabled,
    paymentCreditEnabled,
    sellerCanOverridePrice,
    sellerCanSellBelowPrice,
    sellerMaxDiscountPercent,
    sellerCanCancelInvoice,
    sellerCanRefund,
    sellerCanCorrectStock,
    sellerCanEditPurchasePrice,
  });

  const titles: Record<SettingsPosSectionKind, string> = { all: "POS et impression ticket", assignment: "Rattachement des ventes", ticket: "Tickets de caisse", payments: "Moyens de paiement", seller: "Actions sensibles des vendeurs" };
  const descriptions: Record<SettingsPosSectionKind, string> = { all: "Configurez les règles de vente rapide et les protections du comptoir.", assignment: "Définissez les comptes automatiquement associés aux ventes.", ticket: "Personnalisez le format et les textes imprimés sur les tickets.", payments: "Activez les moyens de paiement disponibles au comptoir.", seller: "Contrôlez les actions sensibles accessibles aux vendeurs." };
  const show = (value: Exclude<SettingsPosSectionKind, "all">) => section === "all" || section === value;

  return <div className="mx-auto max-w-4xl space-y-6">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Vente rapide</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{titles[section]}</h1><p className="mt-2 text-sm text-slate-400">{descriptions[section]}</p></header>
    {show("assignment") && <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="space-y-6 p-6"><div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-primary" /><div><h2 className="font-semibold text-slate-100">Rattachement des ventes</h2><p className="mt-1 text-sm text-slate-400">Le vendeur connecté est toujours rattaché automatiquement à sa vente et à sa rémunération.</p></div></div><div className="grid gap-6 lg:grid-cols-2"><AssignmentCard title="Caissier" description="Rémunéré sur les ventes qu’il encaisse." mode={cashierMode} onModeChange={setCashierMode} value={cashierId} onValueChange={setCashierId} agents={cashiers} agentNoun="caissier" /><AssignmentCard title="Agent commercial" description="Commissionné sur les ventes qu’il apporte." mode={salesAgentMode} onModeChange={setSalesAgentMode} value={salesAgentId} onValueChange={setSalesAgentId} agents={salesAgents} agentNoun="agent commercial" /></div></CardContent></Card>}
    {(show("ticket") || show("payments")) && <div className="grid gap-6 lg:grid-cols-2">
      {show("ticket") && <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="space-y-5 p-6"><div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-primary" /><h2 className="font-semibold text-slate-100">Tickets de caisse</h2></div><Field label="Largeur"><Select value={ticketWidthMm} onValueChange={value => setTicketWidthMm(value as "58" | "80")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="58">58 mm</SelectItem><SelectItem value="80">80 mm</SelectItem></SelectContent></Select></Field><Field label="En-tête du ticket"><Input value={ticketHeader} onChange={event => setTicketHeader(event.target.value)} maxLength={160} /></Field><Field label="Pied du ticket"><Input value={ticketFooter} onChange={event => setTicketFooter(event.target.value)} maxLength={240} /></Field></CardContent></Card>}
      {show("payments") && <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="space-y-5 p-6"><div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-primary" /><h2 className="font-semibold text-slate-100">Moyens de paiement</h2></div><Toggle label="Espèces" checked={paymentCashEnabled} onChange={setPaymentCashEnabled} /><Toggle label="Mobile money" checked={paymentMobileMoneyEnabled} onChange={setPaymentMobileMoneyEnabled} /><Toggle label="Carte" checked={paymentCardEnabled} onChange={setPaymentCardEnabled} /><Toggle label="Virement" checked={paymentBankTransferEnabled} onChange={setPaymentBankTransferEnabled} /><Toggle label="Crédit" checked={paymentCreditEnabled} onChange={setPaymentCreditEnabled} /></CardContent></Card>}
    </div>}
    {show("seller") && <Card className="border-primary/20 bg-primary/[0.04]"><CardContent className="space-y-5 p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><div><h2 className="font-semibold text-slate-100">Actions sensibles des vendeurs</h2><p className="mt-1 text-sm text-slate-400">Chaque autorisation est contrôlée côté serveur et enregistrée dans le journal d’activité.</p></div></div><div className="grid gap-1 sm:grid-cols-2"><Toggle label="Autoriser un prix différent du tarif" checked={sellerCanOverridePrice} onChange={setSellerCanOverridePrice} /><Toggle label="Autoriser un prix inférieur au tarif" checked={sellerCanSellBelowPrice} onChange={setSellerCanSellBelowPrice} /><Toggle label="Autoriser l’annulation d’une facture non encaissée" checked={sellerCanCancelInvoice} onChange={setSellerCanCancelInvoice} /><Toggle label="Autoriser le remboursement d’une facture encaissée" checked={sellerCanRefund} onChange={setSellerCanRefund} /><Toggle label="Autoriser la correction de stock" checked={sellerCanCorrectStock} onChange={setSellerCanCorrectStock} /><Toggle label="Autoriser la modification du coût d’achat" checked={sellerCanEditPurchasePrice} onChange={setSellerCanEditPurchasePrice} /></div><Field label="Remise maximale autorisée au vendeur (%)"><Input type="number" min={0} max={100} value={sellerMaxDiscountPercent} onChange={event => setSellerMaxDiscountPercent(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} /></Field><div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-slate-400">La correction vendeur est limitée à un ajustement sans fournisseur. Le remboursement réintègre le stock, annule les commissions liées et laisse une trace dans le journal.</div></CardContent></Card>}
    <Button onClick={saveSettings} disabled={save.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{save.isPending ? "Enregistrement…" : `Enregistrer ${section === "all" ? "les réglages POS" : "cette section"}`}</Button>
  </div>;
}

function AssignmentCard({ title, description, mode, onModeChange, value, onValueChange, agents, agentNoun }: { title: string; description: string; mode: AssignmentMode; onModeChange: (mode: AssignmentMode) => void; value: string; onValueChange: (value: string) => void; agents: Array<{ id: number; name: string }>; agentNoun: string }) { return <section className="space-y-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5"><div><h3 className="font-semibold text-slate-100">{title}</h3><p className="mt-1 text-sm text-slate-400">{description}</p></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button type="button" variant="outline" onClick={() => onModeChange("default")} className={mode === "default" ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-white/20 text-slate-200"}>Compte par défaut</Button><Button type="button" variant="outline" onClick={() => onModeChange("prompt")} className={mode === "prompt" ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-white/20 text-slate-200"}>Demander au comptoir</Button></div>{mode === "default" ? <div className="space-y-2"><Label className="text-sm text-slate-300">Compte appliqué à toutes les ventes</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue placeholder={`Choisir un ${agentNoun}`} /></SelectTrigger><SelectContent><SelectItem value="none">Aucun</SelectItem>{agents.map(agent => <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-slate-400">Le vendeur ne verra pas ce champ lors de la création de la facture.</p></div> : <p className="text-sm text-slate-400">Le vendeur choisira cet intervenant à chaque facture, avec le choix « Aucun » disponible.</p>}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-sm text-slate-200">{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] py-3"><Label className="text-sm text-slate-200">{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>; }
