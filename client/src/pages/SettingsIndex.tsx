import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, ChevronRight, CircleDollarSign, DatabaseBackup, History, KeyRound, LayoutDashboard, Palette, Printer, Search, Settings2, ShieldCheck, Tags, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export type SettingsLink = { href: string; label: string; icon: LucideIcon; keywords?: string };
export type SettingsSection = { id: string; label: string; keywords?: string; links: SettingsLink[] };

export const settingsSections: SettingsSection[] = [
  {
    id: "company",
    label: "Entreprise",
    keywords: "organisation identité coordonnées logo signature cachet documents a4",
    links: [{ href: "/parametres/identite", icon: Building2, label: "Profil de l’entreprise", keywords: "raison sociale adresse téléphone email logo signature cachet documents a4" }],
  },
  {
    id: "sales",
    label: "Vente rapide",
    keywords: "caisse pos comptoir vente",
    links: [
      { href: "/parametres/pos/rattachement", icon: UsersRound, label: "Rattachement des ventes", keywords: "agent caissier commission affectation" },
      { href: "/parametres/pos/paiements", icon: Settings2, label: "Moyens de paiement", keywords: "paiement encaissement espèces mobile money carte virement crédit" },
      { href: "/parametres/pos/actions-vendeurs", icon: ShieldCheck, label: "Autorisations des vendeurs", keywords: "vendeur sécurité permission prix remise annulation remboursement stock" },
    ],
  },
  {
    id: "printing",
    label: "Impression",
    keywords: "imprimante thermique tickets reçu format 58 80 mm",
    links: [{ href: "/parametres/impression", icon: Printer, label: "Tickets et imprimante", keywords: "impression imprimante thermique ticket caisse reçu largeur en-tête pied" }],
  },
  {
    id: "financial",
    label: "Monnaie et fiscalité",
    keywords: "devise monnaie fcfa usd eur tva taxe",
    links: [
      { href: "/parametres/devise", icon: CircleDollarSign, label: "Devise et affichage des prix", keywords: "monnaie prix fcfa usd eur séparateur arrondi" },
      { href: "/parametres/fiscalite", icon: Tags, label: "TVA et taxes", keywords: "taxe tva fiscalité taux" },
    ],
  },
  {
    id: "experience",
    label: "Expérience de travail",
    keywords: "apparence thème couleur tableau de bord",
    links: [
      { href: "/parametres/apparence", icon: Palette, label: "Apparence", keywords: "thème couleur interface contraste" },
      { href: "/parametres/tableau-de-bord", icon: LayoutDashboard, label: "Tableau de bord", keywords: "dashboard indicateur widget accueil" },
    ],
  },
  {
    id: "security",
    label: "Sécurité et traçabilité",
    keywords: "sécurité accès session historique audit",
    links: [
      { href: "/parametres/securite", icon: KeyRound, label: "Sécurité du compte", keywords: "sécurité session mot de passe compte" },
      { href: "/parametres/historique", icon: History, label: "Historique des paramètres", keywords: "audit journal historique traçabilité modification" },
    ],
  },
  {
    id: "continuity",
    label: "Données et continuité",
    keywords: "sauvegarde archive restauration export",
    links: [{ href: "/sauvegardes", icon: DatabaseBackup, label: "Sauvegardes", keywords: "backup archive restauration export google drive" }],
  },
];

export function filterSettingsSections(query: string, sections = settingsSections) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return sections;
  return sections.map(section => {
    const sectionMatches = `${section.label} ${section.keywords ?? ""}`.toLocaleLowerCase().includes(normalized);
    const links = sectionMatches ? section.links : section.links.filter(link => `${link.label} ${link.keywords ?? ""}`.toLocaleLowerCase().includes(normalized));
    return { ...section, links };
  }).filter(section => section.links.length > 0);
}

export default function SettingsIndex() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(() => filterSettingsSections(query), [query]);

  if (user?.role !== "admin") return <Restricted title="Paramètres" description="La personnalisation de l’organisation est réservée aux administrateurs." />;

  return <div className="mx-auto max-w-5xl space-y-4">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Organisation</p><h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">Paramètres</h1></header>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un paramètre…" aria-label="Rechercher un paramètre" className="pl-9" /></div>
    {filteredSections.length ? <div className="space-y-4">{filteredSections.map(section => <section key={section.id} aria-labelledby={`settings-section-${section.id}`}><h2 id={`settings-section-${section.id}`} className="mb-1 px-1 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{section.label}</h2><Card><CardContent className="divide-y divide-border p-1.5">{section.links.map(item => <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><item.icon className="h-4.5 w-4.5" /></span><span className="min-w-0 flex-1 font-medium text-card-foreground">{item.label}</span><ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" /></Link>)}</CardContent></Card></section>)}</div> : <Card><CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">Aucun paramètre ne correspond à « {query} ».</CardContent></Card>}
  </div>;
}
