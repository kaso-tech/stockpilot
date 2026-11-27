import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { salesAgentMode as readSalesAgentMode, type SalesAgentMode } from "@/lib/assignmentRules";
import { ChevronLeft, ReceiptText, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";
import { SellerDiscountPermissionsCard } from "@/components/SellerDiscountPermissionsCard";

type AssignmentMode = SalesAgentMode;
export type SettingsPosSectionKind = "all" | "assignment" | "ticket" | "payments" | "seller";

export default function SettingsPosSection({ section = "all" }: { section?: SettingsPosSectionKind }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: settings } = trpc.commerce.settings.get.useQuery(undefined, { enabled: isAdmin });
  const { data: agents = [] } = trpc.commerce.agents.list.useQuery(undefined, { enabled: isAdmin });
  const [salesAgentId, setSalesAgentId] = useState("none");
  const [cashierId, setCashierId] = useState("none");
  const [salesAgentMode, setSalesAgentMode] = useState<AssignmentMode>("none");
  const [sharedRegister, setSharedRegister] = useState(false);
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
  const [customerSuggestionsEnabled, setCustomerSuggestionsEnabled] = useState(true);
  const [customerSuggestionsLimit, setCustomerSuggestionsLimit] = useState(4);

  useEffect(() => {
    if (!settings) return;
    setSalesAgentId(settings.defaultSalesAgentId ? String(settings.defaultSalesAgentId) : "none");
    setCashierId(settings.defaultCashierId ? String(settings.defaultCashierId) : "none");
    setSalesAgentMode(readSalesAgentMode(settings));
    setSharedRegister(Boolean(settings.requireCashier));
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
    setCustomerSuggestionsEnabled(settings.customerSuggestionsEnabled ?? true);
    setCustomerSuggestionsLimit(settings.customerSuggestionsLimit ?? 4);
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
    defaultCashierId: cashierId !== "none" ? Number(cashierId) : null,
    requireSalesAgent: salesAgentMode === "prompt",
    requireCashier: sharedRegister,
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
    customerSuggestionsEnabled,
    customerSuggestionsLimit,
  });

  const titles: Record<SettingsPosSectionKind, string> = { all: "POS et impression ticket", assignment: "Rattachement des ventes", ticket: "Tickets de caisse", payments: "Moyens de paiement", seller: "Actions sensibles des vendeurs" };
  const descriptions: Record<SettingsPosSectionKind, string> = { all: "Configurez les règles de vente rapide et les protections du comptoir.", assignment: "Définissez les comptes automatiquement associés aux ventes.", ticket: "Personnalisez le format et les textes imprimés sur les tickets.", payments: "Activez les moyens de paiement disponibles au comptoir.", seller: "Contrôlez les actions sensibles accessibles aux vendeurs." };
  const show = (value: Exclude<SettingsPosSectionKind, "all">) => section === "all" || section === value;

  return <div className="mx-auto max-w-4xl space-y-6">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><h1 className="text-[22px] font-bold tracking-tight text-foreground">{titles[section]}</h1><p className="mt-0.5 text-[13px] text-muted-foreground">{descriptions[section]}</p></header>
    {show("assignment") && <Card className="border-border bg-card gap-0 py-0"><CardContent className="space-y-6 p-6"><div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-primary" /><div><h2 className="font-semibold text-foreground">Rattachement des ventes</h2><p className="mt-1 text-sm text-muted-foreground">Le vendeur connecté est toujours rattaché automatiquement à sa vente et à sa rémunération.</p></div></div><div className="grid gap-6 lg:grid-cols-2"><AssignmentCard mode={salesAgentMode} onModeChange={setSalesAgentMode} value={salesAgentId} onValueChange={setSalesAgentId} agents={salesAgents} /><CashierCard shared={sharedRegister} onSharedChange={setSharedRegister} value={cashierId} onValueChange={setCashierId} agents={cashiers} /></div></CardContent></Card>}
    {show("assignment") && <Card className="border-border bg-card gap-0 py-0"><CardContent className="space-y-5 p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold text-foreground">Produits habituellement achetés</h2><p className="mt-1 text-sm text-muted-foreground">Proposez les derniers produits du client lors de la création de facture ou de devis.</p></div><Switch checked={customerSuggestionsEnabled} onCheckedChange={setCustomerSuggestionsEnabled} /></div>{customerSuggestionsEnabled && <Field label="Nombre de produits affichés"><Input type="number" min={1} max={12} value={customerSuggestionsLimit} onChange={event => setCustomerSuggestionsLimit(Math.max(1, Math.min(12, Number(event.target.value) || 4)))} /></Field>}</CardContent></Card>}
    {(show("ticket") || show("payments")) && <div className="grid gap-6 lg:grid-cols-2">
      {show("ticket") && <Card className="border-border bg-card gap-0 py-0"><CardContent className="space-y-5 p-6"><div className="flex items-center gap-3"><ReceiptText className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Tickets de caisse</h2></div><Field label="Largeur"><Select value={ticketWidthMm} onValueChange={value => setTicketWidthMm(value as "58" | "80")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="58">58 mm</SelectItem><SelectItem value="80">80 mm</SelectItem></SelectContent></Select></Field><Field label="En-tête du ticket"><Input value={ticketHeader} onChange={event => setTicketHeader(event.target.value)} maxLength={160} /></Field><Field label="Pied du ticket"><Input value={ticketFooter} onChange={event => setTicketFooter(event.target.value)} maxLength={240} /></Field></CardContent></Card>}
      {show("payments") && <Card className="border-border bg-card gap-0 py-0"><CardContent className="space-y-5 p-6"><div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Moyens de paiement</h2></div><Toggle label="Espèces" checked={paymentCashEnabled} onChange={setPaymentCashEnabled} /><Toggle label="Mobile money" checked={paymentMobileMoneyEnabled} onChange={setPaymentMobileMoneyEnabled} /><Toggle label="Carte" checked={paymentCardEnabled} onChange={setPaymentCardEnabled} /><Toggle label="Virement" checked={paymentBankTransferEnabled} onChange={setPaymentBankTransferEnabled} /><Toggle label="Crédit" checked={paymentCreditEnabled} onChange={setPaymentCreditEnabled} /></CardContent></Card>}
    </div>}
    {show("seller") && <Card className="border-primary/20 bg-primary/[0.04] gap-0 py-0"><CardContent className="space-y-5 p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><div><h2 className="font-semibold text-foreground">Actions sensibles des vendeurs</h2><p className="mt-1 text-sm text-muted-foreground">Chaque autorisation est contrôlée côté serveur et enregistrée dans le journal d’activité.</p></div></div><div className="grid gap-1 sm:grid-cols-2"><Toggle label="Autoriser un prix différent du tarif" checked={sellerCanOverridePrice} onChange={setSellerCanOverridePrice} /><Toggle label="Autoriser un prix inférieur au tarif" checked={sellerCanSellBelowPrice} onChange={setSellerCanSellBelowPrice} /><Toggle label="Autoriser l’annulation d’une facture non encaissée" checked={sellerCanCancelInvoice} onChange={setSellerCanCancelInvoice} /><Toggle label="Autoriser le remboursement d’une facture encaissée" checked={sellerCanRefund} onChange={setSellerCanRefund} /><Toggle label="Autoriser la correction de stock" checked={sellerCanCorrectStock} onChange={setSellerCanCorrectStock} /><Toggle label="Autoriser la modification du coût d’achat" checked={sellerCanEditPurchasePrice} onChange={setSellerCanEditPurchasePrice} /></div><div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">La correction vendeur est limitée à un ajustement sans fournisseur. Le remboursement réintègre le stock, annule les commissions liées et laisse une trace dans le journal.</div></CardContent></Card>}
    {show("seller") && <SellerDiscountPermissionsCard />}
    <Button onClick={saveSettings} disabled={save.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{save.isPending ? "Enregistrement…" : `Enregistrer ${section === "all" ? "les réglages POS" : "cette section"}`}</Button>
  </div>;
}

const agentModes: Array<{ id: AssignmentMode; label: string; hint: string }> = [
  { id: "none", label: "Pas d’agent commercial", hint: "Le champ n’apparaît pas à l’encaissement ni sur les factures. L’agent déjà rattaché à un devis ou un ticket est conservé." },
  { id: "default", label: "Agent par défaut", hint: "L’agent choisi est prérempli sur chaque vente ; le vendeur peut le changer ou choisir « Aucun »." },
  { id: "prompt", label: "Choisir à chaque vente", hint: "Le vendeur doit indiquer l’agent (ou « Aucun ») avant de valider chaque encaissement ou facture." },
];

function AssignmentCard({ mode, onModeChange, value, onValueChange, agents }: { mode: AssignmentMode; onModeChange: (mode: AssignmentMode) => void; value: string; onValueChange: (value: string) => void; agents: Array<{ id: number; name: string }> }) {
  const current = agentModes.find(item => item.id === mode)!;
  return <section className="space-y-4 rounded-xl border border-border bg-muted/30 p-5"><div><h3 className="font-semibold text-foreground">Agent commercial</h3><p className="mt-1 text-sm text-muted-foreground">Commissionné sur les ventes qu’il apporte.</p></div>
    <div className="grid grid-cols-1 gap-2">{agentModes.map(item => <Button key={item.id} type="button" variant="outline" onClick={() => onModeChange(item.id)} className={mode === item.id ? "justify-start border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "justify-start border-border text-foreground"}>{item.label}</Button>)}</div>
    <p className="text-sm text-muted-foreground">{current.hint}</p>
    {mode === "default" && <div className="space-y-2"><Label className="text-sm text-muted-foreground">Agent prérempli</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger aria-label="Agent par défaut"><SelectValue placeholder="Choisir un agent commercial" /></SelectTrigger><SelectContent><SelectItem value="none">Aucun</SelectItem>{agents.map(agent => <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>)}</SelectContent></Select></div>}
    {!agents.length && mode !== "none" && <p className="text-xs text-warning">Aucun agent commercial actif : le champ restera masqué tant que vous n’en aurez pas créé.</p>}
  </section>;
}

function CashierCard({ shared, onSharedChange, value, onValueChange, agents }: { shared: boolean; onSharedChange: (value: boolean) => void; value: string; onValueChange: (value: string) => void; agents: Array<{ id: number; name: string }> }) {
  return <section className="space-y-4 rounded-xl border border-border bg-muted/30 p-5"><div><h3 className="font-semibold text-foreground">Caissier</h3><p className="mt-1 text-sm text-muted-foreground">Un caissier qui se connecte avec son compte est enregistré automatiquement sur ses encaissements. Les autres encaissements sont tracés au compte de la personne connectée.</p></div>
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3"><div><Label className="text-sm text-foreground">Caisse partagée</Label><p className="mt-1 text-xs text-muted-foreground">Demander le caissier à chaque encaissement, pour un poste utilisé par plusieurs caissiers sans compte personnel.</p></div><Switch aria-label="Caisse partagée" checked={shared} onCheckedChange={onSharedChange} /></div>
    {shared && !agents.length && <p className="text-xs text-warning">Aucun caissier actif : créez les fiches caissiers dans Équipe pour pouvoir les choisir.</p>}
    {!shared && agents.length > 0 && <div className="space-y-2"><Label className="text-sm text-muted-foreground">Caissier rémunéré par défaut (facultatif)</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger aria-label="Caissier par défaut"><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent><SelectItem value="none">Aucun</SelectItem>{agents.map(agent => <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Utile seulement si un caissier sans compte doit être commissionné sur les encaissements faits par d’autres.</p></div>}
  </section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-sm text-foreground">{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-4 border-t border-border py-3"><Label className="text-sm text-foreground">{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>; }
