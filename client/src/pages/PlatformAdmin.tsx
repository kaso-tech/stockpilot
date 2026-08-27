import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlatformConsoleShell } from "@/components/PlatformConsoleShell";
import { downloadCsv } from "@/lib/csv";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity, Building2, ChartNoAxesCombined, CircleAlert, ClipboardCheck, ClipboardList, Download, Headphones, Loader2, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
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
  const [companyStatusFilter, setCompanyStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [companyHealthFilter, setCompanyHealthFilter] = useState<"all" | "attention" | "healthy">("all");
  const [companyPage, setCompanyPage] = useState(1);
  const [isExportingCompanies, setIsExportingCompanies] = useState(false);
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
  const filteredCompanies = useMemo(() => (companies.data ?? []).filter(company => {
    const health = healthByCompanyId.get(company.id);
    if (companyStatusFilter !== "all" && company.platformStatus !== companyStatusFilter) return false;
    if (companyHealthFilter === "attention" && !health?.attentionRequired) return false;
    if (companyHealthFilter === "healthy" && (!health || health.attentionRequired)) return false;
    return true;
  }), [companies.data, companyHealthFilter, companyStatusFilter, healthByCompanyId]);
  const companyPageSize = 8;
  const companyPageCount = Math.max(1, Math.ceil(filteredCompanies.length / companyPageSize));
  const visibleCompanies = filteredCompanies.slice((companyPage - 1) * companyPageSize, companyPage * companyPageSize);

  useEffect(() => { setCompanyPage(1); }, [companyHealthFilter, companyStatusFilter, search]);
  useEffect(() => { if (companyPage > companyPageCount) setCompanyPage(companyPageCount); }, [companyPage, companyPageCount]);
  if (loading || (user && access.isLoading)) return <div className="grid min-h-screen place-items-center bg-background text-foreground"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!user || access.isError || !access.data?.platformRole) return <div className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground"><Card className="max-w-md"><CardHeader><CardTitle>Accès plateforme non autorisé</CardTitle></CardHeader><CardContent><Button onClick={() => setLocation("/")}>Revenir à l’application</Button></CardContent></Card></div>;

  const confirmStatus = () => {
    if (!pendingCompany) return;
    const nextStatus = pendingCompany.status === "active" ? "suspended" : "active";
    setStatus.mutate({ companyId: pendingCompany.id, status: nextStatus, reason: nextStatus === "suspended" ? reason : reason || undefined });
  };

  const exportCompanies = () => {
    if (!filteredCompanies.length) return;
    setIsExportingCompanies(true);
    window.setTimeout(() => {
      downloadCsv(`stockpilot-entreprises-${new Date().toISOString().slice(0, 10)}.csv`, ["Entreprise", "Statut", "Créée le", "Dernière activité", "Onboarding", "Sauvegarde", "Synchronisation", "Support ouvert"], filteredCompanies.map(company => {
        const health = healthByCompanyId.get(company.id);
        return [company.name, company.platformStatus === "active" ? "Active" : "Suspendue", formatDate(company.createdAt), formatDate(health?.lastActivityAt ?? company.lastSignedIn), company.onboardingCompletedAt ? "Terminé" : "À finaliser", health ? backupHealthLabel(health.backupHealth) : "Non disponible", health ? syncHealthLabel(health.syncHealth) : "Non disponible", health?.openSupportCount ?? 0];
      }));
      setIsExportingCompanies(false);
      toast.success("Export administratif téléchargé.");
    }, 0);
  };

  const stats = overview.data;
  const totalCompanies = stats?.totalCompanies ?? 0;
  const activeShare = totalCompanies ? Math.round(((stats?.activeCompanies ?? 0) / totalCompanies) * 100) : 0;
  const onboardingShare = totalCompanies ? Math.round(((stats?.onboardedCompanies ?? 0) / totalCompanies) * 100) : 0;
  const canManageBilling = ["super_admin", "operator", "billing"].includes(access.data?.platformRole ?? "");

  return <PlatformConsoleShell role={access.data.platformRole} openSupportCount={stats?.openSupportRequests ?? 0} onExit={() => setLocation("/")}>
    <div className="space-y-6">

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Building2} label="Entreprises" value={totalCompanies} />
        <Metric icon={ShieldCheck} label="Actives" value={stats?.activeCompanies ?? 0} tone="text-emerald-700 dark:text-emerald-300" />
        <Metric icon={CircleAlert} label="Suspendues" value={stats?.suspendedCompanies ?? 0} tone="text-amber-800 dark:text-amber-200" />
        <Metric icon={Headphones} label="Support à traiter" value={stats?.openSupportRequests ?? 0} tone="text-violet-700 dark:text-violet-300" />
      </section>

      <section id="overview" aria-label="Vue globale des entreprises" className="scroll-mt-28 space-y-4">
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

      <section id="companies" className="scroll-mt-28 grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <Card><CardHeader className="gap-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><CardTitle className="text-base">Entreprises et santé</CardTitle><p className="mt-1 text-sm text-muted-foreground">Statut administratif, sauvegarde, activité et support.</p></div><Button variant="outline" size="sm" disabled={isExportingCompanies || !filteredCompanies.length} onClick={exportCompanies}>{isExportingCompanies ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Exporter</Button></div><div className="grid gap-2 sm:grid-cols-3"><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une entreprise" className="h-9" /><Select value={companyStatusFilter} onValueChange={value => setCompanyStatusFilter(value as typeof companyStatusFilter)}><SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem><SelectItem value="active">Actives</SelectItem><SelectItem value="suspended">Suspendues</SelectItem></SelectContent></Select><Select value={companyHealthFilter} onValueChange={value => setCompanyHealthFilter(value as typeof companyHealthFilter)}><SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toute santé</SelectItem><SelectItem value="attention">À surveiller</SelectItem><SelectItem value="healthy">Sans alerte</SelectItem></SelectContent></Select></div></CardHeader><CardContent className="space-y-3">
          {companies.isLoading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div> : visibleCompanies.length ? visibleCompanies.map(company => { const health = healthByCompanyId.get(company.id); return <article key={company.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-medium">{company.name}</p><p className="truncate text-sm text-muted-foreground">{company.ownerName || "Administrateur non défini"}{company.ownerEmail ? ` · ${company.ownerEmail}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">Créée le {formatDate(company.createdAt)} · Dernière activité {formatDate(health?.lastActivityAt ?? company.lastSignedIn)}</p><div className="mt-2 flex flex-wrap gap-2">{health ? <><HealthBadge health={health.backupHealth} /><SyncHealthBadge health={health.syncHealth} /><Badge variant="outline" className={health.openSupportCount ? "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200" : "border-border bg-background text-muted-foreground"}>{health.openSupportCount ? `${health.openSupportCount} support à traiter` : "Aucun support ouvert"}</Badge>{health.attentionRequired && <Badge variant="outline" className="border-rose-600/35 bg-rose-100 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200">À surveiller</Badge>}</> : <Badge variant="outline" className="border-border bg-background text-muted-foreground">Santé en chargement</Badge>}</div>{company.suspensionReason && <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">Motif : {company.suspensionReason}</p>}</div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedCompanyId(company.id)}>Voir le suivi</Button><Badge className={company.platformStatus === "active" ? "border-emerald-600/35 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200" : "border-amber-600/35 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200"}>{company.platformStatus === "active" ? "Active" : "Suspendue"}</Badge><Button size="sm" variant={company.platformStatus === "active" ? "outline" : "default"} onClick={() => setPendingCompany({ id: company.id, name: company.name, status: company.platformStatus })} className={company.platformStatus === "active" ? "border-amber-600 text-amber-900 hover:bg-amber-100 hover:text-amber-950 dark:border-amber-400/50 dark:text-amber-200 dark:hover:bg-amber-400/15 dark:hover:text-amber-100" : undefined}>{company.platformStatus === "active" ? "Suspendre" : "Réactiver"}</Button></div></article>}) : <p className="py-8 text-center text-sm text-muted-foreground">Aucune entreprise ne correspond aux filtres.</p>}
          {filteredCompanies.length > companyPageSize && <div className="flex items-center justify-between pt-2"><p className="text-xs text-muted-foreground">Page {companyPage} sur {companyPageCount} · {filteredCompanies.length} entreprises</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={companyPage <= 1} onClick={() => setCompanyPage(page => Math.max(1, page - 1))}>Précédent</Button><Button size="sm" variant="outline" disabled={companyPage >= companyPageCount} onClick={() => setCompanyPage(page => Math.min(companyPageCount, page + 1))}>Suivant</Button></div></div>}
        </CardContent></Card>
        <Card id="audit" className="scroll-mt-28"><CardHeader><CardTitle className="text-base">Journal plateforme</CardTitle></CardHeader><CardContent className="space-y-3">{filteredAudits.length ? filteredAudits.map(item => <div key={item.id} className="rounded-xl border border-border bg-muted/40 p-3"><p className="text-sm font-medium">{item.action}</p><p className="mt-1 text-xs text-muted-foreground">{item.actorName || "Opérateur plateforme"} · {formatDate(item.createdAt)}</p>{item.reason && <p className="mt-2 text-xs text-foreground">{item.reason}</p>}</div>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucune action plateforme enregistrée.</p>}</CardContent></Card>
      </section>

      <section id="support" className="scroll-mt-28 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card><CardHeader className="gap-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-base">Registre support plateforme</CardTitle><p className="mt-1 text-sm text-muted-foreground">Triage et suivi par métadonnées ; le contenu et les captures clients restent cloisonnés.</p></div><div className="flex flex-wrap gap-2"><Select value={supportStatusFilter} onValueChange={value => setSupportStatusFilter(value as typeof supportStatusFilter)}><SelectTrigger className="h-9 w-[145px]"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous statuts</SelectItem><SelectItem value="open">Ouvertes</SelectItem><SelectItem value="in_progress">En cours</SelectItem><SelectItem value="closed">Clôturées</SelectItem></SelectContent></Select><Select value={supportPriorityFilter} onValueChange={value => setSupportPriorityFilter(value as typeof supportPriorityFilter)}><SelectTrigger className="h-9 w-[145px]"><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes priorités</SelectItem><SelectItem value="low">Basse</SelectItem><SelectItem value="normal">Normale</SelectItem><SelectItem value="high">Haute</SelectItem><SelectItem value="critical">Critique</SelectItem></SelectContent></Select></div></div></CardHeader><CardContent className="space-y-3">{supportQueue.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : supportQueue.data?.length ? supportQueue.data.map(request => <article key={request.id} className="rounded-xl border border-border bg-muted/40 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{request.companyName || "Entreprise non disponible"}</p><SupportStatusBadge status={request.status} /><SupportPriorityBadge priority={request.priority} /></div><p className="mt-1 text-xs text-muted-foreground">Demande #{request.id} · Créée le {formatDateTime(request.createdAt)}{request.dueAt ? ` · Échéance ${formatDate(request.dueAt)}` : ""}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={triageSupport.isPending} onClick={() => setSelectedSupportId(request.id)}>Journal</Button>{request.status === "open" && <Button size="sm" variant="outline" disabled={triageSupport.isPending} onClick={() => triageSupport.mutate({ supportRequestId: request.id, status: "in_progress", takeOwnership: true })}>{triageSupport.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Prendre en charge</Button>}{request.status === "in_progress" && <Button size="sm" disabled={triageSupport.isPending} onClick={() => triageSupport.mutate({ supportRequestId: request.id, status: "closed" })}>Clôturer</Button>}</div></div><div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]"><Select value={request.priority} onValueChange={value => triageSupport.mutate({ supportRequestId: request.id, priority: value as "low" | "normal" | "high" | "critical" })}><SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Priorité basse</SelectItem><SelectItem value="normal">Priorité normale</SelectItem><SelectItem value="high">Priorité haute</SelectItem><SelectItem value="critical">Priorité critique</SelectItem></SelectContent></Select><Input type="date" aria-label={`Échéance de la demande ${request.id}`} className="h-9 bg-background" value={request.dueAt ? new Date(request.dueAt).toISOString().slice(0, 10) : ""} onChange={event => triageSupport.mutate({ supportRequestId: request.id, dueAt: event.target.value ? new Date(`${event.target.value}T12:00:00`) : null })} disabled={triageSupport.isPending} /></div></article>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucune demande ne correspond aux filtres.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Journal de triage</CardTitle></CardHeader><CardContent className="space-y-3">{selectedSupportId === null ? <p className="py-10 text-center text-sm text-muted-foreground">Sélectionnez une demande pour consulter les actions de triage.</p> : supportEvents.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : supportEvents.data?.length ? supportEvents.data.map(event => <div key={event.id} className="rounded-xl border border-border bg-muted/40 p-3"><p className="text-sm font-medium">{supportEventLabel(event.action)}</p><p className="mt-1 text-xs text-muted-foreground">{event.actorName || "Opérateur plateforme"} · {formatDateTime(event.createdAt)}</p></div>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucune action de triage enregistrée.</p>}</CardContent></Card>
      </section>

      {access.data?.platformRole === "super_admin" && <section id="operators" className="scroll-mt-28 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"><Card><CardHeader><CardTitle className="text-base">Ajouter un opérateur</CardTitle><p className="mt-1 text-sm text-muted-foreground">Le compte doit déjà exister. Les accès sont séparés de toute entreprise cliente.</p></CardHeader><CardContent className="space-y-3"><Label htmlFor="platform-operator-email">E-mail du compte existant</Label><Input id="platform-operator-email" type="email" value={operatorEmail} onChange={event => setOperatorEmail(event.target.value)} placeholder="operateur@exemple.com" maxLength={320} /><Label>Rôle plateforme</Label><Select value={operatorRole} onValueChange={value => setOperatorRole(value as typeof operatorRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="support">Support</SelectItem><SelectItem value="operations">Opérations</SelectItem><SelectItem value="billing">Facturation</SelectItem><SelectItem value="super_admin">Super administrateur</SelectItem></SelectContent></Select><Button className="w-full" disabled={grantOperator.isPending || !operatorEmail.trim()} onClick={() => grantOperator.mutate({ email: operatorEmail, platformRole: operatorRole })}>{grantOperator.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Accorder l’accès</Button></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Opérateurs plateforme</CardTitle></CardHeader><CardContent className="space-y-3">{operators.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : operators.data?.length ? operators.data.map(operator => <div key={operator.userId} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium">{operator.name || "Compte plateforme"}</p><p className="truncate text-xs text-muted-foreground">{operator.email || "E-mail non disponible"}</p><p className="mt-1 text-xs text-muted-foreground">{operator.active ? "Accès actif" : "Accès révoqué"} · Depuis le {formatDate(operator.createdAt)}</p></div><div className="flex flex-wrap items-center gap-2"><Select value={operator.platformRole} disabled={!operator.active || updateOperatorRole.isPending} onValueChange={value => updateOperatorRole.mutate({ userId: operator.userId, platformRole: value as "super_admin" | "operations" | "support" | "billing" })}><SelectTrigger className="h-9 w-[170px] bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="super_admin">Super administrateur</SelectItem><SelectItem value="operations">Opérations</SelectItem><SelectItem value="support">Support</SelectItem><SelectItem value="billing">Facturation</SelectItem><SelectItem value="operator" disabled>Opérateur historique</SelectItem></SelectContent></Select><Button size="sm" variant="outline" disabled={!operator.active || operator.userId === user?.id || revokeOperator.isPending} onClick={() => revokeOperator.mutate({ userId: operator.userId })}>{revokeOperator.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Révoquer</Button></div></div>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucun opérateur plateforme n’est enregistré.</p>}</CardContent></Card></section>}
      <div id="subscriptions" className="scroll-mt-28"><SubscriptionPlanCatalog allowed={canManageBilling} /></div>
    </div>

    <Dialog open={Boolean(pendingCompany)} onOpenChange={open => { if (!open && !setStatus.isPending) { setPendingCompany(null); setReason(""); } }}><DialogContent><DialogHeader><DialogTitle>{pendingCompany?.status === "active" ? "Suspendre l’entreprise" : "Réactiver l’entreprise"}</DialogTitle></DialogHeader><div className="space-y-3"><p className="text-sm text-muted-foreground">{pendingCompany?.name}</p><Label htmlFor="platform-reason">Motif {pendingCompany?.status === "active" ? "de suspension" : "optionnel"}</Label><Input id="platform-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={400} placeholder={pendingCompany?.status === "active" ? "Motif requis" : "Motif de réactivation"} /></div><DialogFooter><Button variant="outline" disabled={setStatus.isPending} onClick={() => setPendingCompany(null)}>Annuler</Button><Button disabled={setStatus.isPending || (pendingCompany?.status === "active" && reason.trim().length < 3)} onClick={confirmStatus}>{setStatus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{pendingCompany?.status === "active" ? "Confirmer la suspension" : "Confirmer la réactivation"}</Button></DialogFooter></DialogContent></Dialog>
    <CompanyProfileDialog open={Boolean(selectedCompany)} onClose={() => setSelectedCompanyId(null)} company={selectedCompany ? { id: selectedCompany.id, name: selectedCompany.name } : null} health={selectedHealth ?? null} canManageBilling={canManageBilling} />
  </PlatformConsoleShell>;
}

function CompanyProfileDialog({ open, onClose, company, health, canManageBilling }: { open: boolean; onClose: () => void; company: { id: number; name: string } | null; health: { backupHealth: "healthy" | "stale" | "failed" | "not_configured"; syncHealth: "healthy" | "pending" | "failed" | "offline" | "stale" | "not_reported"; openSupportCount: number } | null; canManageBilling: boolean }) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<{ planId: string; status: "trial" | "active" | "past_due" | "suspended" | "cancelled" | "manual"; trialEndsAt: string; currentPeriodEndsAt: string; graceEndsAt: string }>({ planId: "none", status: "manual", trialEndsAt: "", currentPeriodEndsAt: "", graceEndsAt: "" });
  const detail = trpc.platform.companies.detail.useQuery({ companyId: company?.id ?? 0 }, { enabled: open && company !== null });
  const plans = trpc.platform.subscriptions.plans.list.useQuery(undefined, { enabled: open && canManageBilling });
  const setSubscription = trpc.platform.subscriptions.set.useMutation({
    onSuccess: async () => { await Promise.all([utils.platform.companies.detail.invalidate(), utils.platform.audit.invalidate()]); toast.success("Souscription mise à jour."); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!detail.data) return;
    setDraft({ planId: detail.data.planId ? String(detail.data.planId) : "none", status: detail.data.subscriptionStatus ?? "manual", trialEndsAt: toDateInput(detail.data.trialEndsAt), currentPeriodEndsAt: toDateInput(detail.data.currentPeriodEndsAt), graceEndsAt: toDateInput(detail.data.graceEndsAt) });
  }, [detail.data]);

  return <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) onClose(); }}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Fiche plateforme — {company?.name}</DialogTitle></DialogHeader>{detail.isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : detail.data ? <div className="space-y-5"><p className="text-sm text-muted-foreground">Cette fiche contient uniquement les paramètres SaaS, le contact administrateur autorisé et les journaux de plateforme. Les données métier de l’entreprise restent indisponibles.</p><div className="grid gap-3 sm:grid-cols-2"><HealthDetail label="Statut administratif" value={detail.data.platformStatus === "active" ? "Active" : "Suspendue"} /><HealthDetail label="Création" value={formatDate(detail.data.createdAt)} /><HealthDetail label="Onboarding" value={detail.data.onboardingCompletedAt ? "Terminé" : "À finaliser"} /><HealthDetail label="Contact administrateur" value={detail.data.ownerName || detail.data.ownerEmail || "Non défini"} /><HealthDetail label="Sauvegarde" value={health ? backupHealthLabel(health.backupHealth) : "Non disponible"} /><HealthDetail label="Synchronisation" value={health ? syncHealthLabel(health.syncHealth) : "Non disponible"} /><HealthDetail label="Support à traiter" value={health ? String(health.openSupportCount) : "—"} /><HealthDetail label="Offre actuelle" value={detail.data.planName || "Aucune offre"} /></div><div className="rounded-xl border border-border bg-muted/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">Souscription SaaS</p><p className="mt-1 text-sm text-muted-foreground">{subscriptionStatusLabel(detail.data.subscriptionStatus ?? "manual")} · {detail.data.planCode || "sans offre"}</p></div><Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">Paiement externe non activé</Badge></div>{Object.keys(detail.data.planLimits).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{Object.entries(detail.data.planLimits).map(([key, value]) => <Badge key={key} variant="outline" className="border-border bg-background text-foreground">{key} : {value}</Badge>)}</div>}{canManageBilling && <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Offre</Label><Select value={draft.planId} onValueChange={value => setDraft(current => ({ ...current, planId: value }))}><SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucune offre</SelectItem>{plans.data?.filter(plan => plan.active || String(plan.id) === draft.planId).map(plan => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Statut</Label><Select value={draft.status} onValueChange={value => setDraft(current => ({ ...current, status: value as typeof current.status }))}><SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manuelle</SelectItem><SelectItem value="trial">Essai</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="past_due">Impayé</SelectItem><SelectItem value="suspended">Suspendue</SelectItem><SelectItem value="cancelled">Annulée</SelectItem></SelectContent></Select></div><div><Label>Fin de l’essai</Label><Input className="mt-1 bg-background" type="date" value={draft.trialEndsAt} onChange={event => setDraft(current => ({ ...current, trialEndsAt: event.target.value }))} /></div><div><Label>Fin de période</Label><Input className="mt-1 bg-background" type="date" value={draft.currentPeriodEndsAt} onChange={event => setDraft(current => ({ ...current, currentPeriodEndsAt: event.target.value }))} /></div><div><Label>Fin du délai de grâce</Label><Input className="mt-1 bg-background" type="date" value={draft.graceEndsAt} onChange={event => setDraft(current => ({ ...current, graceEndsAt: event.target.value }))} /></div><div className="flex items-end"><Button className="w-full" disabled={setSubscription.isPending || !company} onClick={() => company && setSubscription.mutate({ companyId: company.id, planId: draft.planId === "none" ? null : Number(draft.planId), status: draft.status, trialEndsAt: toDateValue(draft.trialEndsAt), currentPeriodEndsAt: toDateValue(draft.currentPeriodEndsAt), graceEndsAt: toDateValue(draft.graceEndsAt) })}>{setSubscription.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button></div></div>}</div><div className="grid gap-4 lg:grid-cols-2"><EventList title="Cycle de vie" empty="Aucun événement de cycle de vie." items={detail.data.lifecycle.map(event => ({ id: event.id, title: event.action === "suspended" ? "Entreprise suspendue" : "Entreprise activée", detail: event.reason, date: event.createdAt }))} /><EventList title="Audit plateforme" empty="Aucune action administrative." items={detail.data.audits.map(event => ({ id: event.id, title: event.action, detail: event.reason ? `${event.actorName || "Opérateur plateforme"} · ${event.reason}` : event.actorName || "Opérateur plateforme", date: event.createdAt }))} /></div></div> : <p className="py-10 text-center text-sm text-muted-foreground">Fiche entreprise indisponible.</p>}<DialogFooter><Button onClick={onClose}>Fermer</Button></DialogFooter></DialogContent></Dialog>;
}

function SubscriptionPlanCatalog({ allowed }: { allowed: boolean }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [trialDays, setTrialDays] = useState("0");
  const plans = trpc.platform.subscriptions.plans.list.useQuery(undefined, { enabled: allowed });
  const save = trpc.platform.subscriptions.plans.save.useMutation({
    onSuccess: async () => { await Promise.all([utils.platform.subscriptions.plans.list.invalidate(), utils.platform.companies.detail.invalidate()]); setName(""); setCode(""); setTrialDays("0"); toast.success("Offre SaaS enregistrée."); },
    onError: error => toast.error(error.message),
  });
  if (!allowed) return null;
  return <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"><Card><CardHeader><CardTitle className="text-base">Créer une offre SaaS</CardTitle><p className="mt-1 text-sm text-muted-foreground">Le catalogue est prêt pour l’exploitation manuelle ; aucun paiement n’est déclenché.</p></CardHeader><CardContent className="space-y-3"><div><Label htmlFor="subscription-plan-name">Nom</Label><Input id="subscription-plan-name" className="mt-1" value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder="Ex. Professionnel" /></div><div><Label htmlFor="subscription-plan-code">Code interne</Label><Input id="subscription-plan-code" className="mt-1" value={code} onChange={event => setCode(event.target.value.toLowerCase())} maxLength={48} placeholder="professionnel" /></div><div><Label htmlFor="subscription-trial-days">Jours d’essai</Label><Input id="subscription-trial-days" className="mt-1" type="number" min="0" max="365" value={trialDays} onChange={event => setTrialDays(event.target.value)} /></div><Button className="w-full" disabled={save.isPending || name.trim().length < 2 || !/^[a-z0-9][a-z0-9_-]{1,46}$/.test(code)} onClick={() => save.mutate({ name, code, trialDays: Math.max(0, Math.min(365, Number(trialDays) || 0)), limits: {} })}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Créer l’offre</Button></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Catalogue des offres</CardTitle></CardHeader><CardContent className="space-y-3">{plans.isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : plans.data?.length ? plans.data.map(plan => <div key={plan.id} className="rounded-xl border border-border bg-muted/40 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{plan.name}</p><p className="text-xs text-muted-foreground">{plan.code} · Essai {plan.trialDays} jour{plan.trialDays > 1 ? "s" : ""}</p></div><Badge variant="outline" className={plan.active ? "border-emerald-600/35 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200" : "border-border bg-background text-muted-foreground"}>{plan.active ? "Active" : "Inactive"}</Badge></div></div>) : <p className="py-10 text-center text-sm text-muted-foreground">Aucune offre n’est encore créée.</p>}</CardContent></Card></section>;
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

function toDateInput(value: Date | string | null | undefined) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
function toDateValue(value: string) { return value ? new Date(`${value}T12:00:00`) : null; }
function subscriptionStatusLabel(status: "trial" | "active" | "past_due" | "suspended" | "cancelled" | "manual") { return { trial: "Essai", active: "Active", past_due: "Impayé", suspended: "Suspendue", cancelled: "Annulée", manual: "Manuelle" }[status]; }
function EventList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: number; title: string; detail: string | null; date: Date | string | null }> }) { return <div className="rounded-xl border border-border bg-muted/40 p-3"><p className="font-medium">{title}</p><div className="mt-3 space-y-2">{items.length ? items.map(item => <div key={item.id} className="rounded-lg border border-border bg-background p-2.5"><p className="text-sm font-medium">{item.title}</p>{item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}<p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.date)}</p></div>) : <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>}</div></div>; }

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
