import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  auditLogs,
  adminFallbackPasswords,
  companies,
  agentPayments,
  customers,
  expenseBudgets,
  expenses,
  inventorySessions,
  productCategories,
  productUnits,
  products,
  productPriceTiers,
  remunerationProfiles,
  purchaseOrderItems,
  purchaseOrders,
  saleCommissions,
  saleItems,
  saleSettings,
  sales,
  sellerCredentials,
  stockAlerts,
  stockMovements,
  suppliers,
  userDashboardPreferences,
  userSessions,
  users,
} from "../drizzle/schema";
import {
  getDb,
  listAuditLogs,
  listMovements,
  listProducts,
  listSuppliers,
  listUsers,
} from "./db";
import { resultingStock, signedMovementQuantity } from "./stockRules";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { commerceRouter } from "./routers/commerce";
import { inventoryRouter } from "./routers/inventory";
import { payrollRouter } from "./routers/payroll";

const STANDARD_AUTH_SESSION_MS = 24 * 60 * 60 * 1000;
const REMEMBERED_AUTH_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function sessionDeviceLabel(userAgent: string | undefined) {
  const agent = userAgent ?? "";
  if (/android/i.test(agent)) return "Appareil Android";
  if (/iPhone|iPad|iPod/i.test(agent)) return "Appareil Apple";
  if (/Windows/i.test(agent)) return "Ordinateur Windows";
  if (/Macintosh|Mac OS X/i.test(agent)) return "Ordinateur Mac";
  if (/Linux/i.test(agent)) return "Ordinateur Linux";
  return "Appareil inconnu";
}
import { backupRouter } from "./routers/backups";
import { transactionsRouter } from "./routers/transactions";
import { expensesRouter } from "./routers/expenses";
import { agentPaymentExpenseRows, budgetComparison, expenseBreakdownByCategory, monthlyExpenseTotalCents, operatingNetProfitCents } from "./expenseRules";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { matchesAdminFallbackCredentials } from "./adminFallbackAuth";
import { hashPassword, verifyPassword } from "./passwords";
import { categoryCanBeRemoved } from "./categoryRules";
import { assertSellerSensitiveAction } from "./sellerActionRules";
import { companyScope } from "./companyScope";

