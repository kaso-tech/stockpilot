import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardPreferenceKeys, dashboardPreferenceLabels, dashboardPreferencesForRole, normalizeDashboardPreferences, type DashboardPreferences } from "@/lib/dashboardPreferences";
import { trpc } from "@/lib/trpc";
import { Check, ChevronLeft, LayoutDashboard, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function SettingsDashboard() {
  const { user } = useAuth();
  const role = user?.role === "seller" ? "seller" : "admin";
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.dashboardPreferences.get.useQuery();
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => dashboardPreferencesForRole(role));
  useEffect(() => { if (!isLoading) { try { setPreferences(data?.preferencesJson ? normalizeDashboardPreferences(JSON.parse(data.preferencesJson), role) : dashboardPreferencesForRole(role)); } catch { setPreferences(dashboardPreferencesForRole(role)); } } }, [data?.preferencesJson, isLoading, role]);
  const saveMutation = trpc.dashboardPreferences.save.useMutation({ onSuccess: () => { utils.dashboardPreferences.get.invalidate(); toast.success("Préférences du tableau de bord enregistrées."); }, onError: error => toast.error(error.message) });
  const toggle = (key: keyof DashboardPreferences) => setPreferences(current => ({ ...current, [key]: !current[key] }));
  const save = () => saveMutation.mutate({ preferencesJson: JSON.stringify(preferences) });
  const reset = () => { const preset = dashboardPreferencesForRole(role); setPreferences(preset); saveMutation.mutate({ preferencesJson: JSON.stringify(preset) }); };
  return <div className="mx-auto max-w-3xl space-y-6"><Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Préférences</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Tableau de bord</h1></header><Card className="border-border bg-card"><CardContent className="p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><LayoutDashboard className="h-5 w-5" /></span><div><h2 className="font-semibold">Éléments affichés</h2><p className="mt-1 text-sm text-muted-foreground">Ces préférences sont associées à votre compte {role === "seller" ? "vendeur" : "administrateur"}.</p></div></div><div className="mb-4 rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-sm text-muted-foreground">Vue prédéfinie active : <b className="text-foreground">{role === "seller" ? "Vendeur" : "Administrateur"}</b>. Vous pouvez personnaliser puis réinitialiser cette vue à tout moment.</div><div className="divide-y divide-border rounded-xl border border-border">{dashboardPreferenceKeys.map(key => <label key={key} className="flex cursor-pointer items-center gap-3 px-4 py-3.5 hover:bg-muted/40"><input type="checkbox" checked={preferences[key]} onChange={() => toggle(key)} className="h-4 w-4 accent-primary" /><span className="min-w-0 flex-1 text-sm font-medium">{dashboardPreferenceLabels[key]}</span>{preferences[key] && <Check className="h-4 w-4 text-primary" />}</label>)}</div><div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={reset} disabled={saveMutation.isPending}><RotateCcw className="mr-2 h-4 w-4" />Réinitialiser la vue</Button><Button onClick={save} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">Enregistrer les préférences</Button></div></CardContent></Card></div>;
}
