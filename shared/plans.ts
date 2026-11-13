/** Offres d'abonnement (9.8). Les limites sont vérifiées par le serveur. */
export const PLANS = ["trial", "starter", "pro"] as const;
export type Plan = (typeof PLANS)[number];
export type PlanResource = "users" | "products" | "warehouses";

export const PLAN_DETAILS: Record<
  Plan,
  {
    label: string;
    limits: Record<PlanResource, number | null>;
    description: string;
  }
> = {
  trial: {
    label: "Essai (14 jours)",
    limits: { users: 3, products: 100, warehouses: 1 },
    description: "Toutes les fonctions, volumes réduits, pendant 14 jours.",
  },
  starter: {
    label: "Starter",
    limits: { users: 3, products: 1000, warehouses: 1 },
    description: "Un point de vente, une petite équipe.",
  },
  pro: {
    label: "Pro",
    limits: { users: 25, products: null, warehouses: 10 },
    description: "Plusieurs dépôts, équipe étendue, produits illimités.",
  },
};

export const TRIAL_DAYS = 14;

export const RESOURCE_LABELS: Record<PlanResource, string> = {
  users: "utilisateurs",
  products: "produits",
  warehouses: "dépôts",
};

/** Un essai sans date de fin (entreprises antérieures aux abonnements) n'expire pas. */
export function subscriptionState(
  company: {
    plan: Plan;
    trialEndsAt: Date | null;
    status: "active" | "suspended";
  },
  now = new Date()
) {
  if (company.status === "suspended")
    return { writable: false, reason: "suspended" as const };
  if (
    company.plan === "trial" &&
    company.trialEndsAt &&
    company.trialEndsAt.getTime() < now.getTime()
  )
    return { writable: false, reason: "trial_expired" as const };
  return { writable: true, reason: null };
}
