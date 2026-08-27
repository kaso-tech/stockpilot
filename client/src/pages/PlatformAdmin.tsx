import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity, Building2, ChartNoAxesCombined, CircleAlert, ClipboardCheck, ClipboardList, Headphones, Loader2, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const formatDate = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const formatDateTime = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function PlatformAdmin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [pendingCompany, setPendingCompany] = useState<{ id: number; name: string; status: "active" | "suspended" } | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [supportStatusFilter, setSupportStatusFilter] = useState<"all" | "open" | "in_progress" | "closed">("all");
  const [supportPriorityFilter, setSupportPriorityFilter] = useState<"all" | "low" | "normal" | "high" | "critical">("all");
  const [selectedSupportId, setSelectedSupportId] = useState<number | null>(null);
  const [operatorEmail, setOperatorEmail] = useState("");
  const [operatorRole, setOperatorRole] = useState<"super_admin" | "operations" | "support" | "billing">("support");
  const [reason, setReason] = useState("");
  const access = trpc.platform.access.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const overview = trpc.platform.overview.useQuery(undefined, { enabled: access.isSuccess });
  const companies = trpc.platform.companies.list.useQuery({ search }, { enabled: access.isSuccess });
  const companyHealth = trpc.platform.companies.health.useQuery(undefined, { enabled: access.isSuccess });
  const audits = trpc.platform.audit.useQuery({ limit: 12 }, { enabled: access.isSuccess });
  const supportQueue = trpc.platform.support.list.useQuery({ status: supportStatusFilter === "all" ? undefined : supportStatusFilter, priority: supportPriorityFilter === "all" ? undefined : supportPriorityFilter, limit: 50 }, { enabled: access.isSuccess });
  const supportEvents = trpc.platform.support.events.useQuery({ supportRequestId: selectedSupportId ?? 0 }, { enabled: access.isSuccess && selectedSupportId !== null });
  const operators = trpc.platform.operators.list.useQuery(undefined, { enabled: access.isSuccess && access.data?.platformRole === "super_admin" });
  const setStatus = trpc.platform.companies.setStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.platform.overview.invalidate(), utils.platform.companies.list.invalidate(), utils.platform.audit.invalidate()]);
      toast.success("Statut de l’entreprise mis à jour.");
      setPendingCompany(null);
      setReason("");
    },
    onError: error => toast.error(error.message),
  });
  const triageSupport = trpc.platform.support.triage.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.platform.support.list.invalidate(), utils.platform.support.events.invalidate(), utils.platform.overview.invalidate(), utils.platform.companies.health.invalidate(), utils.platform.audit.invalidate()]);
      toast.success("Triage support mis à jour.");
    },
    onError: error => toast.error(error.message),
  });
  const grantOperator = trpc.platform.operators.grant.useMutation({
    onSuccess: async () => { await Promise.all([utils.platform.operators.list.invalidate(), utils.platform.audit.invalidate()]); setOperatorEmail(""); toast.success("Accès opérateur accordé."); },
    onError: error => toast.error(error.message),
  });
  const updateOperatorRole = trpc.platform.operators.updateRole.useMutation({
    onSuccess: async () => { await Promise.all([utils.platform.operators.list.invalidate(), utils.platform.audit.invalidate()]); toast.success("Rôle opérateur mis à jour."); },
    onError: error => toast.error(error.message),
  });
  const revokeOperator = trpc.platform.operators.revoke.useMutation({
    onSuccess: async () => { await Promise.all([utils.platform.operators.list.invalidate(), utils.platform.audit.invalidate()]); toast.success("Accès opérateur révoqué."); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!loading && !user) setLocation("/");
  }, [loading, user, setLocation]);

  const filteredAudits = useMemo(() => audits.data ?? [], [audits.data]);
  const healthByCompanyId = useMemo(() => new Map((companyHealth.data ?? []).map(item => [item.id, item])), [companyHealth.data]);
  const selectedCompany = useMemo(() => (companies.data ?? []).find(company => company.id === selectedCompanyId) ?? null, [companies.data, selectedCompanyId]);
  const selectedHealth = selectedCompany ? healthByCompanyId.get(selectedCompany.id) : null;
  if (loading || (user && access.isLoading)) return <div className="grid min-h-screen place-items-center bg-background text-foreground"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!user || access.isError || !access.data?.platformRole) return <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground"><Card className="max-w-md"><CardHeader><CardTitle>Accès plateforme non autorisé</CardTitle></CardHeader><CardContent><Button onClick={() => setLocation("/")}>Revenir à l’application</Button></CardContent></Card></div>;

  const confirmStatus = () => {
    if (!pendingCompany) return;
    const nextStatus = pendingCompany.status === "active" ? "suspended" : "active";
    setStatus.mutate({ companyId: pendingCompany.id, status: nextStatus, reason: nextStatus === "suspended" ? reason : reason || undefined });
  };

  const stats = overview.data;
  const totalCompanies = stats?.totalCompanies ?? 0;
  const activeShare = totalCompanies ? Math.round(((stats?.activeCompanies ?? 0) / totalCompanies) * 100) : 0;
  const onboardingShare = totalCompanies ? Math.round(((stats?.onboardedCompanies ?? 0) / totalCompanies) * 100) : 0;

  return <main className="min-h-screen bg-background p-4 text-foreground sm:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-6 w-6" /></span><div><h1 className="text-xl font-semibold">Console plateforme</h1><Badge variant="secondary" className="mt-1">{access.data?.platformRole === "super_admin" ? "Super administrateur" : "Opérateur plateforme"}</Badge></div></div>
        <Button variant="outline" onClick={() => setLocation("/")}>Espace entreprise</Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Building2} label="Entreprises" value={totalCompanies} />
        <Metric icon={ShieldCheck} label="Actives" value={stats?.activeCompanies ?? 0} tone="text-emerald-700 dark:text-emerald-300" />
        <Metric icon={CircleAlert} label="Suspendues" value={stats?.suspendedCompanies ?? 0} tone="text-amber-800 dark:text-amber-200" />
        <Metric icon={Headphones} label="Support à traiter" value={stats?.openSupportRequests ?? 0} tone="text-violet-700 dark:text-violet-300" />
      </section>

      <section aria-label="Vue globale des entreprises" className="space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold">Vue globale des entreprises</p><p className="text-sm text-muted-foreground">Indicateurs d’exploitation de la plateforme, sans données commerciales clientes.</p></div><Badge variant="outline" className="border-border bg-muted text-muted-foreground">Actualisé à l’ouverture</Badge></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={ChartNoAxesCombined} label="Nouvelles entreprises · 7 jours" value={stats?.newCompaniesLast7Days ?? 0} tone="text-primary" />
          <Metric icon={Activity} label="Entreprises actives · 7 jours" value={stats?.activeCompaniesLast7Days ?? 0} tone="text-cyan-700 dark:text-cyan-300" />
          <Metric icon={ClipboardCheck} label="Onboarding terminé" value={stats?.onboardedCompanies ?? 0} tone="text-emerald-700 dark:text-emerald-300" />
          <Metric icon={UsersRound} label="Nouvelles entreprises · 30 jours" value={stats?.newCompaniesLast30Days ?? 0} tone="text-indigo-700 dark:text-indigo-300" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <StatusPanel title="Portefeuille entreprises" description="Répartition administrative actuelle" value={`${activeShare} %`} valueLabel="actives" icon={Building2}>
            <DistributionRow label="Actives" value={stats?.activeCompanies ?? 0} total={totalCompanies} className="bg-emerald-600 dark:bg-emerald-400" />
            <DistributionRow label="Suspendues" value={stats?.suspendedCompanies ?? 0} total={totalCompanies} className="bg-amber-600 dark:bg-amber-400" />
          </StatusPanel>
          <StatusPanel title="Adoption" description="Parcours initial finalisé" value={`${onboardingShare} %`} valueLabel="onboarding terminé" icon={UserCheck}>
            <DistributionRow label="Terminés" value={stats?.onboardedCompanies ?? 0} total={totalCompanies} className="bg-primary" />
            <DistributionRow label="À finaliser" value={Math.max(totalCompanies - (stats?.onboardedCompanies ?? 0), 0)} total={totalCompanies} className="bg-muted-foreground" />
          </StatusPanel>
          <StatusPanel title="Support" description="État global des demandes" value={String(stats?.openSupportRequests ?? 0)} valueLabel="demandes à traiter" icon={ClipboardList}>
            <DistributionRow label="Ouvertes" value={stats?.supportByStatus.open ?? 0} total={Math.max((stats?.supportByStatus.open ?? 0) + (stats?.supportByStatus.inProgress ?? 0) + (stats?.supportByStatus.closed ?? 0), 1)} className="bg-rose-600 dark:bg-rose-400" />
            <DistributionRow label="En cours" value={stats?.supportByStatus.inProgress ?? 0} total={Math.max((stats?.supportByStatus.open ?? 0) + (stats?.supportByStatus.inProgress ?? 0) + (stats?.supportByStatus.closed ?? 0), 1)} className="bg-amber-600 dark:bg-amber-400" />
            <DistributionRow label="Clôturées" value={stats?.supportByStatus.closed ?? 0} total={Math.max((stats?.supportByStatus.open ?? 0) + (stats?.supportByStatus.inProgress ?? 0) + (stats?.supportByStatus.closed ?? 0), 1)} className="bg-emerald-600 dark:bg-emerald-400" />
          </StatusPanel>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <Card><CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle className="text-base">Entreprises et santé</CardTitle><p className="mt-1 text-sm text-muted-foreground">Statut administratif, sauvegarde, activité et support.</p></div><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une entreprise" className="h-9 max-w-xs" /></CardHeader><CardContent className="space-y-3">
          {companies.isLoading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div> : companies.data?.map(company => { const health = healthByCompanyId.get(company.id); return <article key={company.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-medium">{company.name}</p><p className="truncate text-sm text-muted-foreground">{company.ownerName || "Administrateur non défini"}{company.ownerEmail ? ` · ${company.ownerEmail}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">Créée le {formatDate(company.createdAt)} · Dernière activité {formatDate(health?.lastActivityAt ?? company.lastSignedIn)}</p><div className="mt-2 flex flex-wrap gap-2">{health ? <><HealthBadge health={health.backupHealth} /><SyncHealthBadge health={health.syncHealth} /><Badge variant="outline" className={health.openSupportCount ? "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200" : "border-border bg-background text-muted-foreground"}>{health.openSupportCount ? `${health.openSupportCount} support à traiter` : "Aucun support ouvert"}</Badge>{health.attentionRequired && <Badge variant="outline" className="border-rose-600/35 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200">À surveiller</Badge>}</> : <Badge variant="outline" className="border-border bg-background text-muted-foreground">Santé en chargement</Badge>}</div>{company.suspensionReason && <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">Motif : {company.suspensionReason}</p>}</div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedCompanyId(company.id)}>Voir le suivi</Button><Badge className={company.platformStatus === "active" ? "border-emerald-600/35 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200" : "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200"}>{company.platformStatus === "active" ? "Active" : "Suspendue"}</Badge><Button size="sm" variant={company.platformStatus === "active" ? "outline" : "default"} onClick={() => setPendingCompany({ id: company.id, name: company.name, status: company.platformStatus })} className={company.platformStatus === "active" ? "border-amber-600 text-amber-900 hover:bg-amber-100 hover:text-amber-950 dark:border-amber-400/50 dark:text-amber-200 dark:hover:bg-amber-400/15 dark:hover:text-amber-100" : undefined}>{company.platformStatus === "active" ? "Suspendre" : "Réactiver"}</Button></div></article>}) ?? <p className="py-8 text-center text-sm text-muted-foreground">Aucune entreprise ne correspond à la recherche.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Journal plateforme</CardTitle></CardHeader><CardContent className="space-y-3">{filteredAudits.length ? filteredAudits.map(item => <div key={item.id} className="rounded-xl border border-border bg-muted/40 p-3"><p className="text-sm font-medium">{item.action}</p><p className="mt-1 text-xs text-muted-foreground">{item.actorName || "Opérateur plateforme"} · {formatDate(item.createdAt)}</p>{item.reason && <p className="mt-2 text-xs text-foreground">{item.reason}</p>}</div>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucune action plateforme enregistrée.</p>}</CardContent></Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card><CardHeader className="gap-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-base">Registre support plateforme</CardTitle><p className="mt-1 text-sm text-muted-foreground">Triage et suivi par métadonnées ; le contenu et les captures clients restent cloisonnés.</p></div><div className="flex flex-wrap gap-2"><Select value={supportStatusFilter} onValueChange={value => setSupportStatusFilter(value as typeof supportStatusFilter)}><SelectTrigger className="h-9 w-[145px]"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem><SelectItem value="open">Ouvertes</SelectItem><SelectItem value="in_progress">En cours</SelectItem><SelectItem value="closed">Clôturées</SelectItem></SelectContent></Select><Select value={supportPriorityFilter} onValueChange={value => setSupportPriorityFilter(value as typeof supportPriorityFilter)}><SelectTrigger className="h-9 w-[145px]"><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes priorités</SelectItem><SelectItem value="low">Basse</SelectItem><SelectItem value="normal">Normale</SelectItem><SelectItem value="high">Haute</SelectItem><SelectItem value="critical">Critique</SelectItem></SelectContent></Select></div></div></CardHeader><CardContent className="space-y-3">{supportQueue.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : supportQueue.data?.length ? supportQueue.data.map(request => <article key={request.id} className="rounded-xl border border-border bg-muted/40 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{request.companyName || "Entreprise non disponible"}</p><SupportStatusBadge status={request.status} /><SupportPriorityBadge priority={request.priority} /></div><p className="mt-1 text-xs text-muted-foreground">Demande #{request.id} · Créée le {formatDateTime(request.createdAt)}{request.dueAt ? ` · Échéance ${formatDate(request.dueAt)}` : ""}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={triageSupport.isPending} onClick={() => setSelectedSupportId(request.id)}>Journal</Button>{request.status === "open" && <Button size="sm" variant="outline" disabled={triageSupport.isPending} onClick={() => triageSupport.mutate({ supportRequestId: request.id, status: "in_progress", takeOwnership: true })}>{triageSupport.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Prendre en charge</Button>}{request.status === "in_progress" && <Button size="sm" disabled={triageSupport.isPending} onClick={() => triageSupport.mutate({ supportRequestId: request.id, status: "closed" })}>Clôturer</Button>}</div></div><div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]"><Select value={request.priority} onValueChange={value => triageSupport.mutate({ supportRequestId: request.id, priority: value as "low" | "normal" | "high" | "critical" })}><SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Priorité basse</SelectItem><SelectItem value="normal">Priorité normale</SelectItem><SelectItem value="high">Priorité haute</SelectItem><SelectItem value="critical">Priorité critique</SelectItem></SelectContent></Select><Input type="date" aria-label={`Échéance de la demande ${request.id}`} className="h-9 bg-background" value={request.dueAt ? new Date(request.dueAt).toISOString().slice(0, 10) : ""} onChange={event => triageSupport.mutate({ supportRequestId: request.id, dueAt: event.target.value ? new Date(`${event.target.value}T12:00:00`) : null })} disabled={triageSupport.isPending} /></div></article>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucune demande ne correspond aux filtres.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Journal de triage</CardTitle></CardHeader><CardContent className="space-y-3">{selectedSupportId === null ? <p className="py-10 text-center text-sm text-muted-foreground">Sélectionnez une demande pour consulter les actions de triage.</p> : supportEvents.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : supportEvents.data?.length ? supportEvents.data.map(event => <div key={event.id} className="rounded-xl border border-border bg-muted/40 p-3"><p className="text-sm font-medium">{supportEventLabel(event.action)}</p><p className="mt-1 text-xs text-muted-foreground">{event.actorName || "Opérateur plateforme"} · {formatDateTime(event.createdAt)}</p></div>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucune action de triage enregistrée.</p>}</CardContent></Card>
      </section>

      {access.data?.platformRole === "super_admin" && <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"><Card><CardHeader><CardTitle className="text-base">Ajouter un opérateur</CardTitle><p className="mt-1 text-sm text-muted-foreground">Le compte doit déjà exister. Les accès sont séparés de toute entreprise cliente.</p></CardHeader><CardContent className="space-y-3"><Label htmlFor="platform-operator-email">E-mail du compte existant</Label><Input id="platform-operator-email" type="email" value={operatorEmail} onChange={event => setOperatorEmail(event.target.value)} placeholder="operateur@exemple.com" maxLength={320} /><Label>Rôle plateforme</Label><Select value={operatorRole} onValueChange={value => setOperatorRole(value as typeof operatorRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="support">Support</SelectItem><SelectItem value="operations">Opérations</SelectItem><SelectItem value="billing">Facturation</SelectItem><SelectItem value="super_admin">Super administrateur</SelectItem></SelectContent></Select><Button className="w-full" disabled={grantOperator.isPending || !operatorEmail.trim()} onClick={() => grantOperator.mutate({ email: operatorEmail, platformRole: operatorRole })}>{grantOperator.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Accorder l’accès</Button></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Opérateurs plateforme</CardTitle></CardHeader><CardContent className="space-y-3">{operators.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : operators.data?.length ? operators.data.map(operator => <div key={operator.userId} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{operator.name || "Compte plateforme"}</p><p className="truncate text-xs text-muted-foreground">{operator.email || "E-mail non disponible"}</p><p className="mt-1 text-xs text-muted-foreground">{operator.active ? "Accès actif" : "Accès révoqué"} · Depuis le {formatDate(operator.createdAt)}</p></div><div className="flex flex-wrap items-center gap-2"><Select value={operator.platformRole} disabled={!operator.active || updateOperatorRole.isPending} onValueChange={value => updateOperatorRole.mutate({ userId: operator.userId, platformRole: value as "super_admin" | "operations" | "support" | "billing" })}><SelectTrigger className="h-9 w-[170px] bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="super_admin">Super administrateur</SelectItem><SelectItem value="operations">Opérations</SelectItem><SelectItem value="support">Support</SelectItem><SelectItem value="billing">Facturation</SelectItem><SelectItem value="operator" disabled>Opérateur historique</SelectItem></SelectContent></Select><Button size="sm" variant="outline" disabled={!operator.active || operator.userId === user?.id || revokeOperator.isPending} onClick={() => revokeOperator.mutate({ userId: operator.userId })}>{revokeOperator.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Révoquer</Button></div></div>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucun opérateur plateforme n’est enregistré.</p>}</CardContent></Card></section>}
    </div>

    <Dialog open={Boolean(pendingCompany)} onOpenChange={open => { if (!open && !setStatus.isPending) { setPendingCompany(null); setReason(""); } }}><DialogContent><DialogHeader><DialogTitle>{pendingCompany?.status === "active" ? "Suspendre l’entreprise" : "Réactiver l’entreprise"}</DialogTitle></DialogHeader><div className="space-y-3"><p className="text-sm text-muted-foreground">{pendingCompany?.name}</p><Label htmlFor="platform-reason">Motif {pendingCompany?.status === "active" ? "de suspension" : "optionnel"}</Label><Input id="platform-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={400} placeholder={pendingCompany?.status === "active" ? "Motif requis" : "Motif de réactivation"} /></div><DialogFooter><Button variant="outline" disabled={setStatus.isPending} onClick={() => setPendingCompany(null)}>Annuler</Button><Button disabled={setStatus.isPending || (pendingCompany?.status === "active" && reason.trim().length < 3)} onClick={confirmStatus}>{setStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{pendingCompany?.status === "active" ? "Confirmer la suspension" : "Confirmer la réactivation"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(selectedCompany)} onOpenChange={open => { if (!open) setSelectedCompanyId(null); }}><DialogContent><DialogHeader><DialogTitle>Suivi plateforme — {selectedCompany?.name}</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">Cette fiche présente exclusivement des métadonnées d’exploitation. Elle ne donne accès à aucune donnée métier de l’entreprise.</p><div className="grid gap-3 sm:grid-cols-2"><HealthDetail label="Statut administratif" value={selectedCompany?.platformStatus === "active" ? "Active" : "Suspendue"} /><HealthDetail label="Création" value={formatDate(selectedCompany?.createdAt)} /><HealthDetail label="Onboarding" value={selectedCompany?.onboardingCompletedAt ? "Terminé" : "À finaliser"} /><HealthDetail label="Dernière activité" value={formatDate(selectedHealth?.lastActivityAt ?? selectedCompany?.lastSignedIn)} /><HealthDetail label="Sauvegarde" value={selectedHealth ? backupHealthLabel(selectedHealth.backupHealth) : "En cours de chargement"} /><HealthDetail label="Synchronisation" value={selectedHealth ? syncHealthLabel(selectedHealth.syncHealth) : "En cours de chargement"} /><HealthDetail label="Support à traiter" value={selectedHealth ? String(selectedHealth.openSupportCount) : "—"} /></div></div><DialogFooter><Button onClick={() => setSelectedCompanyId(null)}>Fermer</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function Metric({ icon: Icon, label, value, tone = "text-primary" }: { icon: typeof Building2; label: string; value: number; tone?: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><span className={`grid h-10 w-10 place-items-center rounded-xl bg-muted ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div></CardContent></Card>;
}

function StatusPanel({ title, description, value, valueLabel, icon: Icon, children }: { title: string; description: string; value: string; valueLabel: string; icon: typeof Building2; children: React.ReactNode }) {
  return <Card><CardHeader className="gap-1 pb-0"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-primary"><Icon className="h-4 w-4" /></span></div></CardHeader><CardContent className="space-y-3 pt-4"><div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{valueLabel}</p></div>{children}</CardContent></Card>;
}

function DistributionRow({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  const width = total > 0 ? Math.max(Math.round((value / total) * 100), value > 0 ? 4 : 0) : 0;
  return <div className="space-y-1.5"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-[width] duration-200 ${className}`} style={{ width: `${width}%` }} /></div></div>;
}

function HealthBadge({ health }: { health: "healthy" | "stale" | "failed" | "not_configured" }) {
  const variants = {
    healthy: { label: "Sauvegarde à jour", className: "border-emerald-600/35 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200" },
    stale: { label: "Sauvegarde à vérifier", className: "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200" },
    failed: { label: "Sauvegarde en échec", className: "border-rose-600/35 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200" },
    not_configured: { label: "Sauvegarde non configurée", className: "border-border bg-background text-muted-foreground" },
  } as const;
  const variant = variants[health];
  return <Badge variant="outline" className={variant.className}>{variant.label}</Badge>;
}

function HealthDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function backupHealthLabel(health: "healthy" | "stale" | "failed" | "not_configured") {
  return { healthy: "À jour", stale: "À vérifier", failed: "En échec", not_configured: "Non configurée" }[health];
}

function SyncHealthBadge({ health }: { health: "healthy" | "pending" | "failed" | "offline" | "stale" | "not_reported" }) {
  const variants = {
    healthy: { label: "Synchronisation à jour", className: "border-emerald-600/35 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200" },
    pending: { label: "Synchronisation en attente", className: "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200" },
    failed: { label: "Synchronisation en échec", className: "border-rose-600/35 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200" },
    offline: { label: "Appareil hors connexion", className: "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200" },
    stale: { label: "Synchronisation à vérifier", className: "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200" },
    not_reported: { label: "Synchronisation non rapportée", className: "border-border bg-background text-muted-foreground" },
  } as const;
  const variant = variants[health];
  return <Badge variant="outline" className={variant.className}>{variant.label}</Badge>;
}

function syncHealthLabel(health: "healthy" | "pending" | "failed" | "offline" | "stale" | "not_reported") {
  return { healthy: "À jour", pending: "En attente", failed: "En échec", offline: "Hors connexion", stale: "À vérifier", not_reported: "Non rapportée" }[health];
}

function SupportStatusBadge({ status }: { status: "open" | "in_progress" | "closed" }) {
  const variants = { open: ["Ouverte", "border-rose-600/35 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200"], in_progress: ["En cours", "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200"], closed: ["Clôturée", "border-emerald-600/35 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200"] } as const;
  const [label, className] = variants[status];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function SupportPriorityBadge({ priority }: { priority: "low" | "normal" | "high" | "critical" }) {
  const variants = { low: ["Basse", "border-border bg-background text-muted-foreground"], normal: ["Normale", "border-primary/35 bg-primary/10 text-primary"], high: ["Haute", "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200"], critical: ["Critique", "border-rose-600/35 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200"] } as const;
  const [label, className] = variants[priority];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function supportEventLabel(action: "assigned" | "priority_changed" | "status_changed" | "due_date_changed") {
  return { assigned: "Affectation modifiée", priority_changed: "Priorité modifiée", status_changed: "Statut modifié", due_date_changed: "Échéance modifiée" }[action];
}
