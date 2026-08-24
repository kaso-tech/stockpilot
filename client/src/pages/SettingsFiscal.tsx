import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ReceiptText, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsFiscal() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: settings } = trpc.commerce.settings.get.useQuery(undefined, { enabled: isAdmin });
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPercent, setVatPercent] = useState("0");
  useEffect(() => {
    if (!settings) return;
    setVatEnabled(settings.vatEnabled ?? false);
    setVatPercent(((settings.vatRateBasisPoints ?? 0) / 100).toFixed(2));
  }, [settings]);
  const save = trpc.commerce.settings.save.useMutation({
    onSuccess: () => { utils.commerce.settings.get.invalidate(); toast.success("Paramètre TVA enregistré."); },
    onError: error => toast.error(error.message),
  });
  if (!isAdmin) return <Restricted title="Fiscalité" description="La configuration de la TVA est réservée aux administrateurs." />;
  const normalizedPercent = Math.max(0, Math.min(100, Number(vatPercent) || 0));
  const saveSettings = () => save.mutate({
    defaultSalesAgentId: settings?.defaultSalesAgentId ?? null,
    defaultCashierId: settings?.defaultCashierId ?? null,
    requireSalesAgent: settings?.requireSalesAgent ?? false,
    requireCashier: settings?.requireCashier ?? false,
    currency: settings?.currency ?? "XOF",
    vatEnabled,
    vatRateBasisPoints: Math.round(normalizedPercent * 100),
  });
  return <div className="mx-auto max-w-4xl space-y-6">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Organisation</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Fiscalité</h1><p className="mt-2 text-sm text-slate-400">Configurez la TVA appliquée aux nouveaux documents commerciaux. Le taux est figé dans chaque document à sa création.</p></header>
    <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="space-y-6 p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ReceiptText className="h-5 w-5" /></span><div><h2 className="font-semibold text-slate-100">TVA sur les documents</h2><p className="mt-1 text-sm text-slate-400">Le réglage s’applique aux factures et bons créés après son enregistrement. Les documents déjà créés conservent leur historique.</p></div></div><div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"><div><Label htmlFor="vat-enabled" className="text-sm font-semibold text-slate-100">Activer la TVA</Label><p className="mt-1 text-xs text-slate-400">Afficher et calculer une taxe séparée dans les totaux.</p></div><Switch id="vat-enabled" checked={vatEnabled} onCheckedChange={setVatEnabled} /></div><div className="max-w-sm space-y-2"><Label htmlFor="vat-rate" className="text-sm text-slate-200">Taux de TVA (%)</Label><div className="flex items-center gap-2"><Input id="vat-rate" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={vatPercent} onChange={event => setVatPercent(event.target.value)} disabled={!vatEnabled} aria-describedby="vat-rate-help" /><span className="text-sm text-slate-400">%</span></div><p id="vat-rate-help" className="text-xs text-slate-400">Valeur de 0 à 100 %, avec une précision au centième.</p></div><div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.05] p-4 text-sm text-slate-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>La TVA est calculée sur le montant net après remises, puis les frais de livraison sont ajoutés au total TTC.</p></div></CardContent></Card><Button onClick={saveSettings} disabled={save.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90"><Save className="mr-2 h-4 w-4" />{save.isPending ? "Enregistrement…" : "Enregistrer la fiscalité"}</Button>
  </div>;
}
