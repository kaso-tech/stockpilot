import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

type AssignmentMode = "default" | "prompt";
export type SettingsPosSectionKind = "all" | "assignment" | "payments" | "seller";

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

  if (!isAdmin) return <Restricted title="Réglages de Vente rapide" description="Ces réglages sont réservés aux administrateurs." />;

  const salesAgents = agents.filter(agent => agent.type === "sales_agent" && agent.active);
  const cashiers = agents.filter(agent => agent.type === "cashier" && agent.active);
  const show = (value: Exclude<SettingsPosSectionKind, "all">) => section === "all" || section === value;
  const titles: Record<SettingsPosSectionKind, string> = { all: "Réglages de Vente rapide", assignment: "Rattachement des ventes", payments: "Moyens de paiement", seller: "Autorisations des vendeurs" };
  const saveSettings = () => save.mutate({
    defaultSalesAgentId: salesAgentMode === "default" && salesAgentId !== "none" ? Number(salesAgentId) : null,
    defaultCashierId: cashierMode === "default" && cashierId !== "none" ? Number(cashierId) : null,
    requireSalesAgent: false,
    requireCashier: false,
    currency: settings?.currency ?? "XOF",
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

  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Vente rapide</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">{titles[section]}</h1></header>
    {show("assignment") && <Card><CardContent className="space-y-5 p-5"><div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-primary" /><h2 className="font-semibold text-card-foreground">Rattachement des ventes</h2></div><div className="grid gap-4 lg:grid-cols-2"><AssignmentCard title="Caissier" mode={cashierMode} onModeChange={setCashierMode} value={cashierId} onValueChange={setCashierId} agents={cashiers} agentNoun="caissier" /><AssignmentCard title="Agent commercial" mode={salesAgentMode} onModeChange={setSalesAgentMode} value={salesAgentId} onValueChange={setSalesAgentId} agents={salesAgents} agentNoun="agent commercial" /></div></CardContent></Card>}
    {show("payments") && <Card><CardContent className="space-y-4 p-5"><div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-primary" /><h2 className="font-semibold text-card-foreground">Moyens de paiement</h2></div><Toggle label="Espèces" checked={paymentCashEnabled} onChange={setPaymentCashEnabled} /><Toggle label="Mobile money" checked={paymentMobileMoneyEnabled} onChange={setPaymentMobileMoneyEnabled} /><Toggle label="Carte" checked={paymentCardEnabled} onChange={setPaymentCardEnabled} /><Toggle label="Virement" checked={paymentBankTransferEnabled} onChange={setPaymentBankTransferEnabled} /><Toggle label="Crédit" checked={paymentCreditEnabled} onChange={setPaymentCreditEnabled} /></CardContent></Card>}
    {show("seller") && <Card className="border-primary/20 bg-primary/[0.04]"><CardContent className="space-y-4 p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold text-card-foreground">Autorisations des vendeurs</h2></div><div className="grid gap-1 sm:grid-cols-2"><Toggle label="Autoriser un prix différent du tarif" checked={sellerCanOverridePrice} onChange={setSellerCanOverridePrice} /><Toggle label="Autoriser un prix inférieur au tarif" checked={sellerCanSellBelowPrice} onChange={setSellerCanSellBelowPrice} /><Toggle label="Autoriser l’annulation d’une facture non encaissée" checked={sellerCanCancelInvoice} onChange={setSellerCanCancelInvoice} /><Toggle label="Autoriser le remboursement d’une facture encaissée" checked={sellerCanRefund} onChange={setSellerCanRefund} /><Toggle label="Autoriser la correction de stock" checked={sellerCanCorrectStock} onChange={setSellerCanCorrectStock} /><Toggle label="Autoriser la modification du coût d’achat" checked={sellerCanEditPurchasePrice} onChange={setSellerCanEditPurchasePrice} /></div><Field label="Remise maximale autorisée au vendeur (%)"><Input type="number" min={0} max={100} value={sellerMaxDiscountPercent} onChange={event => setSellerMaxDiscountPercent(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} /></Field></CardContent></Card>}
    <Button onClick={saveSettings} disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
  </div>;
}

function AssignmentCard({ title, mode, onModeChange, value, onValueChange, agents, agentNoun }: { title: string; mode: AssignmentMode; onModeChange: (mode: AssignmentMode) => void; value: string; onValueChange: (value: string) => void; agents: Array<{ id: number; name: string }>; agentNoun: string }) {
  return <section className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"><h3 className="font-semibold text-card-foreground">{title}</h3><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button type="button" variant="outline" onClick={() => onModeChange("default")} className={mode === "default" ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-border"}>Compte par défaut</Button><Button type="button" variant="outline" onClick={() => onModeChange("prompt")} className={mode === "prompt" ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-border"}>Choix à la vente</Button></div>{mode === "default" && <div className="space-y-2"><Label className="text-sm">Compte appliqué par défaut</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue placeholder={`Choisir un ${agentNoun}`} /></SelectTrigger><SelectContent><SelectItem value="none">Aucun</SelectItem>{agents.map(agent => <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>)}</SelectContent></Select></div>}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label className="text-sm">{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="flex items-center justify-between gap-4 border-t border-border py-2.5"><Label className="text-sm">{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>; }
