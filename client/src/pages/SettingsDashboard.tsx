import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardPreferenceKeys, dashboardPreferenceLabels, readDashboardPreferences, writeDashboardPreferences, type DashboardPreferences } from "@/lib/dashboardPreferences";
import { Check, ChevronLeft, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export default function SettingsDashboard() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => readDashboardPreferences());
  if (user?.role !== "admin") return <Restricted title="Préférences du tableau de bord" description="Ce réglage est réservé aux administrateurs." />;
  const toggle = (key: keyof DashboardPreferences) => setPreferences(current => ({ ...current, [key]: !current[key] }));
  const save = () => { writeDashboardPreferences(preferences); toast.success("Préférences du tableau de bord enregistrées."); };
  return <div className="mx-auto max-w-3xl space-y-6"><Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft className="h-4 w-4" />Retour aux paramètres</Link><header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Préférences</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Tableau de bord</h1></header><Card className="border-border bg-card"><CardContent className="p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><LayoutDashboard className="h-5 w-5" /></span><div><h2 className="font-semibold">Éléments affichés</h2><p className="mt-1 text-sm text-muted-foreground">Cochez les sections à conserver dans le cockpit commercial.</p></div></div><div className="divide-y divide-border rounded-xl border border-border">{dashboardPreferenceKeys.map(key => <label key={key} className="flex cursor-pointer items-center gap-3 px-4 py-3.5 hover:bg-muted/40"><input type="checkbox" checked={preferences[key]} onChange={() => toggle(key)} className="h-4 w-4 accent-primary" /><span className="min-w-0 flex-1 text-sm font-medium">{dashboardPreferenceLabels[key]}</span>{preferences[key] && <Check className="h-4 w-4 text-primary" />}</label>)}</div><div className="mt-5 flex justify-end"><Button onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90">Enregistrer les préférences</Button></div></CardContent></Card></div>;
}
