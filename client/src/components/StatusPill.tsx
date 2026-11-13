import type { ReactNode } from "react";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-success-soft text-success", dot: "bg-success" },
  warning: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  danger: {
    pill: "bg-destructive-soft text-destructive",
    dot: "bg-destructive",
  },
  info: { pill: "bg-info-soft text-info", dot: "bg-info" },
  neutral: { pill: "bg-muted text-muted-foreground", dot: "bg-faint" },
};

/** Pastille de statut : point coloré + libellé, sur fond doux. */
export function StatusPill({
  tone,
  children,
  className = "",
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${tones[tone].pill} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tones[tone].dot}`} />
      {children}
    </span>
  );
}
