import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, ChevronRight, CircleDollarSign, DatabaseBackup, History, KeyRound, LayoutDashboard, Palette, ReceiptText, Search, Settings2, ShieldCheck, Tags, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Restricted } from "./AuditLog";

export type SettingsLink = { href: string; label: string; detail: string; icon: LucideIcon; keywords?: string };
export type SettingsSection = { id: string; label: string; detail?: string; links: SettingsLink[] };

export const settingsSections: SettingsSection[] = [
  {
    id: "sales",
    label: "Vente et caisse",
    links: [
      { href: "/parametres/pos/rattachement", icon: UsersRound, label: "Rattachement des ventes", detail: "Caissier et agent commercial associés aux ventes", keywords: "agent caissier commission affectation" },
      { href: "/parametres/pos/tickets", icon: ReceiptText, label: "Tickets de caisse", detail: "Largeur, en-tête et pied de ticket", keywords: "ticket impression caisse reçu" },
      { href: "/parametres/pos/paiements", icon: Settings2, label: "Moyens de paiement", detail: "Espèces, mobile money, carte, virement et crédit", keywords: "paiement encaissement cash carte" },
      { href: "/parametres/pos/actions-vendeurs", icon: ShieldCheck, label: "Actions sensibles des vendeurs", detail: "Prix, remises, annulation, remboursement et stock", keywords: "vendeur sécurité permission remise remboursement" },
    ],
  },
  {
    id: "identity",
    label: "Identité et documents",
    detail: "Présentez votre entreprise avec les informations utilisées sur les documents.",
    links: [{ href: "/parametres/identite", icon: Building2, label: "Identité de l’entreprise", detail: "Raison sociale, coordonnées, logo et signature", keywords: "entreprise société logo signature facture" }],
  },
  {
    id: "printing",
    label: "Impression et périphériques",
    links: [{ href: "/parametres/impression", icon: ReceiptText, label: "Impression et imprimante", detail: "Tickets, format et imprimante par défaut", keywords: "impression imprimante ticket thermique caisse" }],
  },
  {
    id: "appearance",
    label: "Affichage et devise",
    links: [
      { href: "/parametres/apparence", icon: Palette, label: "Apparence", detail: "Thème et confort visuel de l’application", keywords: "thème couleur interface" },
      { href: "/parametres/devise", icon: CircleDollarSign, label: "Devise", detail: "Devise utilisée pour les montants et documents", keywords: "monnaie prix FCFA USD EUR" },
    ],
  },
  {
    id: "fiscal",
    label: "Fiscalité",
    links: [{ href: "/parametres/fiscalite", icon: Tags, label: "TVA et taxes", detail: "Activation et taux de TVA de l’entreprise", keywords: "taxe tva fiscalité taux" }],
  },
  {
    id: "management",
    label: "Pilotage",
    links: [{ href: "/parametres/tableau-de-bord", icon: LayoutDashboard, label: "Tableau de bord", detail: "Éléments visibles dans le cockpit", keywords: "dashboard indicateur widget accueil" }],
  },
  {
    id: "security",
    label: "Sécurité et traçabilité",
    links: [
      { href: "/parametres/securite", icon: KeyRound, label: "Sécurité du compte", detail: "Sessions actives et mot de passe administrateur", keywords: "sécurité session mot de passe compte" },
      { href: "/parametres/historique", icon: History, label: "Historique des paramètres", detail: "Modifications et responsable de chaque changement", keywords: "audit journal historique traçabilité" },
    ],
  },
  {
    id: "continuity",
    label: "Données et continuité",
    links: [{ href: "/sauvegardes", icon: DatabaseBackup, label: "Sauvegardes", detail: "Archives locales, restauration et Google Drive", keywords: "backup archive restauration export" }],
  },
];

export function filterSettingsSections(query: string, sections = settingsSections) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return sections;
  return sections.map(section => {
    const sectionMatches = `${section.label} ${section.detail}`.toLocaleLowerCase().includes(normalized);
    const links = sectionMatches ? section.links : section.links.filter(link => `${link.label} ${link.detail} ${link.keywords ?? ""}`.toLocaleLowerCase().includes(normalized));
    return { ...section, links };
  }).filter(section => section.links.length > 0);
}

export default function SettingsIndex() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const filteredSections = useMemo(() => filterSettingsSections(query), [query]);
  if (user?.role !== "admin") return <Restricted title="Paramètres" description="La personnalisation de l’organisation est réservée aux administrateurs." />;
  return <div className="mx-auto max-w-5xl space-y-4">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#007B8B]">Organisation</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Paramètres</h1></header>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un paramètre…" aria-label="Rechercher un paramètre" className="border-white/[0.12] bg-[#111722] pl-9 text-white placeholder:text-slate-500" /></div>
    {filteredSections.length ? <div className="space-y-4">{filteredSections.map(section => <section key={section.id} aria-labelledby={`settings-section-${section.id}`}><div className="mb-1 px-1"><h2 id={`settings-section-${section.id}`} className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">{section.label}</h2></div><Card className="border-white/[0.07] bg-[#111722]"><CardContent className="divide-y divide-white/[0.06] p-2">{section.links.map(item => <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#007B8B]/10 text-[#00bcd4]"><item.icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-100">{item.label}</span><span className="mt-1 block text-sm text-slate-500">{item.detail}</span></span><ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-[#00bcd4]" /></Link>)}</CardContent></Card></section>)}</div> : <Card className="border-white/[0.07] bg-[#111722]"><CardContent className="px-4 py-12 text-center text-sm text-slate-400">Aucun paramètre ne correspond à « {query} ».</CardContent></Card>}
  </div>;
}
