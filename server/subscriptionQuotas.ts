import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { companies, companySubscriptions, products, subscriptionPlans, users, warehouses } from "../drizzle/schema";
import { companyScope } from "./companyScope";

export const quotaResources = ["users", "products", "warehouses"] as const;
export type QuotaResource = (typeof quotaResources)[number];
export type SubscriptionLimits = Partial<Record<QuotaResource, number>>;

const resourceTables = {
  users: { table: users, activeColumn: users.active },
  products: { table: products },
  warehouses: { table: warehouses, activeColumn: warehouses.active },
} as const;

/** Invalid/unknown stored limits fail open; only an explicit non-negative integer caps usage. */
export function parseSubscriptionLimits(value: unknown): SubscriptionLimits {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return {}; }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const limits: SubscriptionLimits = {};
  for (const resource of quotaResources) {
    const candidate = (parsed as Record<string, unknown>)[resource];
    if (typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0 && candidate <= 1_000_000) {
      limits[resource] = candidate;
    }
  }
  return limits;
}

export function quotaIsExceeded(usage: number, adding: number, limit: number | undefined) {
  return limit !== undefined && usage + adding > limit;
}

async function companyPlanLimits(db: any, companyId: number) {
  const subscription = (await db.select({ planId: companySubscriptions.planId })
    .from(companySubscriptions)
    .where(eq(companySubscriptions.companyId, companyId))
    .limit(1))[0];
  if (!subscription?.planId) return {} as SubscriptionLimits;
  const plan = (await db.select({ limitsJson: subscriptionPlans.limitsJson })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, subscription.planId))
    .limit(1))[0];
  return parseSubscriptionLimits(plan?.limitsJson);
}

async function countResource(db: any, companyId: number, resource: QuotaResource) {
  const spec = resourceTables[resource];
  const predicates = [companyScope(spec.table.companyId, companyId)];
  if ("activeColumn" in spec) predicates.push(eq(spec.activeColumn, true));
  const rows = await db.select({ total: sql<number>`count(*)` }).from(spec.table).where(and(...predicates));
  return Number(rows[0]?.total ?? 0);
}

export async function getCompanyQuotaState(db: any, companyId: number) {
  const limits = await companyPlanLimits(db, companyId);
  const usage = {
    users: await countResource(db, companyId, "users"),
    products: await countResource(db, companyId, "products"),
    warehouses: await countResource(db, companyId, "warehouses"),
  } satisfies Record<QuotaResource, number>;
  return { limits, usage };
}

/** Enforces only configured limits. A missing plan or missing resource limit remains unrestricted. */
export async function assertSubscriptionQuota(db: any, companyId: number | null, resource: QuotaResource, adding = 1) {
  if (companyId === null) return;
  if (!Number.isInteger(adding) || adding < 1 || adding > 1_000_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "La quantité demandée pour cette offre est invalide." });
  }
  // La création reste dans la transaction appelante : sérialiser les compteurs par entreprise.
  await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId)).limit(1).for("update");
  const limits = await companyPlanLimits(db, companyId);
  const limit = limits[resource];
  if (limit === undefined) return;
  const usage = await countResource(db, companyId, resource);
  if (quotaIsExceeded(usage, adding, limit)) {
    const labels: Record<QuotaResource, string> = { users: "utilisateurs actifs", products: "produits", warehouses: "entrepôts actifs" };
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `La limite configurée de votre offre est atteinte : ${limit} ${labels[resource]}. Désactivez une ressource ou contactez StockPilot pour adapter l’offre.`,
    });
  }
}
