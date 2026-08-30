import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
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
  warehouses,
  warehouseStocks,
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
import { calculateCommercialTotals } from "./commercialTotals";
import { MAX_CENTS, MAX_QUANTITY } from "./numericLimits";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { commerceRouter } from "./routers/commerce";
import { inventoryRouter } from "./routers/inventory";
import { payrollRouter } from "./routers/payroll";
import { printingSettingsRouter } from "./routers/printingSettings";
import { vatRatesRouter } from "./routers/vatRates";
import { sellerDiscountPermissionsRouter } from "./routers/sellerDiscountPermissions";
import { warehousesRouter } from "./routers/warehouses";
import { stockTransfersRouter } from "./routers/stockTransfers";
import { supportRouter } from "./routers/support";
import { platformRouter } from "./routers/platform";
import { syncHealthRouter } from "./routers/syncHealth";
import { paymentDuesRouter } from "./routers/paymentDues";
import { subscriptionBillingRouter } from "./routers/subscriptionBilling";
import { BULK_DELETE_CONFIRMATION, hasBulkDeleteConfirmation, normalizeBulkDeleteIds, type BulkDeleteResource } from "./bulkDeleteRules";

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

function requestIdentity(req: { ip?: string; headers: Record<string, unknown> }) {
  // Ne jamais accepter directement X-Forwarded-For fourni par le navigateur :
  // Express renseigne req.ip selon la configuration du proxy de confiance.
  return req.ip || "unknown";
}

function assertLoginRateLimit(req: { ip?: string; headers: Record<string, unknown> }, email: string) {
  const identity = requestIdentity(req);
  const normalizedEmail = email.trim().toLowerCase();
  if (!consumeRateLimit(`auth:ip:${identity}`, 30, 15 * 60 * 1000) || !consumeRateLimit(`auth:account:${identity}:${normalizedEmail}`, 10, 15 * 60 * 1000)) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de tentatives. Réessayez plus tard." });
  }
}