const productInput = z.object({
  reference: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable(),
  category: z.string().trim().min(2).max(100),
  unit: z.string().trim().min(1).max(30),
  purchasePriceCents: z.number().int().min(0),
  retailPriceCents: z.number().int().min(0),
  wholesalePriceCents: z.number().int().min(0),
  quantity: z.number().int().min(0),
  minimumQuantity: z.number().int().min(0),
  supplierId: z.number().int().positive().nullable(),
  priceTiers: z.array(z.object({ minQuantity: z.number().int().min(2), unitPriceCents: z.number().int().min(0) })).max(12).default([]),
  retailPriceTiers: z.array(z.object({ minQuantity: z.number().int().min(2), unitPriceCents: z.number().int().min(0) })).max(12).default([]),
  wholesalePriceTiers: z.array(z.object({ minQuantity: z.number().int().min(2), unitPriceCents: z.number().int().min(0) })).max(12).default([]),
}).superRefine((input, ctx) => { for (const [label, tiers] of [["détail", input.retailPriceTiers.length ? input.retailPriceTiers : input.priceTiers], ["grossiste", input.wholesalePriceTiers]] as const) { const seen = new Set<number>(); for (const tier of tiers) { if (seen.has(tier.minQuantity)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Chaque seuil ${label} doit être unique.` }); seen.add(tier.minQuantity); } } });

const supplierInput = z.object({
  name: z.string().trim().min(2).max(160),
  otherReference: z.string().trim().max(80).regex(/^[A-Za-z0-9]*$/, "La référence doit être alphanumérique.").nullable(),
  address: z.string().trim().max(1000).nullable(),
  email: z.string().trim().email().max(320).nullable(),
  phone: z.string().trim().max(50).nullable(),
  taxNumber: z.string().trim().max(100).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});
const categoryInput = z.object({ name: z.string().trim().min(2).max(100) });
const unitInput = z.object({ name: z.string().trim().min(1).max(30).regex(/^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s'-]+$/, "Caractères non autorisés") });

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

async function createAudit(
  actorUserId: number,
  action: string,
  entityType: string,
  entityId: string | number | null,
  detail: string,
) {
  const db = await requireDb();
  await db.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId: entityId === null ? null : String(entityId),
    detail,
  });
}

async function syncStockAlert(productId: number) {
  const db = await requireDb();
  const row = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const product = row[0];
  if (!product) return;
  const existing = await db.select().from(stockAlerts).where(eq(stockAlerts.productId, productId)).limit(1);
  const isBelowThreshold = product.quantity <= product.minimumQuantity;

  if (isBelowThreshold) {
    if (existing[0]) {
      await db.update(stockAlerts).set({
        threshold: product.minimumQuantity,
        observedQuantity: product.quantity,
        status: "active",
        resolvedAt: null,
      }).where(eq(stockAlerts.id, existing[0].id));
    } else {
      await db.insert(stockAlerts).values({
        productId,
        threshold: product.minimumQuantity,
        observedQuantity: product.quantity,
        status: "active",
      });
    }
  } else if (existing[0]?.status === "active") {
    await db.update(stockAlerts).set({
      observedQuantity: product.quantity,
      status: "resolved",
      resolvedAt: new Date(),
    }).where(eq(stockAlerts.id, existing[0].id));
  }
}

export const appRouter = router({
  system: systemRouter,
  commerce: commerceRouter,
  inventory: inventoryRouter,
  payroll: payrollRouter,
  backups: backupRouter,
  transactions: transactionsRouter,
  expenses: expensesRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user?.sessionId) {
        const db = await getDb();
        if (db) await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, ctx.user.sessionId));
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    localLogin: publicProcedure.input(z.object({ username: z.string().trim().min(3), password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const row = (await db.select({ openId: users.openId, name: users.name, active: users.active, passwordHash: sellerCredentials.passwordHash }).from(sellerCredentials).innerJoin(users, eq(sellerCredentials.userId, users.id)).where(eq(sellerCredentials.username, input.username)).limit(1))[0];
      if (!row || !row.active || !(await verifyPassword(input.password, row.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants vendeur incorrects." });
      const token = await sdk.createSessionToken(row.openId, { name: row.name || input.username, expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { success: true } as const;
    }),
    passwordLogin: publicProcedure.input(z.object({ email: z.string().trim().email(), password: z.string().min(1), rememberMe: z.boolean().optional().default(false) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const email = input.email.trim().toLowerCase();
      const accounts = await db.select().from(users);
      const account = accounts.find(user => user.active && user.email?.trim().toLowerCase() === email && (user.role === "admin" || user.role === "seller"));
      if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });

      let passwordValid = false;
      if (account.role === "admin") {
        const storedPassword = (await db.select().from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, account.openId)).limit(1))[0];
        passwordValid = storedPassword
          ? await verifyPassword(input.password, storedPassword.passwordHash)
          : matchesAdminFallbackCredentials({ email: input.email, password: input.password }, { email: ENV.adminFallbackEmail, password: ENV.adminFallbackPassword });
      } else {
        const credential = (await db.select().from(sellerCredentials).where(eq(sellerCredentials.userId, account.id)).limit(1))[0];
        passwordValid = Boolean(credential) && await verifyPassword(input.password, credential.passwordHash);
      }

      if (!passwordValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });
      const sessionDurationMs = input.rememberMe ? REMEMBERED_AUTH_SESSION_MS : STANDARD_AUTH_SESSION_MS;
      const sessionId = randomUUID();
      const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"].slice(0, 512) : undefined;
      await db.insert(userSessions).values({ id: sessionId, userId: account.id, deviceLabel: sessionDeviceLabel(userAgent), userAgent: userAgent ?? null, expiresAt: new Date(Date.now() + sessionDurationMs) });
      const token = await sdk.createSessionToken(account.openId, { name: account.name || account.email || "Utilisateur", expiresInMs: sessionDurationMs, sessionId });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: sessionDurationMs });
      console.info("[Auth password] Session issued", { role: account.role, remembered: input.rememberMe });
      return { success: true, role: account.role } as const;
    }),
    registerCompany: publicProcedure.input(z.object({ companyName: z.string().trim().min(2).max(200), administratorName: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320), password: z.string().min(10).max(256), rememberMe: z.boolean().optional().default(true) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const email = input.email.trim().toLowerCase();
      const existingAccount = (await db.select().from(users)).find(user => user.email?.trim().toLowerCase() === email);
      if (existingAccount) throw new TRPCError({ code: "CONFLICT", message: "Cette adresse e-mail est déjà utilisée." });
      const sessionDurationMs = input.rememberMe ? REMEMBERED_AUTH_SESSION_MS : STANDARD_AUTH_SESSION_MS;
      const openId = `local_admin_${randomUUID()}`;
      const passwordHash = await hashPassword(input.password);
      const { companyId, administratorId } = await db.transaction(async tx => {
        const companyResult = await tx.insert(companies).values({ name: input.companyName }).$returningId();
        const companyId = Number(companyResult[0]?.id);
        const userResult = await tx.insert(users).values({ openId, name: input.administratorName, email, loginMethod: "password", role: "admin", active: true, companyId }).$returningId();
        const administratorId = Number(userResult[0]?.id);
        await tx.update(companies).set({ ownerUserId: administratorId }).where(eq(companies.id, companyId));
        await tx.insert(adminFallbackPasswords).values({ ownerOpenId: openId, passwordHash, updatedByUserId: administratorId });
        await tx.insert(saleSettings).values({ companyId, companyName: input.companyName, companyEmail: email, updatedByUserId: administratorId });
        return { companyId, administratorId };
      });
      const sessionId = randomUUID();
      const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"].slice(0, 512) : undefined;
      await db.insert(userSessions).values({ id: sessionId, userId: administratorId, deviceLabel: sessionDeviceLabel(userAgent), userAgent: userAgent ?? null, expiresAt: new Date(Date.now() + sessionDurationMs) });
      const token = await sdk.createSessionToken(openId, { name: input.administratorName, expiresInMs: sessionDurationMs, sessionId });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: sessionDurationMs });
      console.info("[Auth registration] Company administrator session issued", { companyId });
      return { success: true, companyId } as const;
    }),
    sessions: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const db = await requireDb();
        const now = new Date();
        const sessions = await db.select().from(userSessions).where(eq(userSessions.userId, ctx.user.id)).orderBy(desc(userSessions.lastSeenAt));
        const activeSessions = sessions.filter(session => !session.revokedAt && session.expiresAt > now).map(session => ({ id: session.id, deviceLabel: session.deviceLabel, createdAt: session.createdAt, lastSeenAt: session.lastSeenAt, expiresAt: session.expiresAt, isCurrent: session.id === ctx.user.sessionId }));
        if (ctx.user.sessionId) return activeSessions;
        const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"] : undefined;
        return [{ id: "legacy-current", deviceLabel: sessionDeviceLabel(userAgent), createdAt: ctx.user.lastSignedIn, lastSeenAt: ctx.user.lastSignedIn, expiresAt: new Date(ctx.user.lastSignedIn.getTime() + ONE_YEAR_MS), isCurrent: true }, ...activeSessions];
      }),
      revoke: protectedProcedure.input(z.object({ sessionId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
        if (input.sessionId === ctx.user.sessionId) throw new TRPCError({ code: "BAD_REQUEST", message: "Utilisez la déconnexion pour fermer la session de cet appareil." });
        const db = await requireDb();
        const session = (await db.select().from(userSessions).where(eq(userSessions.id, input.sessionId)).limit(1))[0];
        if (!session || session.userId !== ctx.user.id || session.revokedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Session introuvable." });
        await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, session.id));
        return { success: true } as const;
      }),
      revokeOthers: protectedProcedure.mutation(async ({ ctx }) => {
        if (!ctx.user.sessionId) throw new TRPCError({ code: "BAD_REQUEST", message: "Reconnectez-vous pour révoquer les autres sessions." });
        const db = await requireDb();
        const sessions = await db.select().from(userSessions).where(eq(userSessions.userId, ctx.user.id));
        const otherIds = sessions.filter(session => !session.revokedAt && session.id !== ctx.user.sessionId).map(session => session.id);
        await Promise.all(otherIds.map(sessionId => db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, sessionId))));
        return { success: true, revokedCount: otherIds.length } as const;
      }),
    }),
    adminFallbackLogin: publicProcedure.input(z.object({ email: z.string().trim().email(), password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const emailMatches = Boolean(ENV.adminFallbackEmail) && input.email.trim().toLowerCase() === ENV.adminFallbackEmail.trim().toLowerCase();
      if (!emailMatches) {
        console.info("[Auth fallback] Rejected credentials", { emailMatches, passwordLength: input.password.length, configuredPasswordLength: ENV.adminFallbackPassword.length, reason: "email" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants administrateur incorrects." });
      }
      const db = await requireDb();
      const adminAccounts = await db.select().from(users).where(eq(users.role, "admin"));
      const configuredAdmin = adminAccounts.find(account => account.email?.trim().toLowerCase() === input.email.trim().toLowerCase()) ?? (adminAccounts.length === 1 ? adminAccounts[0] : undefined);
      const adminOpenId = ENV.ownerOpenId || configuredAdmin?.openId;
      if (!adminOpenId) {
        console.info("[Auth fallback] Rejected credentials", { emailMatches, passwordLength: input.password.length, configuredPasswordLength: ENV.adminFallbackPassword.length, reason: "admin-account" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants administrateur incorrects." });
      }
      const override = (await db.select().from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, adminOpenId)).limit(1))[0];
      const passwordValid = override ? await verifyPassword(input.password, override.passwordHash) : matchesAdminFallbackCredentials(input, { email: ENV.adminFallbackEmail, password: ENV.adminFallbackPassword });
      if (!passwordValid) {
        console.info("[Auth fallback] Rejected credentials", { emailMatches, passwordLength: input.password.length, configuredPasswordLength: ENV.adminFallbackPassword.length, overridePresent: Boolean(override), reason: "password" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants administrateur incorrects." });
      }
      const token = await sdk.createSessionToken(adminOpenId, { name: configuredAdmin?.name || "Administrateur", expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      console.info("[Auth fallback] Session issued", { overridePresent: Boolean(override) });
      return { success: true } as const;
    }),
    adminFallbackPasswordChange: adminProcedure.input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(256) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const override = (await db.select().from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, ctx.user.openId)).limit(1))[0];
      const currentValid = override ? await verifyPassword(input.currentPassword, override.passwordHash) : matchesAdminFallbackCredentials({ email: ENV.adminFallbackEmail, password: input.currentPassword }, { email: ENV.adminFallbackEmail, password: ENV.adminFallbackPassword });
      if (!currentValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Le mot de passe actuel est incorrect." });
      const passwordHash = await hashPassword(input.newPassword);
      if (override) await db.update(adminFallbackPasswords).set({ passwordHash, updatedByUserId: ctx.user.id }).where(eq(adminFallbackPasswords.id, override.id));
      else await db.insert(adminFallbackPasswords).values({ ownerOpenId: ctx.user.openId, passwordHash, updatedByUserId: ctx.user.id });
      return { success: true } as const;
    }),
  }),

  dashboardPreferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const row = (await db.select().from(userDashboardPreferences).where(eq(userDashboardPreferences.userId, ctx.user.id)).limit(1))[0];
      return { preferencesJson: row?.preferencesJson ?? null };
    }),
    save: protectedProcedure.input(z.object({ preferencesJson: z.string().min(2).max(2000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try { JSON.parse(input.preferencesJson); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Préférences de tableau de bord invalides." }); }
      const current = (await db.select().from(userDashboardPreferences).where(eq(userDashboardPreferences.userId, ctx.user.id)).limit(1))[0];
      if (current) await db.update(userDashboardPreferences).set({ preferencesJson: input.preferencesJson }).where(eq(userDashboardPreferences.id, current.id)); else await db.insert(userDashboardPreferences).values({ userId: ctx.user.id, preferencesJson: input.preferencesJson });
      return { success: true };
    }),
  }),

  dashboard: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const companyId = ctx.user.companyId;
      const [productRows, movements, saleRows, customerRows, inventories, profiles, commissions, payments, expenseRows, budgetRows] = await Promise.all([listProducts(companyId), listMovements(companyId, 250), db.select().from(sales).where(companyScope(sales.companyId, companyId)), db.select().from(customers).where(companyScope(customers.companyId, companyId)), db.select().from(inventorySessions).where(companyScope(inventorySessions.companyId, companyId)), db.select().from(remunerationProfiles).where(companyScope(remunerationProfiles.companyId, companyId)), companyId === null ? db.select().from(saleCommissions) : Promise.resolve([]), companyId === null ? db.select().from(agentPayments) : Promise.resolve([]), db.select().from(expenses).where(companyScope(expenses.companyId, companyId)), db.select().from(expenseBudgets).where(companyScope(expenseBudgets.companyId, companyId))]);
      const lowStock = productRows.filter(product => product.quantity <= product.minimumQuantity);
      const totalValueCents = productRows.reduce(
        (sum, product) => sum + product.quantity * product.purchasePriceCents,
        0,
      );
      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);
      const paidSales = saleRows.filter(sale => sale.status === "paid");
      const monthlySales = paidSales.filter(sale => sale.createdAt.toISOString().slice(0, 7) === month);
      const todaySales = paidSales.filter(sale => sale.createdAt.toISOString().slice(0, 10) === today);
      const monthlyRevenueCents = monthlySales.reduce((sum, sale) => sum + sale.totalCents, 0);
      const monthlyMarginCents = monthlySales.reduce((sum, sale) => sum + sale.netProfitCents, 0);
      const agentExpenseRows = agentPaymentExpenseRows(payments);
      const monthlyManualExpenseCents = monthlyExpenseTotalCents(expenseRows, month);
      const monthlyAgentPaymentCents = monthlyExpenseTotalCents(agentExpenseRows, month);
      const monthlyExpenseCents = monthlyManualExpenseCents + monthlyAgentPaymentCents;
      const monthlyOperatingProfitCents = operatingNetProfitCents(monthlyMarginCents, monthlyExpenseCents);
      const currentBudget = budgetRows.find(budget => budget.yearMonth === month);
      const expenseBudget = budgetComparison(currentBudget?.amountCents ?? null, monthlyExpenseCents, currentBudget?.warningPercent ?? 80);
      const duePayrollCents = profiles.reduce((sum, profile) => {
        const commissionCents = commissions.filter(item => item.beneficiaryType === profile.beneficiaryType && item.beneficiaryId === profile.beneficiaryId && item.createdAt.toISOString().slice(0, 7) === month).reduce((total, item) => total + item.commissionCents, 0);
        const fixedCents = profile.remunerationMode === "commission" ? 0 : profile.fixedMonthlyCents;
        const paidCents = payments.filter(item => item.beneficiaryType === profile.beneficiaryType && item.beneficiaryId === profile.beneficiaryId && item.periodLabel === month).reduce((total, item) => total + item.amountCents, 0);
        return sum + Math.max(0, fixedCents + commissionCents - paidCents);
      }, 0);
      const dayKeys = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return date.toISOString().slice(0, 10);
      });
      const trend = dayKeys.map(day => {
        const daily = movements.filter(movement => movement.occurredAt.toISOString().slice(0, 10) === day);
        return {
          day,
          entries: daily.filter(movement => movement.type === "entry").reduce((sum, movement) => sum + Math.abs(movement.quantity), 0),
          exits: daily.filter(movement => movement.type === "exit").reduce((sum, movement) => sum + Math.abs(movement.quantity), 0),
        };
      });
      const salesTrend = dayKeys.map(day => ({ day, revenueCents: paidSales.filter(sale => sale.createdAt.toISOString().slice(0, 10) === day).reduce((sum, sale) => sum + sale.totalCents, 0), invoices: paidSales.filter(sale => sale.createdAt.toISOString().slice(0, 10) === day).length }));
      const customerMap = new Map(customerRows.map(customer => [customer.id, customer]));
      return {
        summary: {
          totalValueCents,
          productCount: productRows.length,
          activeAlerts: lowStock.length,
          movementCount: movements.length,
          monthlyRevenueCents,
          monthlyMarginCents,
          monthlyExpenseCents,
          monthlyOperatingProfitCents,
          expenseBreakdown: expenseBreakdownByCategory([...expenseRows, ...agentExpenseRows], month),
          monthlyManualExpenseCents,
          monthlyAgentPaymentCents,
          expenseBudget,
          monthlyInvoiceCount: monthlySales.length,
          todayRevenueCents: todaySales.reduce((sum, sale) => sum + sale.totalCents, 0),
          averageBasketCents: monthlySales.length ? Math.round(monthlyRevenueCents / monthlySales.length) : 0,
          duePayrollCents,
          draftInventories: inventories.filter(inventory => inventory.status === "draft").length,
        },
        lowStock: lowStock.slice(0, 6),
        recentMovements: movements.slice(0, 6),
        trend,
        salesTrend,
        recentSales: paidSales.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5).map(sale => { const customer = sale.customerId ? customerMap.get(sale.customerId) : undefined; return { id: sale.id, invoiceNumber: sale.invoiceNumber, totalCents: sale.totalCents, netProfitCents: sale.netProfitCents, createdAt: sale.createdAt, customerName: customer?.name ?? "Vente comptoir", customerType: customer?.type ?? "ordinary" }; }),
        unpaidInvoices: saleRows.filter(sale => sale.channel === "invoice" && sale.status !== "paid").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5).map(sale => { const customer = sale.customerId ? customerMap.get(sale.customerId) : undefined; return { id: sale.id, invoiceNumber: sale.invoiceNumber, totalCents: sale.totalCents, amountPaidCents: sale.amountPaidCents, balanceCents: Math.max(0, sale.totalCents - sale.amountPaidCents), status: sale.status, createdAt: sale.createdAt, customerName: customer?.name ?? "Client" }; }),
      };
    }),
  }),

  products: router({
    list: protectedProcedure.query(({ ctx }) => listProducts(ctx.user.companyId)),
    detail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const product = (await db.select().from(products).where(and(eq(products.id, input.id), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
      const [tiers, movements, lines, supplier] = await Promise.all([
        db.select().from(productPriceTiers).where(eq(productPriceTiers.productId, product.id)),
        db.select().from(stockMovements).where(eq(stockMovements.productId, product.id)).orderBy(desc(stockMovements.occurredAt)),
        db.select().from(saleItems).where(eq(saleItems.productId, product.id)),
        product.supplierId ? (await db.select().from(suppliers).where(eq(suppliers.id, product.supplierId)).limit(1))[0] ?? null : null,
      ]);
      const uniqueSaleIds = Array.from(new Set(lines.map(line => line.saleId)));
      const saleRows = (await Promise.all(uniqueSaleIds.map(async saleId => (await db.select().from(sales).where(eq(sales.id, saleId)).limit(1))[0] ?? null))).filter((sale): sale is NonNullable<typeof sale> => Boolean(sale)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const revenueCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
      const costCents = lines.reduce((sum, line) => sum + line.lineCostCents, 0);
      const unitsSold = lines.reduce((sum, line) => sum + line.quantity, 0);
      return { product, supplier, tiers: { retail: tiers.filter(tier => tier.customerType === "retail"), wholesale: tiers.filter(tier => tier.customerType === "wholesale") }, movements: movements.slice(0, 12), sales: saleRows.slice(0, 8), statistics: { revenueCents, costCents, grossMarginCents: revenueCents - costCents, marginRate: revenueCents > 0 ? Math.round(((revenueCents - costCents) / revenueCents) * 1000) / 10 : 0, unitsSold, saleCount: uniqueSaleIds.length, lastSaleAt: saleRows[0]?.createdAt ?? null } };
    }),
    create: adminProcedure.input(productInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        const { priceTiers, retailPriceTiers, wholesalePriceTiers, ...productData } = input;
        const retailTiers = retailPriceTiers.length ? retailPriceTiers : priceTiers;
        const productId = await db.transaction(async tx => { const result = await tx.insert(products).values({ ...productData, companyId: ctx.user.companyId }); const id = Number(result[0].insertId); const tiers = [...retailTiers.map(tier => ({ ...tier, productId: id, customerType: "retail" as const })), ...wholesalePriceTiers.map(tier => ({ ...tier, productId: id, customerType: "wholesale" as const }))]; if (tiers.length) await tx.insert(productPriceTiers).values(tiers); return id; });
        await syncStockAlert(productId);
        await createAudit(ctx.user.id, "Création", "Produit", productId, `Produit ${input.reference} créé`);
        return { success: true, id: productId };
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: "Cette référence produit existe déjà.", cause: error });
      }
    }),
    update: adminProcedure.input(productInput.safeExtend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { id, priceTiers, retailPriceTiers, wholesalePriceTiers, ...values } = input;
      const retailTiers = retailPriceTiers.length ? retailPriceTiers : priceTiers;
      await db.transaction(async tx => { await tx.update(products).set(values).where(and(eq(products.id, id), companyScope(products.companyId, ctx.user.companyId))); await tx.delete(productPriceTiers).where(eq(productPriceTiers.productId, id)); const tiers = [...retailTiers.map(tier => ({ ...tier, productId: id, customerType: "retail" as const })), ...wholesalePriceTiers.map(tier => ({ ...tier, productId: id, customerType: "wholesale" as const }))]; if (tiers.length) await tx.insert(productPriceTiers).values(tiers); });
      await syncStockAlert(id);
      await createAudit(ctx.user.id, "Modification", "Produit", id, `Produit ${values.reference} modifié`);
      return { success: true };
    }),
    updatePurchasePrice: protectedProcedure.input(z.object({ id: z.number().int().positive(), purchasePriceCents: z.number().int().min(0) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const product = (await db.select().from(products).where(and(eq(products.id, input.id), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
      if (ctx.user.role === "seller") {
        const settings = (await db.select().from(saleSettings).limit(1))[0];
        try { assertSellerSensitiveAction(settings, "purchase_price"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Modification du coût d’achat non autorisée." }); }
      }
      await db.update(products).set({ purchasePriceCents: input.purchasePriceCents }).where(and(eq(products.id, product.id), companyScope(products.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Coût d’achat modifié", "Produit", product.id, `${product.reference} : ${product.purchasePriceCents} → ${input.purchasePriceCents} centimes`);
      return { success: true };
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const movement = await db.select({ id: stockMovements.id }).from(stockMovements).where(and(eq(stockMovements.productId, input.id), companyScope(stockMovements.companyId, ctx.user.companyId))).limit(1);
      if (movement.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un produit avec des mouvements ne peut pas être supprimé." });
      await db.delete(products).where(and(eq(products.id, input.id), companyScope(products.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Suppression", "Produit", input.id, "Produit supprimé");
      return { success: true };
    }),
  }),

  categories: router({
    list: protectedProcedure.query(async ({ ctx }) => (await requireDb()).select().from(productCategories).where(companyScope(productCategories.companyId, ctx.user.companyId)).orderBy(productCategories.name)),
    create: adminProcedure.input(categoryInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); try { const result = await db.insert(productCategories).values({ ...input, companyId: ctx.user.companyId }); const id = Number(result[0].insertId); await createAudit(ctx.user.id, "Création", "Catégorie", id, `Catégorie ${input.name} créée`); return { id }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette catégorie existe déjà.", cause: error }); } }),
    update: adminProcedure.input(categoryInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = (await db.select().from(productCategories).where(eq(productCategories.id, input.id)).limit(1))[0]; if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Catégorie introuvable." }); try { await db.transaction(async tx => { await tx.update(productCategories).set({ name: input.name }).where(eq(productCategories.id, input.id)); await tx.update(products).set({ category: input.name }).where(eq(products.category, current.name)); }); await createAudit(ctx.user.id, "Modification", "Catégorie", input.id, `Catégorie ${current.name} renommée en ${input.name}`); return { success: true }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette catégorie existe déjà.", cause: error }); } }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = (await db.select().from(productCategories).where(eq(productCategories.id, input.id)).limit(1))[0]; if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Catégorie introuvable." }); const usedBy = await db.select({ id: products.id }).from(products).where(eq(products.category, current.name)).limit(1); if (!categoryCanBeRemoved(usedBy.length)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette catégorie est utilisée par des produits et ne peut pas être supprimée." }); await db.delete(productCategories).where(eq(productCategories.id, input.id)); await createAudit(ctx.user.id, "Suppression", "Catégorie", input.id, `Catégorie ${current.name} supprimée`); return { success: true }; }),
  }),

  units: router({
    list: protectedProcedure.query(async ({ ctx }) => (await requireDb()).select().from(productUnits).where(companyScope(productUnits.companyId, ctx.user.companyId)).orderBy(productUnits.name)),
    create: adminProcedure.input(unitInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); try { const result = await db.insert(productUnits).values({ ...input, companyId: ctx.user.companyId }); const id = Number(result[0].insertId); await createAudit(ctx.user.id, "Création", "Unité", id, `Unité ${input.name} créée`); return { id }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette unité existe déjà.", cause: error }); } }),
    update: adminProcedure.input(unitInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = (await db.select().from(productUnits).where(eq(productUnits.id, input.id)).limit(1))[0]; if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Unité introuvable." }); try { await db.transaction(async tx => { await tx.update(productUnits).set({ name: input.name }).where(eq(productUnits.id, input.id)); await tx.update(products).set({ unit: input.name }).where(eq(products.unit, current.name)); }); await createAudit(ctx.user.id, "Modification", "Unité", input.id, `Unité ${current.name} renommée en ${input.name}`); return { success: true }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette unité existe déjà.", cause: error }); } }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = (await db.select().from(productUnits).where(eq(productUnits.id, input.id)).limit(1))[0]; if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Unité introuvable." }); const usedBy = await db.select({ id: products.id }).from(products).where(eq(products.unit, current.name)).limit(1); if (usedBy.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette unité est utilisée par des produits et ne peut pas être supprimée." }); await db.delete(productUnits).where(eq(productUnits.id, input.id)); await createAudit(ctx.user.id, "Suppression", "Unité", input.id, `Unité ${current.name} supprimée`); return { success: true }; }),
  }),

  suppliers: router({
    list: protectedProcedure.query(({ ctx }) => listSuppliers(ctx.user.companyId)),
    create: adminProcedure.input(supplierInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = await db.insert(suppliers).values({ ...input, companyId: ctx.user.companyId });
      const supplierId = Number(result[0].insertId);
      await createAudit(ctx.user.id, "Création", "Fournisseur", supplierId, `Fournisseur ${input.name} créé`);
      return { success: true, id: supplierId };
    }),
    update: adminProcedure.input(supplierInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      await db.update(suppliers).set(values).where(and(eq(suppliers.id, id), companyScope(suppliers.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Modification", "Fournisseur", id, `Fournisseur ${values.name} modifié`);
      return { success: true };
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const supplier = (await db.select().from(suppliers).where(and(eq(suppliers.id, input.id), companyScope(suppliers.companyId, ctx.user.companyId))).limit(1))[0];
      if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Fournisseur introuvable." });
      const linkedProduct = await db.select({ id: products.id }).from(products).where(eq(products.supplierId, input.id)).limit(1);
      if (linkedProduct.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce fournisseur est rattaché à des produits. Détachez-les avant suppression." });
      const linkedOrder = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.supplierId, input.id)).limit(1);
      if (linkedOrder.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce fournisseur possède un historique de bons de commande et ne peut pas être supprimé." });
      await db.delete(suppliers).where(and(eq(suppliers.id, input.id), companyScope(suppliers.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Suppression", "Fournisseur", input.id, `Fournisseur ${supplier.name} supprimé`);
      return { success: true };
    }),
  }),

  purchaseOrders: router({
    list: protectedProcedure.query(async () => {
      const db = await requireDb();
      const [orders, rows, supplierRows] = await Promise.all([
        db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt)),
        db.select().from(purchaseOrderItems),
        db.select().from(suppliers),
      ]);
      return orders.map(order => ({
        ...order,
        supplier: supplierRows.find(supplier => supplier.id === order.supplierId) ?? null,
        items: rows.filter(item => item.purchaseOrderId === order.id),
      }));
    }),
    listBySupplier: protectedProcedure.input(z.object({ supplierId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      const orders = await db.select().from(purchaseOrders).where(eq(purchaseOrders.supplierId, input.supplierId)).orderBy(desc(purchaseOrders.createdAt));
      if (!orders.length) return [];
      const rows = await db.select().from(purchaseOrderItems);
      return orders.map(order => ({ ...order, items: rows.filter(item => item.purchaseOrderId === order.id) }));
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      const [supplier, items] = await Promise.all([
        db.select().from(suppliers).where(eq(suppliers.id, order.supplierId)).limit(1),
        db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, input.id)),
      ]);
      return { ...order, supplier: supplier[0] ?? null, items };
    }),
    create: adminProcedure.input(z.object({
      supplierId: z.number().int().positive(),
      notes: z.string().trim().max(2000).nullable().optional(),
      expectedDeliveryDate: z.coerce.date().nullable().optional(),
      items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1).max(100),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const supplier = (await db.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1))[0];
      if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Fournisseur introuvable." });
      const catalog = await db.select().from(products);
      const selected = input.items.map(item => {
        const product = catalog.find(value => value.id === item.productId);
        if (!product || product.supplierId !== input.supplierId) throw new TRPCError({ code: "BAD_REQUEST", message: "Chaque produit doit être rattaché à ce fournisseur." });
        return { product, quantity: item.quantity, lineTotalCents: item.quantity * product.purchasePriceCents };
      });
      const totalCents = selected.reduce((sum, item) => sum + item.lineTotalCents, 0);
      const orderNumber = `BC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const orderId = await db.transaction(async tx => {
        const result = await tx.insert(purchaseOrders).values({ orderNumber, supplierId: input.supplierId, totalCents, notes: input.notes ?? null, expectedDeliveryDate: input.expectedDeliveryDate ?? null, createdByUserId: ctx.user.id });
        const id = Number(result[0].insertId);
        await tx.insert(purchaseOrderItems).values(selected.map(item => ({ purchaseOrderId: id, productId: item.product.id, productName: item.product.name, productReference: item.product.reference, unit: item.product.unit, quantity: item.quantity, purchasePriceCents: item.product.purchasePriceCents, lineTotalCents: item.lineTotalCents })));
        return id;
      });
      await createAudit(ctx.user.id, "Création", "Bon de commande", orderId, `Bon ${orderNumber} créé pour ${supplier.name}`);
      return { id: orderId, orderNumber, totalCents };
    }),
    updateDetails: adminProcedure.input(z.object({ id: z.number().int().positive(), notes: z.string().trim().max(2000).nullable(), expectedDeliveryDate: z.coerce.date().nullable() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "received" || order.status === "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce bon ne peut plus être modifié." });
      await db.update(purchaseOrders).set({ notes: input.notes, expectedDeliveryDate: input.expectedDeliveryDate }).where(eq(purchaseOrders.id, input.id));
      await createAudit(ctx.user.id, "Modification", "Bon de commande", input.id, `Bon ${order.orderNumber} mis à jour`);
      return { success: true };
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status !== "draft" && order.status !== "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seuls les bons en attente ou annulés peuvent être supprimés." });
      await db.transaction(async tx => {
        await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, input.id));
        await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, input.id));
      });
      await createAudit(ctx.user.id, "Suppression", "Bon de commande", input.id, `Bon ${order.orderNumber} supprimé`);
      return { success: true };
    }),
    markSent: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "received" || order.status === "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce bon ne peut plus être marqué comme envoyé." });
      if (order.status !== "sent") {
        await db.update(purchaseOrders).set({ status: "sent" }).where(eq(purchaseOrders.id, input.id));
        await createAudit(ctx.user.id, "Envoi", "Bon de commande", input.id, `Bon ${order.orderNumber} marqué comme envoyé`);
      }
      return { success: true, status: "sent" as const };
    }),
    cancel: adminProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "received") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un bon entièrement reçu ne peut pas être annulé." });
      await db.update(purchaseOrders).set({ status: "cancelled", cancellationReason: input.reason, cancelledAt: new Date() }).where(eq(purchaseOrders.id, input.id));
      await createAudit(ctx.user.id, "Annulation", "Bon de commande", input.id, `Bon ${order.orderNumber} annulé : ${input.reason}`);
      return { success: true, status: "cancelled" as const };
    }),
    receive: adminProcedure.input(z.object({ id: z.number().int().positive(), lines: z.array(z.object({ id: z.number().int().positive(), quantity: z.number().int().positive() })).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.id)).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un bon annulé ne peut pas être réceptionné." });
      if (order.status === "received") return { success: true, alreadyReceived: true, status: "received" as const };
      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, input.id));
      if (!items.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce bon ne contient aucun produit à réceptionner." });
      const requestedByItemId = new Map(input.lines.map(line => [line.id, line.quantity]));
      if (requestedByItemId.size !== input.lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Une ligne ne peut être réceptionnée qu’une seule fois dans la même opération." });
      for (const line of input.lines) {
        const item = items.find(value => value.id === line.id);
        if (!item) throw new TRPCError({ code: "BAD_REQUEST", message: "Une ligne sélectionnée n’appartient pas à ce bon." });
        if (line.quantity > item.quantity - item.receivedQuantity) throw new TRPCError({ code: "BAD_REQUEST", message: `La quantité reçue dépasse le reliquat de ${item.productName}.` });
      }
      const result = await db.transaction(async tx => {
        for (const item of items.filter(value => requestedByItemId.has(value.id))) {
          const receivedNow = requestedByItemId.get(item.id) ?? 0;
          const product = (await tx.select().from(products).where(eq(products.id, item.productId)).limit(1))[0];
          if (!product) throw new TRPCError({ code: "NOT_FOUND", message: `Produit ${item.productName} introuvable.` });
          const resultingQuantity = product.quantity + receivedNow;
          await tx.update(products).set({ quantity: resultingQuantity }).where(eq(products.id, product.id));
          const quantityUpdate = await tx.update(purchaseOrderItems).set({ receivedQuantity: item.receivedQuantity + receivedNow }).where(and(eq(purchaseOrderItems.id, item.id), eq(purchaseOrderItems.receivedQuantity, item.receivedQuantity)));
          const affected = Number((quantityUpdate as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
          if (!affected) throw new TRPCError({ code: "CONFLICT", message: "Ce bon a été modifié. Actualisez la page avant de poursuivre." });
          await tx.insert(stockMovements).values({ productId: product.id, supplierId: order.supplierId, type: "entry", quantity: receivedNow, previousQuantity: product.quantity, resultingQuantity, reason: `Réception partielle du bon ${order.orderNumber}`, createdByUserId: ctx.user.id });
        }
        const complete = items.every(item => item.receivedQuantity + (requestedByItemId.get(item.id) ?? 0) >= item.quantity);
        const status = complete ? "received" : "sent";
        await tx.update(purchaseOrders).set({ status, receivedAt: complete ? new Date() : null }).where(eq(purchaseOrders.id, input.id));
        return { status, complete };
      });
      await createAudit(ctx.user.id, "Réception", "Bon de commande", input.id, `${result.complete ? "Réception complète" : "Réception partielle"} du bon ${order.orderNumber}`);
      return { success: true, alreadyReceived: false, status: result.status, complete: result.complete };
    }),
  }),

  movements: router({
    list: protectedProcedure.query(({ ctx }) => listMovements(ctx.user.companyId)),
    create: protectedProcedure.input(z.object({
      productId: z.number().int().positive(),
      supplierId: z.number().int().positive().nullable(),
      type: z.enum(["entry", "exit", "adjustment"]),
      quantity: z.number().int().refine(value => value !== 0, "La quantité doit être différente de zéro."),
      reason: z.string().trim().min(3).max(255),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      if (ctx.user.role === "seller") {
        if (input.type !== "adjustment" || input.supplierId !== null) throw new TRPCError({ code: "FORBIDDEN", message: "Un vendeur ne peut enregistrer qu’une correction de stock sans fournisseur." });
        const settings = (await db.select().from(saleSettings).limit(1))[0];
        try { assertSellerSensitiveAction(settings, "stock_correction"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Correction de stock non autorisée." }); }
      }
      await db.transaction(async tx => {
        const row = await tx.select().from(products).where(eq(products.id, input.productId)).limit(1);
        const product = row[0];
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
        const signedQuantity = signedMovementQuantity(input.type, input.quantity);
        let resultingQuantity: number;
        try {
          resultingQuantity = resultingStock(product.quantity, input.type, input.quantity);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Mouvement invalide." });
        }
        await tx.update(products).set({ quantity: resultingQuantity }).where(eq(products.id, product.id));
        await tx.insert(stockMovements).values({
          productId: product.id,
          supplierId: input.supplierId,
          type: input.type,
          quantity: signedQuantity,
          previousQuantity: product.quantity,
          resultingQuantity,
          reason: input.reason,
          createdByUserId: ctx.user.id,
        });
        await tx.insert(auditLogs).values({
          actorUserId: ctx.user.id,
          action: "Mouvement enregistré",
          entityType: "Mouvement de stock",
          entityId: String(product.id),
          detail: `${input.type} de ${Math.abs(signedQuantity)} ${product.unit} pour ${product.reference} : ${input.reason}`,
        });
      });
      await syncStockAlert(input.productId);
      return { success: true };
    }),
  }),

  audit: router({
    list: adminProcedure.query(({ ctx }) => listAuditLogs(ctx.user.companyId)),
  }),

  users: router({
    list: adminProcedure.query(({ ctx }) => listUsers(ctx.user.companyId)),
    updateRole: adminProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(["admin", "seller"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.id && input.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas retirer votre propre rôle administrateur." });
      }
      const db = await requireDb();
      await db.update(users).set({ role: input.role }).where(and(eq(users.id, input.id)));
      await createAudit(ctx.user.id, "Rôle modifié", "Utilisateur", input.id, `Rôle défini sur ${input.role === "admin" ? "administrateur" : "vendeur"}`);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
