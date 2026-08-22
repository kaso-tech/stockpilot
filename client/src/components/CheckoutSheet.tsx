import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Banknote, CreditCard, Landmark, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Method = "cash" | "card" | "mobile_money" | "bank_transfer" | "credit";
type Agent = { id: number; name: string; type: "sales_agent" | "cashier"; active: boolean };
type PaymentSettings = { defaultSalesAgentId?: number | null; defaultCashierId?: number | null; paymentCashEnabled?: boolean; paymentCardEnabled?: boolean; paymentMobileMoneyEnabled?: boolean; paymentBankTransferEnabled?: boolean; paymentCreditEnabled?: boolean };
const paymentMethods: Array<{ id: Method; label: string; icon: typeof Banknote; setting: keyof PaymentSettings }> = [
  { id: "cash", label: "Espèces", icon: Banknote, setting: "paymentCashEnabled" },
  { id: "mobile_money", label: "Mobile money", icon: Smartphone, setting: "paymentMobileMoneyEnabled" },
  { id: "card", label: "Carte", icon: CreditCard, setting: "paymentCardEnabled" },
  { id: "bank_transfer", label: "Virement", icon: Landmark, setting: "paymentBankTransferEnabled" },
  { id: "credit", label: "Crédit", icon: Landmark, setting: "paymentCreditEnabled" },
];
const emptyAmounts: Record<Method, string> = { cash: "", card: "", mobile_money: "", bank_transfer: "", credit: "" };
const toCents = (value: string) => Math.max(0, Math.round(Number(value.replace(",", ".") || 0) * 100));
const fromCents = (value: number) => value ? String(value / 100) : "";