function legacyAdminFallbackEnabled() {
  return !ENV.isProduction && process.env.ALLOW_LEGACY_ADMIN_FALLBACK === "true";
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
import { consumeRateLimit } from "./rateLimit";
import { creditWarehouseStock, debitWarehouseStock, getDefaultWarehouse, getScopedWarehouse } from "./warehouseStock";
import { assertSellerWarehouseAccess } from "./sellerWarehouseAccess";
import { normalizeAuthEmail } from "./authEmail";

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
  warehouseId: z.number().int().positive().optional(),
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
  const actor = (await db.select({ companyId: users.companyId }).from(users).where(eq(users.id, actorUserId)).limit(1))[0];
  if (!actor || actor.companyId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Aucune entreprise active n’est associée à cet acteur." });
  await db.insert(auditLogs).values({
    companyId: actor.companyId,
    actorUserId,
    action,
    entityType,
    entityId: entityId === null ? null : String(entityId),
    detail,
  });
}

const bulkDeleteSelectionInput = z.object({
  resource: z.enum(["products", "suppliers", "customers"]),
  ids: z.array(z.number().int().positive()).min(1).max(100),
});

type BulkDeleteCandidate = { id: number; label: string };

async function inspectBulkDeleteSelection(db: any, companyId: number | null, resource: BulkDeleteResource, rawIds: number[]) {
  const ids = normalizeBulkDeleteIds(rawIds);
  if (resource === "products") {
    const rows = await db.select({ id: products.id, reference: products.reference, name: products.name }).from(products).where(and(inArray(products.id, ids), companyScope(products.companyId, companyId)));
    const movementRows = rows.length ? await db.select({ productId: stockMovements.productId }).from(stockMovements).where(and(inArray(stockMovements.productId, rows.map((row: any) => row.id)), companyScope(stockMovements.companyId, companyId))) : [];
    const protectedIds = new Set(movementRows.map((movement: any) => movement.productId));
    const found = new Set(rows.map((row: any) => row.id));
    const candidates: BulkDeleteCandidate[] = rows.map((row: any) => ({ id: row.id, label: `${row.reference} — ${row.name}` }));
    return { resource, requestedCount: ids.length, eligible: candidates.filter(candidate => !protectedIds.has(candidate.id)), blocked: candidates.filter(candidate => protectedIds.has(candidate.id)).map(candidate => ({ ...candidate, reason: "Ce produit possède déjà des mouvements de stock." })), missingIds: ids.filter(id => !found.has(id)) };
  }
  if (resource === "suppliers") {
    const rows = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(and(inArray(suppliers.id, ids), companyScope(suppliers.companyId, companyId)));
    const found = new Set(rows.map((row: any) => row.id));
    const foundIds = rows.map((row: any) => row.id);
    const [productLinks, orderLinks] = foundIds.length ? await Promise.all([
      db.select({ supplierId: products.supplierId }).from(products).where(and(inArray(products.supplierId, foundIds), companyScope(products.companyId, companyId))),
      db.select({ supplierId: purchaseOrders.supplierId }).from(purchaseOrders).where(and(inArray(purchaseOrders.supplierId, foundIds), companyScope(purchaseOrders.companyId, companyId))),
    ]) : [[], []];
    const linkedProducts = new Set(productLinks.map((row: any) => row.supplierId));
    const linkedOrders = new Set(orderLinks.map((row: any) => row.supplierId));
    const candidates: BulkDeleteCandidate[] = rows.map((row: any) => ({ id: row.id, label: row.name }));
    const reasonFor = (id: number) => linkedProducts.has(id) ? "Ce fournisseur est encore rattaché à des produits." : linkedOrders.has(id) ? "Ce fournisseur possède un historique de bons de commande." : null;
    return { resource, requestedCount: ids.length, eligible: candidates.filter(candidate => !reasonFor(candidate.id)), blocked: candidates.filter(candidate => reasonFor(candidate.id)).map(candidate => ({ ...candidate, reason: reasonFor(candidate.id)! })), missingIds: ids.filter(id => !found.has(id)) };
  }
  const rows = await db.select({ id: customers.id, name: customers.name }).from(customers).where(and(inArray(customers.id, ids), companyScope(customers.companyId, companyId)));
  const found = new Set(rows.map((row: any) => row.id));
  const salesRows = rows.length ? await db.select({ customerId: sales.customerId }).from(sales).where(and(inArray(sales.customerId, rows.map((row: any) => row.id)), companyScope(sales.companyId, companyId))) : [];
  const protectedIds = new Set(salesRows.map((sale: any) => sale.customerId));
  const candidates: BulkDeleteCandidate[] = rows.map((row: any) => ({ id: row.id, label: row.name }));
  return { resource, requestedCount: ids.length, eligible: candidates.filter(candidate => !protectedIds.has(candidate.id)), blocked: candidates.filter(candidate => protectedIds.has(candidate.id)).map(candidate => ({ ...candidate, reason: "Ce client est lié à un historique de documents commerciaux." })), missingIds: ids.filter(id => !found.has(id)) };
}

async function syncStockAlert(productId: number, companyId: number) {
  const db = await requireDb();
  const row = await db.select().from(products).where(and(eq(products.id, productId), companyScope(products.companyId, companyId))).limit(1);
  const product = row[0];
  if (!product) return;
  const existing = await db.select().from(stockAlerts).where(and(eq(stockAlerts.productId, productId), companyScope(stockAlerts.companyId, companyId))).limit(1);
  const isBelowThreshold = product.quantity <= product.minimumQuantity;

  if (isBelowThreshold) {
    if (existing[0]) {
      await db.update(stockAlerts).set({
        threshold: product.minimumQuantity,
        observedQuantity: product.quantity,
        status: "active",
        resolvedAt: null,
      }).where(and(eq(stockAlerts.id, existing[0].id), companyScope(stockAlerts.companyId, companyId)));
    } else {
      await db.insert(stockAlerts).values({
        companyId,
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
    }).where(and(eq(stockAlerts.id, existing[0].id), companyScope(stockAlerts.companyId, companyId)));
  }
}

export const appRouter = router({
  platform: platformRouter,
  syncHealth: syncHealthRouter,
  printingSettings: printingSettingsRouter,
  vatRates: vatRatesRouter,
  sellerDiscountPermissions: sellerDiscountPermissionsRouter,
  warehouses: warehousesRouter,
  stockTransfers: stockTransfersRouter,
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
      if (ctx.user?.sessionId && ctx.user.id > 0) {
        const db = await getDb();
        if (db) await db.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.id, ctx.user.sessionId), eq(userSessions.userId, ctx.user.id)));
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    localLogin: publicProcedure.input(z.object({ username: z.string().trim().min(3).max(320), password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, input.username);
      const db = await requireDb();
      const row = (await db.select({ id: users.id, openId: users.openId, name: users.name, active: users.active, passwordHash: sellerCredentials.passwordHash }).from(sellerCredentials).innerJoin(users, eq(sellerCredentials.userId, users.id)).where(eq(sellerCredentials.username, input.username)).limit(1))[0];
      if (!row || !row.active || !(await verifyPassword(input.password, row.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });
      const sessionId = randomUUID();
      const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"].slice(0, 512) : undefined;
      await db.insert(userSessions).values({ id: sessionId, userId: row.id, deviceLabel: sessionDeviceLabel(userAgent), userAgent: userAgent ?? null, expiresAt: new Date(Date.now() + ONE_YEAR_MS) });
      const token = await sdk.createSessionToken(row.openId, { name: row.name || input.username, expiresInMs: ONE_YEAR_MS, sessionId });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { success: true } as const;
    }),
    passwordLogin: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256), rememberMe: z.boolean().optional().default(false) })).mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, input.email);
      const db = await requireDb();
      const email = normalizeAuthEmail(input.email);
      if (!email) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });
      const account = (await db.select().from(users).where(and(eq(users.emailNormalized, email), eq(users.active, true), inArray(users.role, ["admin", "seller"]))).limit(1))[0];
      if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou mot de passe incorrect." });

      let passwordValid = false;
      if (account.role === "admin") {
        const storedPassword = (await db.select().from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, account.openId)).limit(1))[0];
        passwordValid = Boolean(storedPassword) && await verifyPassword(input.password, storedPassword.passwordHash);
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
    emailAvailability: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).query(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, input.email);
      const db = await requireDb();
      const normalizedEmail = normalizeAuthEmail(input.email);
      const account = normalizedEmail ? (await db.select({ id: users.id }).from(users).where(eq(users.emailNormalized, normalizedEmail)).limit(1))[0] : undefined;
      return { available: !account } as const;
    }),
    registerCompany: publicProcedure.input(z.object({ companyName: z.string().trim().min(2).max(200), administratorName: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320), password: z.string().min(10).max(256), rememberMe: z.boolean().optional().default(true) })).mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, input.email);
      const db = await requireDb();
      const email = normalizeAuthEmail(input.email);
      if (!email) throw new TRPCError({ code: "BAD_REQUEST", message: "Adresse e-mail invalide." });
      const existingAccount = (await db.select({ id: users.id }).from(users).where(eq(users.emailNormalized, email)).limit(1))[0];
      if (existingAccount) throw new TRPCError({ code: "CONFLICT", message: "Cette adresse e-mail est déjà utilisée." });
      const sessionDurationMs = input.rememberMe ? REMEMBERED_AUTH_SESSION_MS : STANDARD_AUTH_SESSION_MS;
      const openId = `local_admin_${randomUUID()}`;
      const passwordHash = await hashPassword(input.password);
      const { companyId, administratorId } = await db.transaction(async tx => {
        const companyResult = await tx.insert(companies).values({ name: input.companyName }).$returningId();
        const companyId = Number(companyResult[0]?.id);
        const userResult = await tx.insert(users).values({ openId, name: input.administratorName, email, emailNormalized: email, loginMethod: "password", role: "admin", active: true, companyId }).$returningId();
        const administratorId = Number(userResult[0]?.id);
        await tx.update(companies).set({ ownerUserId: administratorId }).where(eq(companies.id, companyId));
        await tx.insert(adminFallbackPasswords).values({ ownerOpenId: openId, passwordHash, updatedByUserId: administratorId });
        await tx.insert(saleSettings).values({ companyId, companyName: input.companyName, companyEmail: email, updatedByUserId: administratorId });
        await tx.insert(warehouses).values({ companyId, name: "Entrepôt principal", code: "PRINCIPAL", active: true, isDefault: true, createdByUserId: administratorId });
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
        const session = (await db.select().from(userSessions).where(and(eq(userSessions.id, input.sessionId), eq(userSessions.userId, ctx.user.id))).limit(1))[0];
        if (!session || session.userId !== ctx.user.id || session.revokedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Session introuvable." });
        await db.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.id, session.id), eq(userSessions.userId, ctx.user.id)));
        return { success: true } as const;
      }),
      revokeOthers: protectedProcedure.mutation(async ({ ctx }) => {
        if (!ctx.user.sessionId) throw new TRPCError({ code: "BAD_REQUEST", message: "Reconnectez-vous pour révoquer les autres sessions." });
        const db = await requireDb();
        const sessions = await db.select().from(userSessions).where(eq(userSessions.userId, ctx.user.id));
        const otherIds = sessions.filter(session => !session.revokedAt && session.id !== ctx.user.sessionId).map(session => session.id);
        await Promise.all(otherIds.map(sessionId => db.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, ctx.user.id)))));
        return { success: true, revokedCount: otherIds.length } as const;
      }),
    }),
    adminFallbackLogin: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, input.email);
      const emailMatches = Boolean(ENV.adminFallbackEmail) && input.email.trim().toLowerCase() === ENV.adminFallbackEmail.trim().toLowerCase();
      if (!emailMatches) {
        console.info("[Auth fallback] Rejected credentials", { reason: "email" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants administrateur incorrects." });
      }
      const db = await requireDb();
      const adminOpenId = ENV.ownerOpenId;
      if (!adminOpenId) {
        console.info("[Auth fallback] Rejected credentials", { reason: "admin-account" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants administrateur incorrects." });
      }
      const configuredAdmin = (await db.select({ id: users.id, openId: users.openId, name: users.name, active: users.active, role: users.role }).from(users).where(eq(users.openId, adminOpenId)).limit(1))[0];
      if (!configuredAdmin || !configuredAdmin.active || configuredAdmin.role !== "admin") {
        console.info("[Auth fallback] Rejected credentials", { reason: "admin-account" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants administrateur incorrects." });
      }
      const override = (await db.select().from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, adminOpenId)).limit(1))[0];
      const passwordValid = override ? await verifyPassword(input.password, override.passwordHash) : legacyAdminFallbackEnabled() && matchesAdminFallbackCredentials(input, { email: ENV.adminFallbackEmail, password: ENV.adminFallbackPassword });
      if (!passwordValid) {
        console.info("[Auth fallback] Rejected credentials", { reason: "password" });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants administrateur incorrects." });
      }
      const sessionId = randomUUID();
      const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"].slice(0, 512) : undefined;
      await db.insert(userSessions).values({ id: sessionId, userId: configuredAdmin.id, deviceLabel: sessionDeviceLabel(userAgent), userAgent: userAgent ?? null, expiresAt: new Date(Date.now() + ONE_YEAR_MS) });
      const token = await sdk.createSessionToken(adminOpenId, { name: configuredAdmin.name || "Administrateur", expiresInMs: ONE_YEAR_MS, sessionId });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      console.info("[Auth fallback] Session issued", { overridePresent: Boolean(override) });
      return { success: true } as const;
    }),
    adminFallbackPasswordChange: adminProcedure.input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(256) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const override = (await db.select().from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, ctx.user.openId)).limit(1))[0];
      const currentValid = override ? await verifyPassword(input.currentPassword, override.passwordHash) : legacyAdminFallbackEnabled() && matchesAdminFallbackCredentials({ email: ENV.adminFallbackEmail, password: input.currentPassword }, { email: ENV.adminFallbackEmail, password: ENV.adminFallbackPassword });
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
    get: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const companyId = ctx.user.companyId;
      if (input?.warehouseId) await getScopedWarehouse(db, companyId, input.warehouseId, { requireActive: true });
      const salesScope = input?.warehouseId ? and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, input.warehouseId)) : companyScope(sales.companyId, companyId);
      const inventoryScope = input?.warehouseId ? and(companyScope(inventorySessions.companyId, companyId), eq(inventorySessions.warehouseId, input.warehouseId)) : companyScope(inventorySessions.companyId, companyId);
      const expenseScope = input?.warehouseId ? and(companyScope(expenses.companyId, companyId), eq(expenses.warehouseId, input.warehouseId)) : companyScope(expenses.companyId, companyId);
      const paymentScope = input?.warehouseId ? and(companyScope(agentPayments.companyId, companyId), eq(agentPayments.warehouseId, input.warehouseId)) : companyScope(agentPayments.companyId, companyId);
      const [productRows, movements, saleRows, customerRows, inventories, profiles, commissions, payments, expenseRows, budgetRows] = await Promise.all([listProducts(companyId, input?.warehouseId), listMovements(companyId, 250, input?.warehouseId), db.select().from(sales).where(salesScope), db.select().from(customers).where(companyScope(customers.companyId, companyId)), db.select().from(inventorySessions).where(inventoryScope), db.select().from(remunerationProfiles).where(companyScope(remunerationProfiles.companyId, companyId)), companyId === null ? db.select().from(saleCommissions) : Promise.resolve([]), db.select().from(agentPayments).where(paymentScope), db.select().from(expenses).where(expenseScope), db.select().from(expenseBudgets).where(companyScope(expenseBudgets.companyId, companyId))]);
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
      const currentBudget = budgetRows.find(budget => budget.yearMonth === month && (!input?.warehouseId || budget.warehouseId === input.warehouseId));
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
    compareWarehouses: adminProcedure.input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const companyId = ctx.user.companyId;
      const yearMonth = input?.yearMonth ?? new Date().toISOString().slice(0, 7);
      const [warehouseRows, saleRows, expenseRows, paymentRows, budgetRows, catalog, stockRows] = await Promise.all([
        db.select().from(warehouses).where(and(companyScope(warehouses.companyId, companyId), eq(warehouses.active, true))).orderBy(warehouses.name),
        db.select().from(sales).where(companyScope(sales.companyId, companyId)),
        db.select().from(expenses).where(companyScope(expenses.companyId, companyId)),
        db.select().from(agentPayments).where(companyScope(agentPayments.companyId, companyId)),
        db.select().from(expenseBudgets).where(companyScope(expenseBudgets.companyId, companyId)),
        db.select({ id: products.id, purchasePriceCents: products.purchasePriceCents, minimumQuantity: products.minimumQuantity }).from(products).where(companyScope(products.companyId, companyId)),
        db.select().from(warehouseStocks).where(companyScope(warehouseStocks.companyId, companyId)),
      ]);
      const rows = warehouseRows.map(warehouse => {
        const monthlyPaidSales = saleRows.filter(sale => sale.warehouseId === warehouse.id && sale.status === "paid" && sale.createdAt.toISOString().slice(0, 7) === yearMonth);
        const monthlyExpenses = expenseRows.filter(expense => expense.warehouseId === warehouse.id && expense.spentAt.toISOString().slice(0, 7) === yearMonth).reduce((sum, expense) => sum + expense.amountCents, 0);
        const monthlyPayroll = paymentRows.filter(payment => payment.warehouseId === warehouse.id && payment.paidAt.toISOString().slice(0, 7) === yearMonth).reduce((sum, payment) => sum + payment.amountCents, 0);
        const localizedStocks = stockRows.filter(stock => stock.warehouseId === warehouse.id);
        const stockValueCents = localizedStocks.reduce((sum, stock) => sum + stock.quantity * (catalog.find(product => product.id === stock.productId)?.purchasePriceCents ?? 0), 0);
        const lowStockCount = localizedStocks.filter(stock => stock.quantity <= (catalog.find(product => product.id === stock.productId)?.minimumQuantity ?? 0)).length;
        const revenueCents = monthlyPaidSales.reduce((sum, sale) => sum + sale.totalCents, 0);
        const marginCents = monthlyPaidSales.reduce((sum, sale) => sum + sale.netProfitCents, 0);
        const expenseCents = monthlyExpenses + monthlyPayroll;
        const budget = budgetRows.find(item => item.warehouseId === warehouse.id && item.yearMonth === yearMonth);
        return { id: warehouse.id, name: warehouse.name, code: warehouse.code, isDefault: warehouse.isDefault, revenueCents, marginCents, expenseCents, operatingProfitCents: marginCents - expenseCents, invoiceCount: monthlyPaidSales.length, averageBasketCents: monthlyPaidSales.length ? Math.round(revenueCents / monthlyPaidSales.length) : 0, stockValueCents, lowStockCount, budgetCents: budget?.amountCents ?? null, budgetPercent: budget?.amountCents ? Math.round((expenseCents / budget.amountCents) * 100) : null };
      });
      const totals = rows.reduce((sum, row) => ({ revenueCents: sum.revenueCents + row.revenueCents, marginCents: sum.marginCents + row.marginCents, expenseCents: sum.expenseCents + row.expenseCents, operatingProfitCents: sum.operatingProfitCents + row.operatingProfitCents, invoiceCount: sum.invoiceCount + row.invoiceCount, stockValueCents: sum.stockValueCents + row.stockValueCents, lowStockCount: sum.lowStockCount + row.lowStockCount }), { revenueCents: 0, marginCents: 0, expenseCents: 0, operatingProfitCents: 0, invoiceCount: 0, stockValueCents: 0, lowStockCount: 0 });
      return { yearMonth, warehouses: rows.sort((left, right) => right.revenueCents - left.revenueCents || left.name.localeCompare(right.name)), totals };
    }),
  }),

  onboarding: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.companyId === null) return { completed: true, steps: { product: true, customer: true, paymentMethod: true } };
      const db = await requireDb();
      const company = (await db.select().from(companies).where(eq(companies.id, ctx.user.companyId)).limit(1))[0];
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Entreprise introuvable." });
      const [productRows, customerRows, settings] = await Promise.all([
        db.select({ id: products.id }).from(products).where(companyScope(products.companyId, ctx.user.companyId)).limit(1),
        db.select({ id: customers.id }).from(customers).where(companyScope(customers.companyId, ctx.user.companyId)).limit(1),
        db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1),
      ]);
      const activePaymentMethod = Boolean(settings[0] && (settings[0].paymentCashEnabled || settings[0].paymentCardEnabled || settings[0].paymentMobileMoneyEnabled || settings[0].paymentBankTransferEnabled || settings[0].paymentCreditEnabled));
      return { completed: Boolean(company.onboardingCompletedAt || company.onboardingSkippedAt), skipped: Boolean(company.onboardingSkippedAt), steps: { product: productRows.length > 0, customer: customerRows.length > 0, paymentMethod: activePaymentMethod } };
    }),
    complete: adminProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.companyId === null) return { success: true };
      const db = await requireDb();
      const [productRows, customerRows, settings] = await Promise.all([
        db.select({ id: products.id }).from(products).where(companyScope(products.companyId, ctx.user.companyId)).limit(1),
        db.select({ id: customers.id }).from(customers).where(companyScope(customers.companyId, ctx.user.companyId)).limit(1),
        db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1),
      ]);
      const activePaymentMethod = Boolean(settings[0] && (settings[0].paymentCashEnabled || settings[0].paymentCardEnabled || settings[0].paymentMobileMoneyEnabled || settings[0].paymentBankTransferEnabled || settings[0].paymentCreditEnabled));
      if (!productRows.length || !customerRows.length || !activePaymentMethod) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Terminez les trois étapes de démarrage avant de clôturer l’assistant." });
      await db.update(companies).set({ onboardingCompletedAt: new Date() }).where(eq(companies.id, ctx.user.companyId));
      return { success: true };
    }),
    skip: adminProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.companyId === null) return { success: true };
      const db = await requireDb();
      await db.update(companies).set({ onboardingSkippedAt: new Date() }).where(eq(companies.id, ctx.user.companyId));
      return { success: true };
    }),
  }),

  products: router({
    list: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (input?.warehouseId) {
        await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId, { requireActive: true });
      }
      return listProducts(ctx.user.companyId, input?.warehouseId);
    }),
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
        const { priceTiers, retailPriceTiers, wholesalePriceTiers, warehouseId, ...productData } = input;
        const retailTiers = retailPriceTiers.length ? retailPriceTiers : priceTiers;
        const productId = await db.transaction(async tx => { const result = await tx.insert(products).values({ ...productData, companyId: ctx.user.companyId }); const id = Number(result[0].insertId); const targetWarehouse = warehouseId ? await getScopedWarehouse(tx, ctx.user.companyId, warehouseId, { requireActive: true }) : await getDefaultWarehouse(tx, ctx.user.companyId); await tx.insert(warehouseStocks).values({ companyId: ctx.user.companyId, warehouseId: targetWarehouse.id, productId: id, quantity: productData.quantity }); const tiers = [...retailTiers.map(tier => ({ ...tier, productId: id, customerType: "retail" as const })), ...wholesalePriceTiers.map(tier => ({ ...tier, productId: id, customerType: "wholesale" as const }))]; if (tiers.length) await tx.insert(productPriceTiers).values(tiers); return id; });
        await syncStockAlert(productId, ctx.user.companyId);
        await createAudit(ctx.user.id, "Création", "Produit", productId, `Produit ${input.reference} créé`);
        return { success: true, id: productId };
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: "Cette référence produit existe déjà.", cause: error });
      }
    }),
    update: adminProcedure.input(productInput.safeExtend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { id, priceTiers, retailPriceTiers, wholesalePriceTiers, warehouseId: _warehouseId, ...values } = input;
      const retailTiers = retailPriceTiers.length ? retailPriceTiers : priceTiers;
      const current = (await db.select({ id: products.id }).from(products).where(and(eq(products.id, id), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
      await db.transaction(async tx => { await tx.update(products).set(values).where(and(eq(products.id, id), companyScope(products.companyId, ctx.user.companyId))); await tx.delete(productPriceTiers).where(eq(productPriceTiers.productId, id)); const tiers = [...retailTiers.map(tier => ({ ...tier, productId: id, customerType: "retail" as const })), ...wholesalePriceTiers.map(tier => ({ ...tier, productId: id, customerType: "wholesale" as const }))]; if (tiers.length) await tx.insert(productPriceTiers).values(tiers); });
      await syncStockAlert(id, ctx.user.companyId);
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
      const product = (await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.id), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
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
    update: adminProcedure.input(categoryInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = (await db.select().from(productCategories).where(and(eq(productCategories.id, input.id), companyScope(productCategories.companyId, ctx.user.companyId))).limit(1))[0]; if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Catégorie introuvable." }); try { await db.transaction(async tx => { await tx.update(productCategories).set({ name: input.name }).where(and(eq(productCategories.id, input.id), companyScope(productCategories.companyId, ctx.user.companyId))); await tx.update(products).set({ category: input.name }).where(and(eq(products.category, current.name), companyScope(products.companyId, ctx.user.companyId))); }); await createAudit(ctx.user.id, "Modification", "Catégorie", input.id, `Catégorie ${current.name} renommée en ${input.name}`); return { success: true }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette catégorie existe déjà.", cause: error }); } }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = (await db.select().from(productCategories).where(and(eq(productCategories.id, input.id), companyScope(productCategories.companyId, ctx.user.companyId))).limit(1))[0]; if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Catégorie introuvable." }); const usedBy = await db.select({ id: products.id }).from(products).where(and(eq(products.category, current.name), companyScope(products.companyId, ctx.user.companyId))).limit(1); if (!categoryCanBeRemoved(usedBy.length)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette catégorie est utilisée par des produits et ne peut pas être supprimée." }); await db.delete(productCategories).where(and(eq(productCategories.id, input.id), companyScope(productCategories.companyId, ctx.user.companyId))); await createAudit(ctx.user.id, "Suppression", "Catégorie", input.id, `Catégorie ${current.name} supprimée`); return { success: true }; }),
  }),

  units: router({
    list: protectedProcedure.query(async ({ ctx }) => (await requireDb()).select().from(productUnits).where(companyScope(productUnits.companyId, ctx.user.companyId)).orderBy(productUnits.name)),
    create: adminProcedure.input(unitInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); try { const result = await db.insert(productUnits).values({ ...input, companyId: ctx.user.companyId }); const id = Number(result[0].insertId); await createAudit(ctx.user.id, "Création", "Unité", id, `Unité ${input.name} créée`); return { id }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette unité existe déjà.", cause: error }); } }),
    update: adminProcedure.input(unitInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = (await db.select().from(productUnits).where(and(eq(productUnits.id, input.id), companyScope(productUnits.companyId, ctx.user.companyId))).limit(1))[0]; if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Unité introuvable." }); try { await db.transaction(async tx => { await tx.update(productUnits).set({ name: input.name }).where(and(eq(productUnits.id, input.id), companyScope(productUnits.companyId, ctx.user.companyId))); await tx.update(products).set({ unit: input.name }).where(and(eq(products.unit, current.name), companyScope(products.companyId, ctx.user.companyId))); }); await createAudit(ctx.user.id, "Modification", "Unité", input.id, `Unité ${current.name} renommée en ${input.name}`); return { success: true }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette unité existe déjà.", cause: error }); } }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const current = (await db.select().from(productUnits).where(and(eq(productUnits.id, input.id), companyScope(productUnits.companyId, ctx.user.companyId))).limit(1))[0]; if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Unité introuvable." }); const usedBy = await db.select({ id: products.id }).from(products).where(and(eq(products.unit, current.name), companyScope(products.companyId, ctx.user.companyId))).limit(1); if (usedBy.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette unité est utilisée par des produits et ne peut pas être supprimée." }); await db.delete(productUnits).where(and(eq(productUnits.id, input.id), companyScope(productUnits.companyId, ctx.user.companyId))); await createAudit(ctx.user.id, "Suppression", "Unité", input.id, `Unité ${current.name} supprimée`); return { success: true }; }),
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
      const linkedProduct = await db.select({ id: products.id }).from(products).where(and(eq(products.supplierId, input.id), companyScope(products.companyId, ctx.user.companyId))).limit(1);
      if (linkedProduct.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce fournisseur est rattaché à des produits. Détachez-les avant suppression." });
      const linkedOrder = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(and(eq(purchaseOrders.supplierId, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1);
      if (linkedOrder.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce fournisseur possède un historique de bons de commande et ne peut pas être supprimé." });
      await db.delete(suppliers).where(and(eq(suppliers.id, input.id), companyScope(suppliers.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Suppression", "Fournisseur", input.id, `Fournisseur ${supplier.name} supprimé`);
      return { success: true };
    }),
  }),

  purchaseOrders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const orders = await db.select().from(purchaseOrders).where(companyScope(purchaseOrders.companyId, ctx.user.companyId)).orderBy(desc(purchaseOrders.createdAt));
      if (!orders.length) return [];
      const orderIds = new Set(orders.map(order => order.id));
      const [rows, supplierRows] = await Promise.all([
        db.select().from(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, orders.map(order => order.id))),
        db.select().from(suppliers).where(companyScope(suppliers.companyId, ctx.user.companyId)),
      ]);
      return orders.map(order => ({ ...order, supplier: supplierRows.find(supplier => supplier.id === order.supplierId) ?? null, items: rows.filter(item => orderIds.has(item.purchaseOrderId) && item.purchaseOrderId === order.id) }));
    }),
    listBySupplier: protectedProcedure.input(z.object({ supplierId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const supplier = (await db.select().from(suppliers).where(and(eq(suppliers.id, input.supplierId), companyScope(suppliers.companyId, ctx.user.companyId))).limit(1))[0];
      if (!supplier) return [];
      const orders = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.supplierId, input.supplierId), companyScope(purchaseOrders.companyId, ctx.user.companyId))).orderBy(desc(purchaseOrders.createdAt));
      if (!orders.length) return [];
      const rows = await db.select().from(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, orders.map(order => order.id)));
      return orders.map(order => ({ ...order, items: rows.filter(item => item.purchaseOrderId === order.id) }));
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      const [supplier, items] = await Promise.all([
        db.select().from(suppliers).where(and(eq(suppliers.id, order.supplierId), companyScope(suppliers.companyId, ctx.user.companyId))).limit(1),
        db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, order.id)),
      ]);
      return { ...order, supplier: supplier[0] ?? null, items };
    }),
    create: adminProcedure.input(z.object({
      supplierId: z.number().int().positive(),
      warehouseId: z.number().int().positive().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      expectedDeliveryDate: z.coerce.date().nullable().optional(),
      items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive().max(MAX_QUANTITY) })).min(1).max(100),
      deliveryFeeCents: z.number().int().min(0).max(MAX_CENTS).default(0),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const supplier = (await db.select().from(suppliers).where(and(eq(suppliers.id, input.supplierId), companyScope(suppliers.companyId, ctx.user.companyId))).limit(1))[0];
      if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Fournisseur introuvable." });
      const receivingWarehouse = input.warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(db, ctx.user.companyId);
      const settings = (await db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
      const catalog = await db.select().from(products).where(companyScope(products.companyId, ctx.user.companyId));
      const selected = input.items.map(item => {
        const product = catalog.find(value => value.id === item.productId);
        if (!product || product.supplierId !== input.supplierId) throw new TRPCError({ code: "BAD_REQUEST", message: "Chaque produit doit être rattaché à ce fournisseur." });
        return { product, quantity: item.quantity, lineTotalCents: item.quantity * product.purchasePriceCents };
      });
      const subtotalCents = selected.reduce((sum, item) => sum + item.lineTotalCents, 0);
      const totals = calculateCommercialTotals({ subtotalCents, vatRateBasisPoints: settings?.vatEnabled ? settings.vatRateBasisPoints : 0, deliveryFeeCents: input.deliveryFeeCents });
      const orderNumber = `BC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const orderId = await db.transaction(async tx => {
        const result = await tx.insert(purchaseOrders).values({ companyId: ctx.user.companyId, orderNumber, supplierId: input.supplierId, warehouseId: receivingWarehouse.id, subtotalCents: totals.subtotalCents, vatRateBasisPoints: totals.vatRateBasisPoints, vatCents: totals.vatCents, deliveryFeeCents: totals.deliveryFeeCents, totalCents: totals.totalCents, notes: input.notes ?? null, expectedDeliveryDate: input.expectedDeliveryDate ?? null, createdByUserId: ctx.user.id });
        const id = Number(result[0].insertId);
        await tx.insert(purchaseOrderItems).values(selected.map(item => ({ purchaseOrderId: id, productId: item.product.id, productName: item.product.name, productReference: item.product.reference, unit: item.product.unit, quantity: item.quantity, purchasePriceCents: item.product.purchasePriceCents, lineTotalCents: item.lineTotalCents })));
        return id;
      });
      await createAudit(ctx.user.id, "Création", "Bon de commande", orderId, `Bon ${orderNumber} créé pour ${supplier.name}`);
      return { id: orderId, orderNumber, totalCents: totals.totalCents, vatCents: totals.vatCents, deliveryFeeCents: totals.deliveryFeeCents };
    }),
    updateDetails: adminProcedure.input(z.object({ id: z.number().int().positive(), notes: z.string().trim().max(2000).nullable(), expectedDeliveryDate: z.coerce.date().nullable(), deliveryFeeCents: z.number().int().min(0).max(MAX_CENTS).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "received" || order.status === "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce bon ne peut plus être modifié." });
      const update = input.deliveryFeeCents === undefined ? { notes: input.notes, expectedDeliveryDate: input.expectedDeliveryDate } : { notes: input.notes, expectedDeliveryDate: input.expectedDeliveryDate, deliveryFeeCents: input.deliveryFeeCents, totalCents: order.subtotalCents + order.vatCents + input.deliveryFeeCents };
      await db.update(purchaseOrders).set(update).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Modification", "Bon de commande", input.id, `Bon ${order.orderNumber} mis à jour`);
      return { success: true };
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status !== "draft" && order.status !== "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seuls les bons en attente ou annulés peuvent être supprimés." });
      await db.transaction(async tx => {
        await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, input.id));
        await tx.delete(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId)));
      });
      await createAudit(ctx.user.id, "Suppression", "Bon de commande", input.id, `Bon ${order.orderNumber} supprimé`);
      return { success: true };
    }),
    markSent: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "received" || order.status === "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce bon ne peut plus être marqué comme envoyé." });
      if (order.status !== "sent") {
        await db.update(purchaseOrders).set({ status: "sent" }).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId)));
        await createAudit(ctx.user.id, "Envoi", "Bon de commande", input.id, `Bon ${order.orderNumber} marqué comme envoyé`);
      }
      return { success: true, status: "sent" as const };
    }),
    cancel: adminProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "received") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un bon entièrement reçu ne peut pas être annulé." });
      await db.update(purchaseOrders).set({ status: "cancelled", cancellationReason: input.reason, cancelledAt: new Date() }).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Annulation", "Bon de commande", input.id, `Bon ${order.orderNumber} annulé : ${input.reason}`);
      return { success: true, status: "cancelled" as const };
    }),
    receive: adminProcedure.input(z.object({ id: z.number().int().positive(), lines: z.array(z.object({ id: z.number().int().positive(), quantity: z.number().int().positive() })).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
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
        const receivingWarehouse = order.warehouseId ? await getScopedWarehouse(tx, ctx.user.companyId, order.warehouseId, { requireActive: true }) : await getDefaultWarehouse(tx, ctx.user.companyId);
        for (const item of items.filter(value => requestedByItemId.has(value.id))) {
          const receivedNow = requestedByItemId.get(item.id) ?? 0;
          const product = (await tx.select().from(products).where(and(eq(products.id, item.productId), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
          if (!product) throw new TRPCError({ code: "NOT_FOUND", message: `Produit ${item.productName} introuvable.` });
          const resultingQuantity = product.quantity + receivedNow;
          const localStock = await creditWarehouseStock(tx, ctx.user.companyId, receivingWarehouse.id, product.id, receivedNow);
          await tx.update(products).set({ quantity: resultingQuantity }).where(and(eq(products.id, product.id), companyScope(products.companyId, ctx.user.companyId)));
          const quantityUpdate = await tx.update(purchaseOrderItems).set({ receivedQuantity: item.receivedQuantity + receivedNow }).where(and(eq(purchaseOrderItems.id, item.id), eq(purchaseOrderItems.purchaseOrderId, input.id), eq(purchaseOrderItems.receivedQuantity, item.receivedQuantity)));
          const affected = Number((quantityUpdate as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
          if (!affected) throw new TRPCError({ code: "CONFLICT", message: "Ce bon a été modifié. Actualisez la page avant de poursuivre." });
          await tx.insert(stockMovements).values({ companyId: ctx.user.companyId, productId: product.id, warehouseId: receivingWarehouse.id, supplierId: order.supplierId, type: "entry", quantity: receivedNow, previousQuantity: localStock.previousQuantity, resultingQuantity: localStock.resultingQuantity, reason: `Réception partielle du bon ${order.orderNumber}`, createdByUserId: ctx.user.id });
        }
        const complete = items.every(item => item.receivedQuantity + (requestedByItemId.get(item.id) ?? 0) >= item.quantity);
        const status = complete ? "received" : "sent";
        await tx.update(purchaseOrders).set({ status, receivedAt: complete ? new Date() : null }).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId)));
        return { status, complete };
      });
      await createAudit(ctx.user.id, "Réception", "Bon de commande", input.id, `${result.complete ? "Réception complète" : "Réception partielle"} du bon ${order.orderNumber}`);
      return { success: true, alreadyReceived: false, status: result.status, complete: result.complete };
    }),
  }),

  movements: router({
    list: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (input?.warehouseId) await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: true });
      return listMovements(ctx.user.companyId, 100, input?.warehouseId);
    }),
    create: protectedProcedure.input(z.object({
      productId: z.number().int().positive(),
      warehouseId: z.number().int().positive().optional(),
      supplierId: z.number().int().positive().nullable(),
      type: z.enum(["entry", "exit", "adjustment"]),
      quantity: z.number().int().refine(value => value !== 0, "La quantité doit être différente de zéro."),
      reason: z.string().trim().min(3).max(255),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      if (input.supplierId !== null) {
        const supplier = (await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.supplierId), companyScope(suppliers.companyId, ctx.user.companyId))).limit(1))[0];
        if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Fournisseur introuvable." });
      }
      if (ctx.user.role === "seller") {
        if (input.type !== "adjustment" || input.supplierId !== null) throw new TRPCError({ code: "FORBIDDEN", message: "Un vendeur ne peut enregistrer qu’une correction de stock sans fournisseur." });
        const settings = (await db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
        try { assertSellerSensitiveAction(settings, "stock_correction"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Correction de stock non autorisée." }); }
      }
      await db.transaction(async tx => {
        const warehouse = input.warehouseId ? await getScopedWarehouse(tx, ctx.user.companyId, input.warehouseId, { requireActive: true }) : await getDefaultWarehouse(tx, ctx.user.companyId);
        const row = await tx.select().from(products).where(and(eq(products.id, input.productId), companyScope(products.companyId, ctx.user.companyId))).limit(1);
        const product = row[0];
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
        const signedQuantity = signedMovementQuantity(input.type, input.quantity);
        let resultingQuantity: number;
        try {
          resultingQuantity = resultingStock(product.quantity, input.type, input.quantity);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Mouvement invalide." });
        }
        const localStock = signedQuantity > 0
          ? await creditWarehouseStock(tx, ctx.user.companyId, warehouse.id, product.id, signedQuantity)
          : await debitWarehouseStock(tx, ctx.user.companyId, warehouse.id, product.id, Math.abs(signedQuantity));
        await tx.update(products).set({ quantity: resultingQuantity }).where(and(eq(products.id, product.id), companyScope(products.companyId, ctx.user.companyId)));
        await tx.insert(stockMovements).values({
          companyId: ctx.user.companyId,
          productId: product.id,
          warehouseId: warehouse.id,
          supplierId: input.supplierId,
          type: input.type,
          quantity: signedQuantity,
          previousQuantity: localStock.previousQuantity,
          resultingQuantity: localStock.resultingQuantity,
          reason: input.reason,
          createdByUserId: ctx.user.id,
        });
        await tx.insert(auditLogs).values({
          companyId: ctx.user.companyId,
          actorUserId: ctx.user.id,
          action: "Mouvement enregistré",
          entityType: "Mouvement de stock",
          entityId: String(product.id),
          detail: `${input.type} de ${Math.abs(signedQuantity)} ${product.unit} pour ${product.reference} dans ${warehouse.code} : ${input.reason}`,
        });
      });
      await syncStockAlert(input.productId, ctx.user.companyId);
      return { success: true };
    }),
  }),

  bulkDelete: router({
    preview: adminProcedure.input(bulkDeleteSelectionInput).query(async ({ ctx, input }) => inspectBulkDeleteSelection(await requireDb(), ctx.user.companyId, input.resource, input.ids)),
    execute: adminProcedure.input(bulkDeleteSelectionInput.extend({ confirmation: z.string().max(40) })).mutation(async ({ ctx, input }) => {
      if (!hasBulkDeleteConfirmation(input.confirmation)) throw new TRPCError({ code: "BAD_REQUEST", message: `Saisissez exactement « ${BULK_DELETE_CONFIRMATION} » pour confirmer cette suppression.` });
      const db = await requireDb();
      return db.transaction(async tx => {
        const preview = await inspectBulkDeleteSelection(tx, ctx.user.companyId, input.resource, input.ids);
        if (preview.missingIds.length || preview.blocked.length || preview.eligible.length !== preview.requestedCount) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La sélection contient des données protégées, inexistantes ou sorties de votre entreprise. Actualisez l’aperçu avant de recommencer." });
        const ids = preview.eligible.map(candidate => candidate.id);
        if (input.resource === "products") await tx.delete(products).where(and(inArray(products.id, ids), companyScope(products.companyId, ctx.user.companyId)));
        if (input.resource === "suppliers") await tx.delete(suppliers).where(and(inArray(suppliers.id, ids), companyScope(suppliers.companyId, ctx.user.companyId)));
        if (input.resource === "customers") await tx.delete(customers).where(and(inArray(customers.id, ids), companyScope(customers.companyId, ctx.user.companyId)));
        const labels = preview.eligible.map(candidate => candidate.label).join(" · ");
        await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Suppression groupée", entityType: input.resource === "products" ? "Produits" : input.resource === "suppliers" ? "Fournisseurs" : "Clients", entityId: null, detail: `${ids.length} élément(s) supprimé(s) : ${labels.slice(0, 1400)}` });
        return { success: true, deletedCount: ids.length };
      });
    }),
  }),

  audit: router({
    list: adminProcedure.query(({ ctx }) => listAuditLogs(ctx.user.companyId)),
    settings: adminProcedure.query(async ({ ctx }) => {
      const { isSettingsAuditEntry } = await import("./settingsAudit");
      return (await listAuditLogs(ctx.user.companyId)).filter(isSettingsAuditEntry);
    }),
  }),

  users: router({
    list: adminProcedure.query(({ ctx }) => listUsers(ctx.user.companyId)),
    updateRole: adminProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(["admin", "seller"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.id && input.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas retirer votre propre rôle administrateur." });
      }
      const db = await requireDb();
      const target = (await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.id), companyScope(users.companyId, ctx.user.companyId))).limit(1))[0];
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable dans cette entreprise." });
      await db.update(users).set({ role: input.role }).where(and(eq(users.id, input.id), companyScope(users.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Rôle modifié", "Utilisateur", input.id, `Rôle défini sur ${input.role === "admin" ? "administrateur" : "vendeur"}`);
      return { success: true };
    }),
  }),
  support: supportRouter,
  paymentDues: paymentDuesRouter,
  subscriptionBilling: subscriptionBillingRouter,
});

export type AppRouter = typeof appRouter;
