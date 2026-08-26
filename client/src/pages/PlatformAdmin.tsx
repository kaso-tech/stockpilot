import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Building2, CircleAlert, ClipboardList, Loader2, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const formatDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PlatformAdmin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [pendingCompany, setPendingCompany] = useState<{ id: number; name: string; status: "active" | "suspended" } | null>(null);
  const [reason, setReason] = useState("");
  const access = trpc.platform.access.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const overview = trpc.platform.overview.useQuery(undefined, { enabled: access.isSuccess });
  const companies = trpc.platform.companies.list.useQuery({ search }, { enabled: access.isSuccess });
  const audits = trpc.platform.audit.useQuery({ limit: 12 }, { enabled: access.isSuccess });
  const setStatus = trpc.platform.companies.setStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.platform.overview.invalidate(), utils.platform.companies.list.invalidate(), utils.platform.audit.invalidate()]);
      toast.success("Statut de l’entreprise mis à jour.");
      setPendingCompany(null);
      setReason("");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!loading && !user) setLocation("/");
  }, [loading, user, setLocation]);

  const filteredAudits = useMemo(() => audits.data ?? [], [audits.data]);
  if (loading || (user && access.isLoading)) return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-100"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!user || access.isError || !access.data?.platformRole) return <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100"><Card className="max-w-md border-white/10 bg-slate-900 text-slate-100"><CardHeader><CardTitle>Accès plateforme non autorisé</CardTitle></CardHeader><CardContent><Button onClick={() => setLocation("/")}>Revenir à l’application</Button></CardContent></Card></div>;

  const confirmStatus = () => {
    if (!pendingCompany) return;
    const nextStatus = pendingCompany.status === "active" ? "suspended" : "active";
    setStatus.mutate({ companyId: pendingCompany.id, status: nextStatus, reason: nextStatus === "suspended" ? reason : reason || undefined });
  };

  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-6 w-6" /></span><div><h1 className="text-xl font-semibold">Console plateforme</h1><Badge className="mt-1 border-primary/30 bg-primary/15 text-primary">{access.data?.platformRole === "super_admin" ? "Super administrateur" : "Opérateur plateforme"}</Badge></div></div>
        <Button variant="outline" onClick={() => setLocation("/")} className="border-white/15 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white">Espace entreprise</Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Building2} label="Entreprises" value={overview.data?.totalCompanies ?? 0} />
        <Metric icon={ShieldCheck} label="Actives" value={overview.data?.activeCompanies ?? 0} tone="text-emerald-300" />
        <Metric icon={CircleAlert} label="Suspendues" value={overview.data?.suspendedCompanies ?? 0} tone="text-amber-300" />
        <Metric icon={ClipboardList} label="Support ouvert" value={overview.data?.openSupportRequests ?? 0} tone="text-violet-300" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <Card className="border-white/10 bg-slate-900/75 text-slate-100"><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="text-base">Entreprises</CardTitle><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une entreprise" className="h-9 max-w-xs border-white/10 bg-slate-950 text-slate-100 placeholder:text-slate-500" /></CardHeader><CardContent className="space-y-3">
          {companies.isLoading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div> : companies.data?.map(company => <article key={company.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-medium">{company.name}</p><p className="truncate text-sm text-slate-400">{company.ownerName || "Administrateur non défini"}{company.ownerEmail ? ` · ${company.ownerEmail}` : ""}</p><p className="mt-1 text-xs text-slate-500">Créée le {formatDate(company.createdAt)} · Dernière activité {formatDate(company.lastSignedIn)}</p>{company.suspensionReason && <p className="mt-2 text-xs text-amber-300">Motif : {company.suspensionReason}</p>}</div><div className="flex items-center gap-3"><Badge className={company.platformStatus === "active" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-400/25 bg-amber-400/10 text-amber-300"}>{company.platformStatus === "active" ? "Active" : "Suspendue"}</Badge><Button size="sm" variant={company.platformStatus === "active" ? "outline" : "default"} onClick={() => setPendingCompany({ id: company.id, name: company.name, status: company.platformStatus })} className={company.platformStatus === "active" ? "border-amber-400/30 text-amber-200 hover:bg-amber-400/10 hover:text-amber-100" : "bg-primary text-primary-foreground hover:bg-primary/90"}>{company.platformStatus === "active" ? "Suspendre" : "Réactiver"}</Button></div></article>) ?? <p className="py-8 text-center text-sm text-slate-400">Aucune entreprise ne correspond à la recherche.</p>}
        </CardContent></Card>
        <Card className="border-white/10 bg-slate-900/75 text-slate-100"><CardHeader><CardTitle className="text-base">Journal plateforme</CardTitle></CardHeader><CardContent className="space-y-3">{filteredAudits.length ? filteredAudits.map(item => <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><p className="text-sm font-medium">{item.action}</p><p className="mt-1 text-xs text-slate-400">{item.actorName || "Opérateur plateforme"} · {formatDate(item.createdAt)}</p>{item.reason && <p className="mt-2 text-xs text-slate-300">{item.reason}</p>}</div>) : <p className="py-10 text-center text-sm text-slate-400">Aucune action plateforme enregistrée.</p>}</CardContent></Card>
      </section>
    </div>

    <Dialog open={Boolean(pendingCompany)} onOpenChange={open => { if (!open && !setStatus.isPending) { setPendingCompany(null); setReason(""); } }}><DialogContent className="border-white/10 bg-slate-900 text-slate-100"><DialogHeader><DialogTitle>{pendingCompany?.status === "active" ? "Suspendre l’entreprise" : "Réactiver l’entreprise"}</DialogTitle></DialogHeader><div className="space-y-3"><p className="text-sm text-slate-300">{pendingCompany?.name}</p><Label htmlFor="platform-reason">Motif {pendingCompany?.status === "active" ? "de suspension" : "optionnel"}</Label><Input id="platform-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={400} placeholder={pendingCompany?.status === "active" ? "Motif requis" : "Motif de réactivation"} className="border-white/10 bg-slate-950 text-slate-100" /></div><DialogFooter><Button variant="outline" disabled={setStatus.isPending} onClick={() => setPendingCompany(null)} className="border-white/15 bg-transparent text-slate-100">Annuler</Button><Button disabled={setStatus.isPending || (pendingCompany?.status === "active" && reason.trim().length < 3)} onClick={confirmStatus} className="bg-primary text-primary-foreground hover:bg-primary/90">{setStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{pendingCompany?.status === "active" ? "Confirmer la suspension" : "Confirmer la réactivation"}</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function Metric({ icon: Icon, label, value, tone = "text-primary" }: { icon: typeof Building2; label: string; value: number; tone?: string }) {
  return <Card className="border-white/10 bg-slate-900/75 text-slate-100"><CardContent className="flex items-center gap-3 p-4"><span className={`grid h-10 w-10 place-items-center rounded-xl bg-white/5 ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs text-slate-400">{label}</p><p className="text-2xl font-semibold">{value}</p></div></CardContent></Card>;
}
