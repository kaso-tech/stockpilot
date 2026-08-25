import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Plus, ReceiptText, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsFiscal() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const { data: settings } = trpc.commerce.settings.get.useQuery(undefined, { enabled: isAdmin });
  const { data: presets = [] } = trpc.vatRates.list.useQuery(undefined, { enabled: isAdmin });
  const [vatEnabled, setVatEnabled] = useState(false);
  const [sellerCanToggleVat, setSellerCanToggleVat] = useState(false);
  const [defaultRateId, setDefaultRateId] = useState("");
  const [presetLabel, setPresetLabel] = useState("");
  const [presetPercent, setPresetPercent] = useState("");
  const currentPreset = useMemo(() => presets.find(rate => rate.rateBasisPoints === settings?.vatRateBasisPoints), [presets, settings?.vatRateBasisPoints]);

  useEffect(() => {
    if (!settings) return;
    setVatEnabled(settings.vatEnabled ?? false);
    setSellerCanToggleVat(Boolean(settings.vatEnabled && settings.sellerCanToggleVat));
  }, [settings]);

  useEffect(() => setDefaultRateId(currentPreset ? String(currentPreset.id) : ""), [currentPreset]);
  useEffect(() => { if (!vatEnabled) setSellerCanToggleVat(false); }, [vatEnabled]);

  const permission = trpc.vatRates.setSellerVatPermission.useMutation({
    onSuccess: () => utils.commerce.settings.get.invalidate(),
    onError: error => toast.error(error.message),
  });
  const save = trpc.commerce.settings.save.useMutation({
    onSuccess: () => { utils.commerce.settings.get.invalidate(); toast.success("Paramètre TVA enregistré."); },
    onError: error => toast.error(error.message),
  });
  const setDefault = trpc.vatRates.setDefault.useMutation({
    onSuccess: () => { utils.commerce.settings.get.invalidate(); toast.success("Taux TVA par défaut enregistré."); },
    onError: error => toast.error(error.message),
  });
  const createPreset = trpc.vatRates.create.useMutation({
    onSuccess: async () => {
      await utils.vatRates.list.invalidate();
      await utils.vatRates.list.refetch();
      setPresetLabel("");
      setPresetPercent("");
      toast.success("Taux TVA ajouté et disponible dans les documents.");
    },
    onError: error => toast.error(`Impossible d’ajouter le taux TVA : ${error.message}`),
  });
  const removePreset = trpc.vatRates.remove.useMutation({
    onSuccess: () => { utils.vatRates.list.invalidate(); utils.commerce.settings.get.invalidate(); toast.success("Taux TVA retiré."); },
    onError: error => toast.error(error.message),
  });

  if (!isAdmin) return <Restricted title="Fiscalité" description="La configuration de la TVA est réservée aux administrateurs." />;

  const saveSettings = () => {
    save.mutate({
      defaultSalesAgentId: settings?.defaultSalesAgentId ?? null,
      defaultCashierId: settings?.defaultCashierId ?? null,
      requireSalesAgent: settings?.requireSalesAgent ?? false,
      requireCashier: settings?.requireCashier ?? false,
      currency: settings?.currency ?? "XOF",
      vatEnabled,
      vatRateBasisPoints: settings?.vatRateBasisPoints ?? 0,
    }, { onSuccess: () => permission.mutate({ enabled: vatEnabled && sellerCanToggleVat }) });
  };

  const addPreset = () => {
    const normalizedPercent = presetPercent.trim().replace(",", ".");
    const rateBasisPoints = Math.round(Number(normalizedPercent) * 100);
    if (!presetLabel.trim() || !Number.isFinite(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 10_000) {
      toast.error("Indiquez un libellé et un taux compris entre 0 et 100 %.");
      return;
    }
    createPreset.mutate({ label: presetLabel.trim(), rateBasisPoints });
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Organisation</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Fiscalité</h1></header>
    <Card><CardContent className="space-y-6 p-6">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ReceiptText className="h-5 w-5" /></span><div><h2 className="font-semibold text-card-foreground">TVA</h2></div></div>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4"><div><Label htmlFor="vat-enabled" className="text-sm font-semibold">Activer la TVA</Label><p className="mt-1 text-xs text-muted-foreground">Appliquer la TVA par défaut aux nouveaux documents.</p></div><Switch id="vat-enabled" checked={vatEnabled} onCheckedChange={setVatEnabled} /></div>
      <div className="max-w-md space-y-2"><Label htmlFor="vat-default-rate" className="text-sm">Taux de TVA par défaut</Label><select id="vat-default-rate" value={defaultRateId} disabled={!vatEnabled || !presets.length || setDefault.isPending} onChange={event => { setDefaultRateId(event.target.value); if (event.target.value) setDefault.mutate({ id: Number(event.target.value) }); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"><option value="">{presets.length ? "Sélectionner un taux" : "Ajoutez un taux prédéfini"}</option>{presets.map(rate => <option key={rate.id} value={rate.id}>{rate.label} — {(rate.rateBasisPoints / 100).toFixed(2)} %</option>)}</select>{!currentPreset && settings?.vatRateBasisPoints ? <p className="text-xs text-amber-600 dark:text-amber-400">Le taux actuel n’est pas dans la liste des taux prédéfinis. Sélectionnez-en un ci-dessus.</p> : null}</div>
      <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition ${vatEnabled ? "border-primary/20 bg-primary/[0.04]" : "border-border bg-muted/20 opacity-60"}`}><div><Label htmlFor="seller-vat-toggle" className="text-sm font-semibold">Autoriser le vendeur à activer ou désactiver la TVA</Label><p className="mt-1 text-xs text-muted-foreground">Disponible uniquement lorsque la TVA globale est active.</p></div><Switch id="seller-vat-toggle" checked={sellerCanToggleVat} onCheckedChange={setSellerCanToggleVat} disabled={!vatEnabled} /></div>
      <section className="space-y-4 rounded-xl border border-border p-4"><div><h3 className="font-semibold text-card-foreground">Taux TVA prédéfinis</h3><p className="mt-1 text-xs text-muted-foreground">Ils seront proposés lors de la création des factures et devis.</p></div><div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"><Input value={presetLabel} onChange={event => setPresetLabel(event.target.value)} placeholder="Ex. TVA standard" maxLength={80} /><Input value={presetPercent} onChange={event => setPresetPercent(event.target.value)} placeholder="18" type="number" min="0" max="100" step="0.01" inputMode="decimal" /><Button type="button" variant="outline" onClick={addPreset} disabled={createPreset.isPending || !presetLabel.trim() || !presetPercent.trim()}><Plus className="mr-2 h-4 w-4" />{createPreset.isPending ? "Ajout…" : "Ajouter"}</Button></div>{presets.length ? <div className="divide-y divide-border rounded-lg border border-border">{presets.map(rate => <div key={rate.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-sm font-medium">{rate.label}</span><span className="text-xs text-muted-foreground">{(rate.rateBasisPoints / 100).toFixed(2)} %</span></span><Button type="button" size="icon" variant="ghost" onClick={() => removePreset.mutate({ id: rate.id })} disabled={removePreset.isPending} aria-label={`Retirer ${rate.label}`}><Trash2 className="h-4 w-4 text-rose-500" /></Button></div>)}</div> : <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">Aucun taux prédéfini. Ajoutez au moins un taux pour le proposer dans les documents.</p>}</section>
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.05] p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>La TVA est calculée sur le montant net après remises. Le choix appliqué est figé à la création du document.</p></div>
    </CardContent></Card>
    <Button onClick={saveSettings} disabled={save.isPending || permission.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90"><Save className="mr-2 h-4 w-4" />{save.isPending || permission.isPending ? "Enregistrement…" : "Enregistrer la fiscalité"}</Button>
  </div>;
}