export function CheckoutSheet({ open, onOpenChange, sale, agents, settings, onComplete }: { open: boolean; onOpenChange: (open: boolean) => void; sale: { id: number; totalCents: number; amountPaidCents?: number; invoiceNumber?: string; channel?: "pos" | "invoice" } | null; agents: Agent[]; settings?: PaymentSettings; onComplete: () => void }) {
  const utils = trpc.useUtils();
  const isPos = sale?.channel === "pos" || sale?.invoiceNumber?.startsWith("POS-") === true;
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [checked, setChecked] = useState<Method[]>([]);
  const [amounts, setAmounts] = useState<Record<Method, string>>(emptyAmounts);
  const [salesAgentId, setSalesAgentId] = useState("none");
  const [cashierId, setCashierId] = useState("none");
  const total = sale?.totalCents ?? 0;
  const previouslyPaid = sale?.amountPaidCents ?? 0;
  const remaining = Math.max(0, total - previouslyPaid);
  const enabledMethods = paymentMethods.filter(method => settings?.[method.setting] !== false);

  useEffect(() => {
    if (!open || !sale) return;
    setMode("full"); setChecked([]); setAmounts(emptyAmounts);
    setSalesAgentId(settings?.defaultSalesAgentId ? String(settings.defaultSalesAgentId) : "none");
    setCashierId(settings?.defaultCashierId ? String(settings.defaultCashierId) : "none");
  }, [open, sale?.id, settings?.defaultSalesAgentId, settings?.defaultCashierId]);

  const paidCents = useMemo(() => checked.reduce((sum, method) => sum + toCents(amounts[method]), 0), [amounts, checked]);
  const distributeIntegral = (selection: Method[], current: Record<Method, string>) => {
    let balance = remaining;
    const next = { ...emptyAmounts, ...current };
    selection.forEach(method => { const requested = toCents(next[method]); const amount = requested > 0 ? Math.min(requested, balance) : balance; next[method] = fromCents(amount); balance -= amount; });
    return next;
  };
  const toggle = (method: Method) => setChecked(current => {
    const next = current.includes(method) ? current.filter(value => value !== method) : [...current, method];
    setAmounts(amounts => mode === "full" ? distributeIntegral(next, amounts) : { ...amounts, ...(next.includes(method) ? {} : { [method]: "" }) });
    return next;
  });
  const updateAmount = (method: Method, value: string) => setAmounts(current => {
    const next = { ...current, [method]: value };
    if (mode !== "full") return next;
    const changedAt = checked.indexOf(method); let balance = remaining;
    checked.forEach((item, index) => {
      if (index <= changedAt) { const amount = Math.min(toCents(next[item]), balance); next[item] = fromCents(amount); balance -= amount; }
      else { next[item] = index === changedAt + 1 ? fromCents(balance) : ""; balance = 0; }
    });
    return next;
  });
  const changeMode = (next: "full" | "partial") => { if (isPos) return; setMode(next); if (next === "full") setAmounts(current => distributeIntegral(checked, current)); };
  const validFull = checked.length > 0 && paidCents === remaining;
  const validPartial = checked.length > 0 && paidCents > 0 && paidCents < remaining;
  const canSubmit = Boolean(sale) && (mode === "full" ? validFull : validPartial);
  const checkout = trpc.transactions.checkout.useMutation({ onSuccess: result => { toast.success(result.status === "paid" ? "Règlement intégral validé." : `Règlement partiel validé · solde ${formatCurrency(result.balanceCents)}`); utils.transactions.list.invalidate(); utils.products.list.invalidate(); utils.dashboard.get.invalidate(); onOpenChange(false); onComplete(); }, onError: error => toast.error(error.message) });
  const submit = () => { if (!sale || !canSubmit) return; checkout.mutate({ saleId: sale.id, settlementMode: isPos ? "full" : mode, payments: checked.map(method => ({ method, amountCents: toCents(amounts[method]) })).filter(payment => payment.amountCents > 0), salesAgentId: salesAgentId === "none" ? null : Number(salesAgentId), cashierId: cashierId === "none" ? null : Number(cashierId), note: null }); };
  const salesAgents = agents.filter(agent => agent.active && agent.type === "sales_agent"); const cashiers = agents.filter(agent => agent.active && agent.type === "cashier"); const difference = remaining - paidCents;

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="w-full overflow-y-auto border-white/10 bg-[#111722] p-0 text-slate-100 sm:max-w-xl"><SheetHeader className="border-b border-white/[0.08] px-6 py-6 text-left"><SheetTitle className="text-xl text-white">Encaissement</SheetTitle><p className="text-sm text-slate-400">{sale?.invoiceNumber || "Vente comptoir"}</p></SheetHeader><div className="space-y-6 p-6"><section className="rounded-2xl border border-[#00bcd4]/20 bg-[#00bcd4]/[0.07] p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a7f3ff]">Total à encaisser</p><p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(remaining)}</p>{previouslyPaid > 0 && <p className="mt-2 text-xs text-slate-400">Déjà encaissé : {formatCurrency(previouslyPaid)}</p>}</section>{!isPos && <div className="flex rounded-xl bg-white/[0.04] p-1"><Button type="button" onClick={() => changeMode("full")} variant="ghost" className={`flex-1 ${mode === "full" ? "bg-[#00bcd4] text-slate-950 hover:bg-[#66ddea]" : "text-slate-400"}`}>Intégral</Button><Button type="button" onClick={() => changeMode("partial")} variant="ghost" className={`flex-1 ${mode === "partial" ? "bg-[#00bcd4] text-slate-950 hover:bg-[#66ddea]" : "text-slate-400"}`}>Partiel</Button></div>}<section><Label className="text-sm font-semibold text-slate-200">Moyens de paiement</Label>{!enabledMethods.length ? <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] p-3 text-sm text-amber-200">Aucun moyen de paiement n’est activé dans les réglages POS.</p> : <div className="mt-3 space-y-2">{enabledMethods.map(({ id, label, icon: Icon }) => <div key={id} className={`rounded-xl border p-3 transition ${checked.includes(id) ? "border-[#00bcd4]/40 bg-[#00bcd4]/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}><div className="flex items-center gap-3"><Checkbox id={`payment-${id}`} checked={checked.includes(id)} onCheckedChange={() => toggle(id)} /><Label htmlFor={`payment-${id}`} className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-slate-200"><Icon className="h-4 w-4 text-[#66ddea]" />{label}</Label>{checked.includes(id) && <div className="relative w-28"><Input value={amounts[id]} onChange={event => updateAmount(id, event.target.value)} inputMode="decimal" className="h-9 border-white/10 bg-black/10 pr-9 text-right text-sm" /><span className="absolute right-2 top-2.5 text-[10px] text-slate-500">FCFA</span></div>}</div></div>)}</div>}<div className="mt-3 space-y-1 text-sm"><div className="flex justify-between"><span className="text-slate-400">Montant saisi</span><span className={difference === 0 ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>{formatCurrency(paidCents)}</span></div><div className="flex justify-between"><span className="text-slate-400">{mode === "full" ? "Écart à répartir" : "Solde restant"}</span><span className={difference === 0 ? "font-semibold text-emerald-300" : "font-semibold text-slate-100"}>{formatCurrency(Math.abs(difference))}</span></div>{mode === "full" && checked.length > 0 && difference !== 0 && <p className="pt-1 text-xs text-amber-300">La répartition doit être égale au total pour valider.</p>}</div></section><section className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Agent commercial</Label><Select value={salesAgentId} onValueChange={setSalesAgentId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucun</SelectItem>{salesAgents.map(agent => <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Caissier</Label><Select value={cashierId} onValueChange={setCashierId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucun</SelectItem>{cashiers.map(agent => <SelectItem key={agent.id} value={String(agent.id)}>{agent.name}</SelectItem>)}</SelectContent></Select></div></section><div className="flex gap-3 border-t border-white/[0.08] pt-5"><Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-white/10 text-slate-200"><X className="mr-2 h-4 w-4" />Annuler</Button><Button onClick={submit} disabled={checkout.isPending || !canSubmit} className="flex-1 bg-[#007B8B] text-white hover:bg-[#006976]">Valider l’encaissement</Button></div></div></SheetContent></Sheet>;
}
