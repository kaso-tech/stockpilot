import { Button } from "@/components/ui/button";
import { ArrowLeft, Boxes } from "lucide-react";
import { Link } from "wouter";

type LegalSection = { title: string; content: string };

export default function LegalPage({
  title,
  updatedAt,
  sections,
}: {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link href="/">
          <Button
            variant="ghost"
            className="-ml-3 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à StockPilot
          </Button>
        </Link>
        <header className="mt-7 rounded-3xl border border-border bg-card p-7 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Boxes className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold">StockPilot Pro</p>
              <p className="text-xs text-muted-foreground">
                Informations légales
              </p>
            </div>
          </div>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Dernière mise à jour : {updatedAt}
          </p>
        </header>
        <div className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-7 sm:p-10">
          <p className="rounded-xl border border-warning/25 bg-warning-soft p-4 text-sm leading-6 text-warning">
            Ce document constitue une base d’information générale pour
            l’application. Faites-le relire et adapter par un professionnel du
            droit avant toute mise en service commerciale dans votre
            juridiction.
          </p>
          {sections.map(section => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-foreground">
                {section.title}
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
