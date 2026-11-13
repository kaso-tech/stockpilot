import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { companies, products, users, warehouses } from "../drizzle/schema";
import { companyScope } from "./companyScope";
import {
  PLAN_DETAILS,
  RESOURCE_LABELS,
  subscriptionState,
  type PlanResource,
} from "@shared/plans";

export async function loadCompany(db: any, companyId: number | null) {
  if (!companyId) return null;
  return ((
    await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)
  )[0] ?? null) as typeof companies.$inferSelect | null;
}

/** Les écritures sont bloquées si l'essai est terminé ou l'entreprise suspendue (lecture et export restent possibles). */
export async function assertCompanyWritable(db: any, companyId: number | null) {
  const company = await loadCompany(db, companyId);
  if (!company) return;
  const state = subscriptionState(company);
  if (!state.writable)
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        state.reason === "suspended"
          ? `Espace suspendu${company.suspendedReason ? ` : ${company.suspendedReason}` : ""}. Contactez le support.`
          : "La période d’essai est terminée : choisissez un abonnement pour continuer à enregistrer des opérations.",
    });
}

export async function usageOf(db: any, companyId: number | null) {
  const count = async (table: any, extra?: any) =>
    Number(
      (
        await db
          .select({ total: sql<number>`count(*)` })
          .from(table)
          .where(
            extra
              ? and(companyScope(table.companyId, companyId), extra)
              : companyScope(table.companyId, companyId)
          )
      )[0]?.total ?? 0
    );
  return {
    users: await count(users, eq(users.active, true)),
    products: await count(products),
    warehouses: await count(warehouses, eq(warehouses.active, true)),
  } satisfies Record<PlanResource, number>;
}

/** Refuse la création d'une ressource au-delà de la limite du plan. */
export async function assertPlanLimit(
  db: any,
  companyId: number | null,
  resource: PlanResource,
  adding = 1
) {
  const company = await loadCompany(db, companyId);
  if (!company) return;
  const limit = PLAN_DETAILS[company.plan].limits[resource];
  if (limit === null) return;
  const usage = await usageOf(db, companyId);
  if (usage[resource] + adding > limit)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Votre offre ${PLAN_DETAILS[company.plan].label} est limitée à ${limit} ${RESOURCE_LABELS[resource]}. Passez à une offre supérieure pour en ajouter.`,
    });
}
