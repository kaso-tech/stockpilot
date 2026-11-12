import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  companies,
  products,
  sales,
  users,
} from "../../drizzle/schema";
import { exportCompanyData, purgeCompany } from "../backups";

import { getDb } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME } from "@shared/const";
import { PLAN_DETAILS, PLANS, subscriptionState } from "@shared/plans";
import { loadCompany, usageOf } from "../subscription";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";

async function dbOrThrow() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Base de données indisponible.",
    });
  return db;
}

/** Adresses des super-administrateurs de la plateforme (variable PLATFORM_ADMIN_EMAILS). */
export function isPlatformAdmin(
  user:
    | { email: string | null; emailVerifiedAt?: Date | null }
    | null
    | undefined
) {
  if (!user?.email) return false;
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(user.email.trim().toLowerCase());
}

const platformProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!isPlatformAdmin(ctx.user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé à l’équipe StockPilot.",
    });
  return next();
});

/** Abonnement, export RGPD et suppression de l'entreprise (9.8). */
export const companyRouter = router({
  subscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const company = await loadCompany(db, ctx.user.companyId);
    if (!company)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Entreprise introuvable.",
      });
    return {
      name: company.name,
      plan: company.plan,
      planLabel: PLAN_DETAILS[company.plan].label,
      limits: PLAN_DETAILS[company.plan].limits,
      usage: await usageOf(db, ctx.user.companyId),
      trialEndsAt: company.trialEndsAt,
      planRenewsAt: company.planRenewsAt,
      status: company.status,
      ...subscriptionState(company),
      isPlatformAdmin: isPlatformAdmin(ctx.user),
    };
  }),
  exportData: permissionProcedure("settings.manage").mutation(
    async ({ ctx }) => {
      const data = await exportCompanyData(ctx.user.companyId!);
      const db = await dbOrThrow();
      await db.insert(auditLogs).values({
        companyId: ctx.user.companyId,
        actorUserId: ctx.user.id,
        action: "Export des données",
        entityType: "Entreprise",
        entityId: String(ctx.user.companyId),
        detail: "Export complet (portabilité)",
      });
      return {
        filename: `stockpilot-donnees-${ctx.user.companyId}-${data.exportedAt.slice(0, 10)}.json`,
        content: JSON.stringify(data, null, 2),
      };
    }
  ),
  /** Suppression définitive : le nom exact de l'entreprise doit être saisi. */
  delete: permissionProcedure("settings.manage")
    .input(z.object({ confirmationName: z.string().trim().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const company = await loadCompany(db, ctx.user.companyId);
      if (!company)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entreprise introuvable.",
        });
      if (input.confirmationName !== company.name)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Le nom saisi ne correspond pas au nom de l’entreprise.",
        });
      await purgeCompany(company.id);
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      console.info(
        JSON.stringify({
          level: "info",
          event: "company_deleted",
          companyId: company.id,
        })
      );
      return { success: true } as const;
    }),
});

export const platformRouter = router({
  companies: platformProcedure.query(async () => {
    const db = await dbOrThrow();
    const rows = await db
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt))
      .limit(500);
    if (!rows.length) return [];
    const ids = rows.map(row => row.id);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const count = async (table: any, extra?: any) =>
      new Map<number, number>(
        (
          await db
            .select({
              companyId: table.companyId,
              total: sql<number>`count(*)`,
            })
            .from(table)
            .where(
              extra
                ? and(inArray(table.companyId, ids), extra)
                : inArray(table.companyId, ids)
            )
            .groupBy(table.companyId)
        ).map((row: { companyId: number; total: number }) => [
          row.companyId,
          Number(row.total),
        ])
      );
    const [userCounts, productCounts, saleCounts] = await Promise.all([
      count(users, eq(users.active, true)),
      count(products),
      count(sales, gte(sales.createdAt, since)),
    ]);
    const owners = await db
      .select({ companyId: users.companyId, email: users.email })
      .from(users)
      .where(and(inArray(users.companyId, ids), eq(users.role, "admin")));
    return rows.map(row => ({
      ...row,
      ...subscriptionState(row),
      ownerEmail:
        owners.find(owner => owner.companyId === row.id)?.email ?? null,
      users: userCounts.get(row.id) ?? 0,
      products: productCounts.get(row.id) ?? 0,
      salesLast30Days: saleCounts.get(row.id) ?? 0,
    }));
  }),
  updateCompany: platformProcedure
    .input(
      z.object({
        companyId: z.number().int().positive(),
        plan: z.enum(PLANS),
        trialEndsAt: z.coerce.date().nullable().optional(),
        planRenewsAt: z.coerce.date().nullable().optional(),
        status: z.enum(["active", "suspended"]),
        suspendedReason: z.string().trim().max(300).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const company = await loadCompany(db, input.companyId);
      if (!company)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entreprise introuvable.",
        });
      await db
        .update(companies)
        .set({
          plan: input.plan,
          trialEndsAt:
            input.trialEndsAt === undefined
              ? company.trialEndsAt
              : input.trialEndsAt,
          planRenewsAt:
            input.planRenewsAt === undefined
              ? company.planRenewsAt
              : input.planRenewsAt,
          status: input.status,
          suspendedReason:
            input.status === "suspended"
              ? (input.suspendedReason ?? null)
              : null,
        })
        .where(eq(companies.id, input.companyId));
      await db.insert(auditLogs).values({
        companyId: input.companyId,
        actorUserId: ctx.user.id,
        action: "Abonnement modifié",
        entityType: "Entreprise",
        entityId: String(input.companyId),
        detail: `Plan ${PLAN_DETAILS[input.plan].label}, statut ${input.status === "active" ? "actif" : "suspendu"} (par l’équipe StockPilot)`,
      });
      return { success: true } as const;
    }),
});
