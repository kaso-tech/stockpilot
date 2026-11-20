import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";

const plans = [
  {
    name: "Pilote accompagné",
    description: "Pour lancer StockPilot dans une première entreprise avec accompagnement au paramétrage.",
    price: "Sur devis",
    detail: "Déploiement contrôlé",
    features: ["Une entreprise", "Produits, ventes et factures", "Un entrepôt principal", "Accompagnement de démarrage", "Support prioritaire pendant le pilote"],
  },
  {
    name: "Pro opérationnel",
    description: "Pour les équipes qui pilotent les ventes, stocks et utilisateurs au quotidien.",
    price: "Sur devis",
    detail: "Forfait mensuel adapté",
    featured: true,
    features: ["Multi-entrepôts et transferts", "Vendeurs, caissiers et responsables", "Inventaires, alertes et réapprovisionnement", "Factures, devis, tickets et exports CSV", "Support applicatif"],
  },
  {
    name: "Entreprise",
    description: "Pour les organisations multi-sites qui souhaitent un accompagnement et une gouvernance renforcés.",
    price: "Sur mesure",
    detail: "Selon utilisateurs et dépôts",
    features: ["Tous les modules Pro", "Pilotage consolidé multi-entrepôts", "Rôles, commissions et rapports avancés", "Assistance de déploiement", "Revue des besoins d’intégration"],
  },
];

export default function Pricing() {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary/80"><ChevronLeft className="h-4 w-4" />Retour à StockPilot</Link>
          <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Déploiement professionnel</Badge>
        </header>
        <section className="mx-auto max-w-3xl py-16 text-center sm:py-24">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-6 w-6" /></div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Des forfaits adaptés à votre exploitation</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Choisissez un accompagnement selon le nombre de dépôts, d’utilisateurs et le niveau de pilotage souhaité. Les tarifs sont établis après qualification pour correspondre à vos besoins opérationnels.</p>
        </section>
        <section className="grid gap-5 lg:grid-cols-3">
          {plans.map(plan => <article key={plan.name} className={`relative flex flex-col rounded-xl border p-6 ${plan.featured ? "border-primary/60 bg-primary/[0.07] shadow-2xl shadow-primary/20" : "border-border bg-card"}`}>
            {plan.featured && <Badge className="absolute -top-3 left-6 border-0 bg-primary text-primary-foreground hover:bg-primary">Le plus complet</Badge>}
            <h2 className="text-xl font-semibold text-foreground">{plan.name}</h2>
            <p className="mt-3 min-h-14 text-sm leading-6 text-muted-foreground">{plan.description}</p>
            <div className="mt-7 border-y border-border py-5"><p className="text-2xl font-semibold text-foreground">{plan.price}</p><p className="mt-1 text-xs text-faint">{plan.detail}</p></div>
            <ul className="mt-6 flex-1 space-y-3">{plan.features.map(feature => <li key={feature} className="flex gap-3 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul>
            <Link href="/contactez-nous" className="mt-8 block"><Button className={`w-full ${plan.featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-foreground hover:bg-accent"}`}>Demander une proposition</Button></Link>
          </article>)}
        </section>
        <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-5 text-faint">La page présente les niveaux de service et ne constitue pas encore un paiement en ligne. Une proposition contractuelle précise les tarifs, la durée, les données traitées et l’accompagnement inclus.</p>
      </div>
    </main>
  );
}
