import { useAuth } from "@/_core/hooks/useAuth";
import { matchesSearch } from "@/lib/search";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, ChevronRight, CircleDollarSign, DatabaseBackup, History, KeyRound, LayoutDashboard, Palette, Printer, Search, Settings2, ShieldCheck, Tags, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export type SettingsLink = { href: string; label: string; icon: LucideIcon; keywords: string };
export type SettingsSection = { id: string; label: string; links: SettingsLink[] };

export const settingsSections: SettingsSection[] = [
  { id: "company", label: "Entreprise", links: [{ href: "/parametres/identite", icon: Building2, label: "Informations de l’entreprise", keywords: "entreprise société coordonnées logo identité" }] },
  { id: "sales", label: "Vente et caisse", links: [
    { href: "/parametres/pos/rattachement", icon: UsersRound, label: "Rattachement des ventes", keywords: "agent caissier commission affectation" },
    { href: "/parametres/pos/paiements", icon: Settings2, label: "Moyens de paiement", keywords: "paiement encaissement cash carte mobile money" },
    { href: "/parametres/pos/actions-vendeurs", icon: ShieldCheck, label: "Autorisations des vendeurs", keywords: "vendeur sécurité permission remise remboursement prix" },
  ] },
  { id: "printing", label: "Impression", links: [{ href: "/parametres/impression", icon: Printer, label: "Documents, tickets et imprimante", keywords: "impression imprimante thermique ticket caisse reçu facture a4 signature" }] },
  { id: "fiscal", label: "Fiscalité", links: [{ href: "/parametres/fiscalite", icon: Tags, label: "TVA, taxes et livraison", keywords: "taxe tva fiscalité taux livraison" }] },
  { id: "appearance", label: "Expérience de travail", links: [
    { href: "/parametres/apparence", icon: Palette, label: "Apparence", keywords: "thème couleur interface" },
    { href: "/parametres/devise", icon: CircleDollarSign, label: "Devise et affichage des prix", keywords: "monnaie prix FCFA USD EUR arrondi" },
    { href: "/parametres/tableau-de-bord", icon: LayoutDashboard, label: "Tableau de bord", keywords: "dashboard indicateur widget accueil" },
  ] },
  { id: "security", label: "Sécurité et traçabilité", links: [
    { href: "/parametres/utilisateurs", icon: UsersRound, label: "Utilisateurs et rôles", keywords: "équipe rôles droits permissions accès" },
    { href: "/parametres/securite", icon: KeyRound, label: "Sécurité du compte", keywords: "sécurité session mot de passe compte" },
    { href: "/parametres/historique", icon: History, label: "Historique des paramètres", keywords: "audit journal historique traçabilité" },
  ] },
  { id: "continuity", label: "Données et continuité", links: [{ href: "/sauvegardes", icon: DatabaseBackup, label: "Sauvegardes", keywords: "backup archive restauration export" }] },
];

export function filterSettingsSections(query: string, sections = settingsSections) {
  if (!query.trim()) return sections;
  return sections.map(section => ({ ...section, links: section.links.filter(link => matchesSearch(query, section.label, link.label, link.keywords)) })).filter(section => section.links.length > 0);
}

export default function SettingsIndex() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(() => filterSettingsSections(query), [query]);
  if (user?.role !== "admin") return <Restricted title="Paramètres" description="La personnalisation de l’organisation est réservée aux administrateurs." />;
  return <div className="mx-auto max-w-5xl space-y-5">
    <header><h1 className="text-[22px] font-bold tracking-tight text-foreground">Paramètres</h1></header>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-faint" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un paramètre…" aria-label="Rechercher un paramètre" className="border-border bg-card pl-9 text-foreground placeholder:text-faint" /></div>
    {filteredSections.length ? <div className="space-y-4">{filteredSections.map(section => <section key={section.id} aria-labelledby={`settings-section-${section.id}`}><h2 id={`settings-section-${section.id}`} className="mb-1 px-1 text-sm font-semibold text-muted-foreground">{section.label}</h2><Card className="border-border bg-card gap-0 py-0"><CardContent className="divide-y divide-border p-1.5">{section.links.map(item => <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-xl px-3.5 py-3 transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon className="h-4 w-4" /></span><span className="min-w-0 flex-1 font-semibold text-foreground">{item.label}</span><ChevronRight className="h-5 w-5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-primary" /></Link>)}</CardContent></Card></section>)}</div> : <Card className="border-border bg-card"><CardContent className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun paramètre ne correspond à « {query} ».</CardContent></Card>}
  </div>;
}
