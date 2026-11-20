// Briques de mise en page communes, reprises de la vue d'ensemble :
// en-tête de page, panneaux, cartes d'indicateurs, état vide et classes de tableau.
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

/** Titre de page (22 px), description courte et actions alignées à droite. */
export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "Retour",
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Pastilles affichées à côté du titre (statut, type…). */
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 truncate text-[22px] font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`surface overflow-hidden rounded-xl border border-border bg-card ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  detail,
  action,
}: {
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-[18px] pb-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {detail && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{detail}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export type StatTone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

const statToneText: Record<StatTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
};

/** Carte d'indicateur : libellé, valeur en grand, note facultative. */
export function StatCard({
  label,
  value,
  note,
  tone = "default",
  noteTone,
  compact = false,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  /** Couleur de la valeur. */
  tone?: StatTone;
  /** Couleur de la note (par défaut : discrète). */
  noteTone?: StatTone;
  compact?: boolean;
}) {
  return (
    <div
      className={`surface flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card ${compact ? "px-4 py-3" : "px-4 py-3.5 sm:px-5 sm:py-[18px]"}`}
    >
      <p className="truncate text-xs font-medium text-muted-foreground sm:text-[13px]">
        {label}
      </p>
      <p
        className={`truncate font-bold leading-tight tracking-tight ${compact ? "text-lg" : "text-lg sm:text-[22px]"} ${statToneText[tone]}`}
      >
        {value}
      </p>
      {note && (
        <p
          className={`text-xs font-medium sm:text-[13px] ${noteTone ? statToneText[noteTone] : "text-muted-foreground"}`}
        >
          {note}
        </p>
      )}
    </div>
  );
}

/** Grille d'indicateurs : 2 colonnes sur téléphone, 4 au-delà. */
export function StatGrid({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const large =
    columns === 2
      ? "lg:grid-cols-2"
      : columns === 3
        ? "lg:grid-cols-3"
        : "lg:grid-cols-4";
  return (
    <section className={`stagger grid grid-cols-2 gap-3 sm:gap-4 ${large}`}>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon?: typeof ArrowLeft;
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-[180px] place-items-center px-6 py-8 text-center">
      <div>
        {Icon && (
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-faint">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
        {detail && (
          <p className="mt-1 text-[13px] text-muted-foreground">{detail}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

/** Classes communes des tableaux de données. */
export const table = {
  wrapper: "overflow-x-auto",
  table: "w-full border-collapse text-sm",
  head: "bg-muted text-left text-xs font-semibold text-muted-foreground",
  th: "px-5 py-2.5 font-semibold",
  row: "border-t border-border hover:bg-accent/60",
  td: "px-5 py-3",
};

/** Lignes grises qui scintillent, à la place d'un texte « Chargement… ». */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="divide-y divide-border"
      role="status"
      aria-label="Chargement"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-5 py-3.5">
          <span className="shimmer h-9 w-9 shrink-0 rounded-lg" />
          <span className="flex-1 space-y-2">
            <span className="shimmer block h-3 w-2/5 rounded" />
            <span className="shimmer block h-2.5 w-1/4 rounded" />
          </span>
          <span className="shimmer h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Silhouette d'une page pendant son téléchargement : titre, indicateurs, liste. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Chargement de la page">
      <div className="space-y-2">
        <span className="shimmer block h-6 w-48 rounded-md" />
        <span className="shimmer block h-3.5 w-72 max-w-full rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="shimmer block h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="surface overflow-hidden rounded-xl border border-border bg-card">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
