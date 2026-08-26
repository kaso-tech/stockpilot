import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { companies, companyLifecycleEvents, platformAuditLogs, supportRequests, users } from "../../drizzle/schema";
import { authenticatedProcedure, router } from "../_core/trpc";
import { canManagePlatformCompanies, requirePlatformAccess } from "../platformAccess";

async function auditPlatform(db: { insert: (...args: any[]) => any }, actorUserId: number, action: string, companyId: number | null, reason?: string, metadata?: Record<string, unknown>) {
  await db.insert(platformAuditLogs).values({ actorUserId, action, entityType: "company", entityId: companyId, companyId, reason: reason ?? null, metadataJson: metadata ? JSON.stringify(metadata) : null });
}

export const platformRouter = router({
  access: authenticatedProcedure.query(async ({ ctx }) => {
    try {
      const { access } = await requirePlatformAccess(ctx);
      return { platformRole: access.platformRole };
    } catch (error) {
      if (error instanceof TRPCError && error.code === "FORBIDDEN") return { platformRole: null };
      throw error;
    }
  }),
  overview: authenticatedProcedure.query(async ({ ctx }) => {
    const { db } = await requirePlatformAccess(ctx);
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const [companyRows, supportRows, onboardingRows, newCompanyRows, activeCompanyRows, lifecycleRows] = await Promise.all([
      db.select({ status: companies.platformStatus, total: sql<number>`count(*)` }).from(companies).groupBy(companies.platformStatus),
      db.select({ status: supportRequests.status, total: sql<number>`count(*)` }).from(supportRequests).groupBy(supportRequests.status),
      db.select({ total: sql<number>`sum(case when ${companies.onboardingCompletedAt} is not null then 1 else 0 end)` }).from(companies),
      db.select({ totalLast7Days: sql<number>`sum(case when ${companies.createdAt} >= ${sevenDaysAgo} then 1 else 0 end)`, totalLast30Days: sql<number>`sum(case when ${companies.createdAt} >= ${thirtyDaysAgo} then 1 else 0 end)` }).from(companies),
      db.select({ total: sql<number>`count(distinct ${users.companyId})` }).from(users).where(and(eq(users.active, true), gte(users.lastSignedIn, sevenDaysAgo))),
      db.select({ action: companyLifecycleEvents.action, total: sql<number>`count(*)` }).from(companyLifecycleEvents).where(gte(companyLifecycleEvents.createdAt, thirtyDaysAgo)).groupBy(companyLifecycleEvents.action),
    ]);
    const totalCompanies = companyRows.reduce((sum, row) => sum + Number(row.total), 0);
    const supportOpen = Number(supportRows.find(row => row.status === "open")?.total ?? 0);
    const supportInProgress = Number(supportRows.find(row => row.status === "in_progress")?.total ?? 0);
    return {
      totalCompanies,
      activeCompanies: Number(companyRows.find(row => row.status === "active")?.total ?? 0),
      suspendedCompanies: Number(companyRows.find(row => row.status === "suspended")?.total ?? 0),
      onboardedCompanies: Number(onboardingRows[0]?.total ?? 0),
      newCompaniesLast7Days: Number(newCompanyRows[0]?.totalLast7Days ?? 0),
      newCompaniesLast30Days: Number(newCompanyRows[0]?.totalLast30Days ?? 0),
      activeCompaniesLast7Days: Number(activeCompanyRows[0]?.total ?? 0),
      openSupportRequests: supportOpen + supportInProgress,
      supportByStatus: {
        open: supportOpen,
        inProgress: supportInProgress,
        closed: Number(supportRows.find(row => row.status === "closed")?.total ?? 0),
      },
      lifecycleLast30Days: {
        activated: Number(lifecycleRows.find(row => row.action === "activated")?.total ?? 0),
        suspended: Number(lifecycleRows.find(row => row.action === "suspended")?.total ?? 0),
      },
    };
  }),
  companies: router({
    list: authenticatedProcedure.input(z.object({ search: z.string().trim().max(120).optional() }).optional()).query(async ({ ctx, input }) => {
      const { db } = await requirePlatformAccess(ctx);
      const rows = await db.select({ id: companies.id, name: companies.name, platformStatus: companies.platformStatus, suspendedAt: companies.suspendedAt, suspensionReason: companies.suspensionReason, onboardingCompletedAt: companies.onboardingCompletedAt, createdAt: companies.createdAt, ownerName: users.name, ownerEmail: users.email, lastSignedIn: users.lastSignedIn }).from(companies).leftJoin(users, eq(companies.ownerUserId, users.id)).orderBy(desc(companies.createdAt));
      const term = input?.search?.toLocaleLowerCase("fr") ?? "";
      return rows.filter(row => !term || row.name.toLocaleLowerCase("fr").includes(term) || row.ownerName?.toLocaleLowerCase("fr").includes(term) || row.ownerEmail?.toLocaleLowerCase("fr").includes(term));
    }),
    setStatus: authenticatedProcedure.input(z.object({ companyId: z.number().int().positive(), status: z.enum(["active", "suspended"]), reason: z.string().trim().min(3).max(400).optional() })).mutation(async ({ ctx, input }) => {
      const { db, access } = await requirePlatformAccess(ctx);
      if (!canManagePlatformCompanies(access.platformRole)) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.status === "suspended" && !input.reason) throw new TRPCError({ code: "BAD_REQUEST", message: "Un motif de suspension est requis." });
      const company = (await db.select({ id: companies.id, platformStatus: companies.platformStatus }).from(companies).where(eq(companies.id, input.companyId)).limit(1))[0];
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Entreprise introuvable." });
      if (company.platformStatus !== input.status) {
        const now = new Date();
        await db.transaction(async tx => {
          await tx.update(companies).set(input.status === "suspended" ? { platformStatus: "suspended", suspendedAt: now, suspensionReason: input.reason! } : { platformStatus: "active", suspendedAt: null, suspensionReason: null }).where(eq(companies.id, input.companyId));
          await tx.insert(companyLifecycleEvents).values({ companyId: input.companyId, action: input.status === "suspended" ? "suspended" : "activated", reason: input.reason ?? null, actorUserId: ctx.user.id });
          await auditPlatform(tx, ctx.user.id, input.status === "suspended" ? "company_suspended" : "company_activated", input.companyId, input.reason, { previousStatus: company.platformStatus });
        });
      }
      return { success: true, status: input.status };
    }),
  }),
  audit: authenticatedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ ctx, input }) => {
    const { db } = await requirePlatformAccess(ctx);
    return db.select({ id: platformAuditLogs.id, action: platformAuditLogs.action, companyId: platformAuditLogs.companyId, reason: platformAuditLogs.reason, createdAt: platformAuditLogs.createdAt, actorName: users.name }).from(platformAuditLogs).leftJoin(users, eq(platformAuditLogs.actorUserId, users.id)).orderBy(desc(platformAuditLogs.createdAt)).limit(input?.limit ?? 50);
  }),
});
