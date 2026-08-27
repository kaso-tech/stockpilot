import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { backupSettings, companies, companyLifecycleEvents, companySyncHealth, platformAdminUsers, platformAuditLogs, supportAssignments, supportPlatformEvents, supportRequests, users } from "../../drizzle/schema";
import { authenticatedProcedure, router } from "../_core/trpc";
import { canManagePlatformCompanies, canManagePlatformOperators, canManagePlatformSupport, requirePlatformAccess } from "../platformAccess";
import { resolveCompanyHealth } from "../platformHealth";

async function auditPlatform(db: { insert: (...args: any[]) => any }, actorUserId: number, action: string, companyId: number | null, reason?: string, metadata?: Record<string, unknown>, entityType = "company", entityId: number | null = companyId) {
  await db.insert(platformAuditLogs).values({ actorUserId, action, entityType, entityId, companyId, reason: reason ?? null, metadataJson: metadata ? JSON.stringify(metadata) : null });
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
    health: authenticatedProcedure.query(async ({ ctx }) => {
      const { db } = await requirePlatformAccess(ctx);
      const [companyRows, supportRows, activityRows] = await Promise.all([
        db.select({ id: companies.id, name: companies.name, platformStatus: companies.platformStatus, createdAt: companies.createdAt, onboardingCompletedAt: companies.onboardingCompletedAt, automaticEnabled: backupSettings.automaticEnabled, frequencyHours: backupSettings.frequencyHours, lastBackupAt: backupSettings.lastBackupAt, lastBackupStatus: backupSettings.lastBackupStatus, syncStatus: companySyncHealth.status, syncUpdatedAt: companySyncHealth.updatedAt }).from(companies).leftJoin(backupSettings, eq(companies.id, backupSettings.companyId)).leftJoin(companySyncHealth, eq(companies.id, companySyncHealth.companyId)).orderBy(desc(companies.createdAt)),
        db.select({ companyId: supportRequests.companyId, total: sql<number>`count(*)` }).from(supportRequests).where(and(isNotNull(supportRequests.companyId), ne(supportRequests.status, "closed"))).groupBy(supportRequests.companyId),
        db.select({ companyId: users.companyId, lastSignedIn: sql<Date>`max(${users.lastSignedIn})` }).from(users).where(isNotNull(users.companyId)).groupBy(users.companyId),
      ]);
      const supportByCompany = new Map(supportRows.filter(row => row.companyId !== null).map(row => [row.companyId as number, Number(row.total)]));
      const activityByCompany = new Map(activityRows.filter(row => row.companyId !== null).map(row => [row.companyId as number, row.lastSignedIn]));

      return companyRows.map(company => {
        const openSupportCount = supportByCompany.get(company.id) ?? 0;
        const health = resolveCompanyHealth({ ...company, openSupportCount });
        return {
          id: company.id,
          name: company.name,
          platformStatus: company.platformStatus,
          createdAt: company.createdAt,
          onboardingCompletedAt: company.onboardingCompletedAt,
          lastActivityAt: activityByCompany.get(company.id) ?? null,
          openSupportCount,
          backupHealth: health.backupHealth,
          syncHealth: health.syncHealth,
          attentionRequired: health.attentionRequired,
        };
      });
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
  support: router({
    list: authenticatedProcedure.input(z.object({ status: z.enum(["open", "in_progress", "closed"]).optional(), priority: z.enum(["low", "normal", "high", "critical"]).optional(), limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ ctx, input }) => {
      const { db, access } = await requirePlatformAccess(ctx);
      if (!canManagePlatformSupport(access.platformRole)) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await db.select({
        id: supportRequests.id,
        companyId: supportRequests.companyId,
        companyName: companies.name,
        status: supportRequests.status,
        createdAt: supportRequests.createdAt,
        resolvedAt: supportRequests.resolvedAt,
        priority: supportAssignments.priority,
        assignedPlatformUserId: supportAssignments.assignedPlatformUserId,
        dueAt: supportAssignments.dueAt,
        firstRespondedAt: supportAssignments.firstRespondedAt,
      }).from(supportRequests).leftJoin(companies, eq(supportRequests.companyId, companies.id)).leftJoin(supportAssignments, eq(supportRequests.id, supportAssignments.supportRequestId)).orderBy(desc(supportRequests.createdAt));
      return rows.filter(row => (!input?.status || row.status === input.status) && (!input?.priority || (row.priority ?? "normal") === input.priority)).slice(0, input?.limit ?? 50).map(row => ({ ...row, priority: row.priority ?? "normal" }));
    }),
    events: authenticatedProcedure.input(z.object({ supportRequestId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const { db, access } = await requirePlatformAccess(ctx);
      if (!canManagePlatformSupport(access.platformRole)) throw new TRPCError({ code: "FORBIDDEN" });
      return db.select({ id: supportPlatformEvents.id, action: supportPlatformEvents.action, metadataJson: supportPlatformEvents.metadataJson, createdAt: supportPlatformEvents.createdAt, actorName: users.name }).from(supportPlatformEvents).leftJoin(users, eq(supportPlatformEvents.actorPlatformUserId, users.id)).where(eq(supportPlatformEvents.supportRequestId, input.supportRequestId)).orderBy(desc(supportPlatformEvents.createdAt));
    }),
    triage: authenticatedProcedure.input(z.object({
      supportRequestId: z.number().int().positive(),
      status: z.enum(["open", "in_progress", "closed"]).optional(),
      priority: z.enum(["low", "normal", "high", "critical"]).optional(),
      assignedPlatformUserId: z.number().int().positive().nullable().optional(),
      takeOwnership: z.boolean().optional(),
      dueAt: z.coerce.date().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const { db, access } = await requirePlatformAccess(ctx);
      if (!canManagePlatformSupport(access.platformRole)) throw new TRPCError({ code: "FORBIDDEN" });
      const request = (await db.select({ id: supportRequests.id, companyId: supportRequests.companyId, status: supportRequests.status }).from(supportRequests).where(eq(supportRequests.id, input.supportRequestId)).limit(1))[0];
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Demande d’assistance introuvable." });
      const requestedAssignee = input.takeOwnership ? ctx.user.id : input.assignedPlatformUserId;
      if (requestedAssignee) {
        const operator = (await db.select({ userId: platformAdminUsers.userId }).from(platformAdminUsers).where(and(eq(platformAdminUsers.userId, requestedAssignee), eq(platformAdminUsers.active, true))).limit(1))[0];
        if (!operator) throw new TRPCError({ code: "BAD_REQUEST", message: "Cet opérateur plateforme n’est pas actif." });
      }
      const assignment = (await db.select().from(supportAssignments).where(eq(supportAssignments.supportRequestId, input.supportRequestId)).limit(1))[0];
      const events: Array<{ action: "assigned" | "priority_changed" | "status_changed" | "due_date_changed"; metadataJson: string }> = [];
      if (input.status && input.status !== request.status) events.push({ action: "status_changed", metadataJson: JSON.stringify({ from: request.status, to: input.status }) });
      if (input.priority && input.priority !== (assignment?.priority ?? "normal")) events.push({ action: "priority_changed", metadataJson: JSON.stringify({ from: assignment?.priority ?? "normal", to: input.priority }) });
      if (requestedAssignee !== undefined && requestedAssignee !== (assignment?.assignedPlatformUserId ?? null)) events.push({ action: "assigned", metadataJson: JSON.stringify({ from: assignment?.assignedPlatformUserId ?? null, to: requestedAssignee }) });
      if (input.dueAt !== undefined && input.dueAt?.getTime() !== assignment?.dueAt?.getTime()) events.push({ action: "due_date_changed", metadataJson: JSON.stringify({ dueAt: input.dueAt?.toISOString() ?? null }) });
      if (!events.length) return { success: true, changed: false } as const;

      await db.transaction(async tx => {
        if (input.status && input.status !== request.status) {
          await tx.update(supportRequests).set({ status: input.status, handledByUserId: ctx.user.id, resolvedAt: input.status === "closed" ? new Date() : null }).where(eq(supportRequests.id, input.supportRequestId));
        }
        if (input.priority !== undefined || requestedAssignee !== undefined || input.dueAt !== undefined) {
          const firstRespondedAt = assignment?.firstRespondedAt ?? (input.status && input.status !== "open" ? new Date() : null);
          await tx.insert(supportAssignments).values({ supportRequestId: input.supportRequestId, priority: input.priority ?? assignment?.priority ?? "normal", assignedPlatformUserId: requestedAssignee !== undefined ? requestedAssignee : assignment?.assignedPlatformUserId ?? null, dueAt: input.dueAt !== undefined ? input.dueAt : assignment?.dueAt ?? null, firstRespondedAt }).onDuplicateKeyUpdate({ set: { priority: input.priority ?? assignment?.priority ?? "normal", assignedPlatformUserId: requestedAssignee !== undefined ? requestedAssignee : assignment?.assignedPlatformUserId ?? null, dueAt: input.dueAt !== undefined ? input.dueAt : assignment?.dueAt ?? null, firstRespondedAt } });
        }
        await tx.insert(supportPlatformEvents).values(events.map(event => ({ supportRequestId: input.supportRequestId, actorPlatformUserId: ctx.user.id, action: event.action, metadataJson: event.metadataJson })));
        await auditPlatform(tx, ctx.user.id, "support_triaged", request.companyId, undefined, { requestId: request.id, actions: events.map(event => event.action) }, "support_request", request.id);
      });
      return { success: true, changed: true } as const;
    }),
  }),
  operators: router({
    list: authenticatedProcedure.query(async ({ ctx }) => {
      const { db, access } = await requirePlatformAccess(ctx);
      if (!canManagePlatformOperators(access.platformRole)) throw new TRPCError({ code: "FORBIDDEN" });
      return db.select({ userId: platformAdminUsers.userId, platformRole: platformAdminUsers.platformRole, active: platformAdminUsers.active, createdAt: platformAdminUsers.createdAt, updatedAt: platformAdminUsers.updatedAt, name: users.name, email: users.email }).from(platformAdminUsers).leftJoin(users, eq(platformAdminUsers.userId, users.id)).orderBy(desc(platformAdminUsers.createdAt));
    }),
    grant: authenticatedProcedure.input(z.object({ email: z.string().trim().email().max(320), platformRole: z.enum(["super_admin", "operations", "support", "billing"]) })).mutation(async ({ ctx, input }) => {
      const { db, access } = await requirePlatformAccess(ctx);
      if (!canManagePlatformOperators(access.platformRole)) throw new TRPCError({ code: "FORBIDDEN" });
      const normalizedEmail = input.email.toLowerCase();
      const account = (await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Ce compte doit d’abord exister dans l’application avant de recevoir un rôle plateforme." });
      await db.insert(platformAdminUsers).values({ userId: account.id, platformRole: input.platformRole, active: true, createdByUserId: ctx.user.id }).onDuplicateKeyUpdate({ set: { platformRole: input.platformRole, active: true, createdByUserId: ctx.user.id } });
      await auditPlatform(db, ctx.user.id, "platform_operator_granted", null, undefined, { operatorUserId: account.id, platformRole: input.platformRole }, "platform_operator", account.id);
      return { success: true } as const;
    }),
    updateRole: authenticatedProcedure.input(z.object({ userId: z.number().int().positive(), platformRole: z.enum(["super_admin", "operations", "support", "billing"]) })).mutation(async ({ ctx, input }) => {
      const { db, access } = await requirePlatformAccess(ctx);
      if (!canManagePlatformOperators(access.platformRole)) throw new TRPCError({ code: "FORBIDDEN" });
      const operator = (await db.select({ userId: platformAdminUsers.userId, active: platformAdminUsers.active }).from(platformAdminUsers).where(eq(platformAdminUsers.userId, input.userId)).limit(1))[0];
      if (!operator || !operator.active) throw new TRPCError({ code: "NOT_FOUND", message: "Opérateur plateforme introuvable." });
      if (input.userId === ctx.user.id && input.platformRole !== "super_admin") throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas retirer votre propre rôle super administrateur." });
      await db.update(platformAdminUsers).set({ platformRole: input.platformRole, createdByUserId: ctx.user.id }).where(eq(platformAdminUsers.userId, input.userId));
      await auditPlatform(db, ctx.user.id, "platform_operator_role_changed", null, undefined, { operatorUserId: input.userId, platformRole: input.platformRole }, "platform_operator", input.userId);
      return { success: true } as const;
    }),
    revoke: authenticatedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { db, access } = await requirePlatformAccess(ctx);
      if (!canManagePlatformOperators(access.platformRole)) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas révoquer votre propre accès plateforme." });
      const operator = (await db.select({ userId: platformAdminUsers.userId, active: platformAdminUsers.active }).from(platformAdminUsers).where(eq(platformAdminUsers.userId, input.userId)).limit(1))[0];
      if (!operator || !operator.active) throw new TRPCError({ code: "NOT_FOUND", message: "Opérateur plateforme introuvable." });
      await db.update(platformAdminUsers).set({ active: false, createdByUserId: ctx.user.id }).where(eq(platformAdminUsers.userId, input.userId));
      await auditPlatform(db, ctx.user.id, "platform_operator_revoked", null, undefined, { operatorUserId: input.userId }, "platform_operator", input.userId);
      return { success: true } as const;
    }),
  }),
});
