import { moneyLabel } from "./moneyLabel";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, like, lte, ne, not, or, sql } from "drizzle-orm";
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
  paymentDueOccurrences,
  saleSettings,
  sales,
  sellerCredentials,
  stockAlerts,
  stockLots,
  stockMovements,
  suppliers,
  warehouses,
  warehouseStocks,
  sellerWarehouseAssignments,
  salesAgentWarehouseAssignments,
  userDashboardPreferences,
  userSessions,
  users,
  customRoles,
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
import { isIsoDateOnly, weightedAverageCost } from "./lotRules";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, permissionProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { commerceRouter } from "./routers/commerce";
import { inventoryRouter } from "./routers/inventory";
import { loadPayrollOverview, payrollRouter } from "./routers/payroll";
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
import { accountingRouter } from "./routers/accounting";
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
import { customRolesRouter } from "./routers/customRoles";
import { depotSpaceRouter } from "./routers/depotSpace";
import { cashierSpaceRouter } from "./routers/cashierSpace";
import { agentSpaceRouter } from "./routers/agentSpace";
import { transactionsRouter } from "./routers/transactions";
import { expensesRouter } from "./routers/expenses";
import { documentsRouter } from "./routers/documents";
import { agentPaymentExpenseRows, budgetComparison, expenseBreakdownByCategory, monthlyExpenseTotalCents, operatingNetProfitCents } from "./expenseRules";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { matchesAdminFallbackCredentials } from "./adminFallbackAuth";
import { COMPANY_CODE_PATTERN, availableCompanyCode, ensureCompanyLoginCode, normalizeCompanyCode, resolveLoginAccount, suggestCompanyCode } from "./companyLogin";
import { hashPassword, verifyPassword } from "./passwords";
import { categoryCanBeRemoved } from "./categoryRules";
import { resolveCatalogReferences } from "./catalogReferenceRules";
import { assertSellerSensitiveAction } from "./sellerActionRules";
import { companyScope } from "./companyScope";
import { consumeRateLimit } from "./rateLimit";
import { creditWarehouseStock, debitWarehouseStock, getDefaultWarehouse, getScopedWarehouse, warehouseLowStock, warehouseStockQuantity } from "./warehouseStock";
import { assertSellerWarehouseAccess } from "./sellerWarehouseAccess";
import { normalizeAuthEmail } from "./authEmail";
import { consumePasswordResetToken, issuePasswordResetToken, PASSWORD_RESET_TOKEN_PATTERN } from "./authTokens";
import { emailVerificationRouter } from "./routers/emailVerification";
import { appUrl, accountMailerConfigured, mailerConfigured, sendMail } from "./mailer";
import { can, ROLES, ROLE_LABELS, type Role } from "@shared/permissions";
import { roleChangeRefusal } from "./userRoleRules";
import { findPasswordHash, storePasswordHash } from "./userPasswordStorage";
import { assertSubscriptionQuota } from "./subscriptionQuotas";
import { productImagesRouter } from "./routers/productImages";
import { isReceivableInvoice } from "@shared/saleReceivables";

const productInput = z.object({
  reference: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable(),
  category: z.string().trim().min(2).max(100),
  unit: z.string().trim().min(1).max(30),
  categoryId: z.number().int().positive().optional(),
  unitId: z.number().int().positive().optional(),
  purchasePriceCents: z.number().int().min(0),
  retailPriceCents: z.number().int().min(0),
  wholesalePriceCents: z.number().int().min(0),
  quantity: z.number().int().min(0),
  minimumQuantity: z.number().int().min(0),
  /** Taux personnalisé facultatif en points de base (jusqu’à 100 %). */
  vatRateBasisPoints: z.number().int().min(0).max(10_000).nullable().optional(),
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

/** Rattache les libellés libres/CSV au catalogue de l'entreprise, ou valide les IDs fournis. */
async function resolveCatalogRefs(
  tx: any,
  companyId: number | null,
  labels: { category: string; unit: string },
  ids?: { categoryId?: number; unitId?: number },
) {
  const refs = await resolveCatalogReferences(companyId, labels, {
    findById: async (kind, scopedCompanyId, id) => {
      const table = kind === "category" ? productCategories : productUnits;
      return (await tx.select({ id: table.id, name: table.name }).from(table).where(and(eq(table.id, id), companyScope(table.companyId, scopedCompanyId))).limit(1))[0];
    },
    findByName: async (kind, scopedCompanyId, name) => {
      const table = kind === "category" ? productCategories : productUnits;
      return (await tx.select({ id: table.id }).from(table).where(and(eq(table.name, name), companyScope(table.companyId, scopedCompanyId))).limit(1))[0]?.id;
    },
    create: async (kind, scopedCompanyId, name) => {
      const table = kind === "category" ? productCategories : productUnits;
      const result = await tx.insert(table).values({ companyId: scopedCompanyId, name });
      return Number(result[0].insertId);
    },
  }, ids);
  if ((ids?.categoryId !== undefined && refs.categoryId !== ids.categoryId) || (ids?.unitId !== undefined && refs.unitId !== ids.unitId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Une référence de catégorie ou d’unité n’appartient pas à cette entreprise." });
  }
  return refs;
}

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

/** Prix d’achat masqués : rôles sans accès aux coûts, et rôles personnalisés sans la permission « prix et coûts ». */
function hidesPurchaseCosts(user: { role: string; permissions?: string[] }) {
  if (["agent", "cashier", "storekeeper"].includes(user.role)) return true;
  return user.role === "custom" && !can(user.role, "catalog.price", user.permissions);
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
  documents: documentsRouter,
  emailVerification: emailVerificationRouter,
  agentSpace: agentSpaceRouter,
  cashierSpace: cashierSpaceRouter,
  depotSpace: depotSpaceRouter,
  customRoles: customRolesRouter,
  companyLogin: router({
    /** Code entreprise à saisir à la connexion (attribué s'il manque). */
    get: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return { code: null };
      return { code: await ensureCompanyLoginCode(await requireDb(), ctx.user.companyId) };
    }),
    update: adminProcedure.input(z.object({ code: z.string().trim().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Aucune entreprise associée." });
      const code = normalizeCompanyCode(input.code);
      if (!COMPANY_CODE_PATTERN.test(code)) throw new TRPCError({ code: "BAD_REQUEST", message: "Le code doit contenir 3 à 20 lettres, chiffres ou tirets." });
      const db = await requireDb();
      const taken = (await db.select({ id: companies.id }).from(companies).where(eq(companies.loginCode, code)).limit(1))[0];
      if (taken && taken.id !== ctx.user.companyId) throw new TRPCError({ code: "CONFLICT", message: "Ce code est déjà utilisé par une autre entreprise." });
      await db.update(companies).set({ loginCode: code }).where(eq(companies.id, ctx.user.companyId));
      await createAudit(ctx.user.id, "Modification", "Entreprise", ctx.user.companyId, `Code entreprise de connexion : ${code}`);
      return { code };
    }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    requestPasswordReset: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(async ({ ctx, input }) => {
      const normalizedEmail = normalizeAuthEmail(input.email);
      const identity = requestIdentity(ctx.req);
      if (!consumeRateLimit(`auth:reset:ip:${identity}`, 10, 60 * 60 * 1000) || !consumeRateLimit(`auth:reset:account:${normalizedEmail ?? "invalid"}`, 3, 60 * 60 * 1000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de demandes. Réessayez plus tard." });
      }
      const db = await getDb();
      if (db && normalizedEmail && accountMailerConfigured()) {
        // Une même adresse peut avoir un compte dans plusieurs entreprises : un lien par entreprise.
        const accounts = await db.select({ id: users.id, email: users.email, companyName: companies.name, companyCode: companies.loginCode }).from(users).leftJoin(companies, eq(companies.id, users.companyId)).where(and(or(eq(users.emailNormalized, normalizedEmail), and(isNull(users.emailNormalized), sql`lower(trim(${users.email})) = ${normalizedEmail}`)), eq(users.active, true), inArray(users.role, ROLES))).limit(10);
        for (const account of accounts) {
          if (!account.email) continue;
          const token = await issuePasswordResetToken(db, account.id);
          const link = `${appUrl(ctx.req)}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
          const companyLine = account.companyName ? `Entreprise : ${account.companyName}${account.companyCode ? ` (code ${account.companyCode})` : ""}\n\n` : "";
          await sendMail({ to: account.email, subject: `Réinitialisation de votre mot de passe StockPilot${account.companyName ? ` — ${account.companyName}` : ""}`, text: `${companyLine}Pour choisir un nouveau mot de passe, ouvrez ce lien valable une heure : ${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.` });
        }
      }
      return { success: true } as const;
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().regex(PASSWORD_RESET_TOKEN_PATTERN), password: z.string().min(10).max(256) })).mutation(async ({ ctx, input }) => {
      if (!consumeRateLimit(`auth:reset:consume:${requestIdentity(ctx.req)}`, 10, 60 * 60 * 1000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de tentatives. Réessayez plus tard." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Le service est temporairement indisponible." });
      const passwordHash = await hashPassword(input.password);
      const updated = await db.transaction(async (tx: any) => {
        const userId = await consumePasswordResetToken(tx, input.token);
        if (!userId) return false;
        const account = (await tx.select().from(users).where(and(eq(users.id, userId), eq(users.active, true), inArray(users.role, ROLES))).limit(1))[0];
        if (!account) return false;
        const credential = await findPasswordHash(tx, account);
        if (!credential) return false;
        await storePasswordHash(tx, account, passwordHash, account.role, userId);
        await tx.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
        return true;
      });
      if (!updated) throw new TRPCError({ code: "BAD_REQUEST", message: "Ce lien est invalide, expiré ou déjà utilisé. Demandez-en un nouveau." });
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user?.sessionId && ctx.user.id > 0) {
        const db = await getDb();
        if (db) await db.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.id, ctx.user.sessionId), eq(userSessions.userId, ctx.user.id)));
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    localLogin: publicProcedure.input(z.object({ companyCode: z.string().trim().max(40).optional(), username: z.string().trim().min(3).max(320), password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, `${normalizeCompanyCode(input.companyCode)}:${input.username}`);
      const db = await requireDb();
      const { account } = await resolveLoginAccount(db, { companyCode: input.companyCode, identifier: input.username, password: input.password });
      const row = { id: account.id, openId: account.openId, name: account.name };
      const sessionId = randomUUID();
      const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"].slice(0, 512) : undefined;
      await db.insert(userSessions).values({ id: sessionId, userId: row.id, deviceLabel: sessionDeviceLabel(userAgent), userAgent: userAgent ?? null, expiresAt: new Date(Date.now() + ONE_YEAR_MS) });
      const token = await sdk.createSessionToken(row.openId, { name: row.name || input.username, expiresInMs: ONE_YEAR_MS, sessionId });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { success: true } as const;
    }),
    passwordLogin: publicProcedure.input(z.object({ companyCode: z.string().trim().max(40).optional(), email: z.string().trim().min(3).max(320), password: z.string().min(1).max(256), rememberMe: z.boolean().optional().default(false) })).mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, `${normalizeCompanyCode(input.companyCode)}:${input.email}`);
      const db = await requireDb();
      const { account, companyCode } = await resolveLoginAccount(db, { companyCode: input.companyCode, identifier: input.email, password: input.password });
      const sessionDurationMs = input.rememberMe ? REMEMBERED_AUTH_SESSION_MS : STANDARD_AUTH_SESSION_MS;
      const sessionId = randomUUID();
      const userAgent = typeof ctx.req.headers["user-agent"] === "string" ? ctx.req.headers["user-agent"].slice(0, 512) : undefined;
      await db.insert(userSessions).values({ id: sessionId, userId: account.id, deviceLabel: sessionDeviceLabel(userAgent), userAgent: userAgent ?? null, expiresAt: new Date(Date.now() + sessionDurationMs) });
      const token = await sdk.createSessionToken(account.openId, { name: account.name || account.email || "Utilisateur", expiresInMs: sessionDurationMs, sessionId });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: sessionDurationMs });
      console.info("[Auth password] Session issued", { role: account.role, remembered: input.rememberMe });
      return { success: true, role: account.role, companyCode } as const;
    }),
    emailAvailability: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).query(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, input.email);
      const db = await requireDb();
      const normalizedEmail = normalizeAuthEmail(input.email);
      const account = normalizedEmail ? (await db.select({ id: users.id }).from(users).where(or(eq(users.emailNormalized, normalizedEmail), and(isNull(users.emailNormalized), sql`lower(trim(${users.email})) = ${normalizedEmail}`))).limit(1))[0] : undefined;
      // Une nouvelle entreprise peut réutiliser un e-mail déjà présent ailleurs : simple information.
      return { available: true, usedElsewhere: Boolean(account) } as const;
    }),
    registerCompany: publicProcedure.input(z.object({ companyName: z.string().trim().min(2).max(200), administratorName: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320), password: z.string().min(10).max(256), rememberMe: z.boolean().optional().default(true) })).mutation(async ({ ctx, input }) => {
      assertLoginRateLimit(ctx.req, input.email);
      const db = await requireDb();
      const email = normalizeAuthEmail(input.email);
      if (!email) throw new TRPCError({ code: "BAD_REQUEST", message: "Adresse e-mail invalide." });
      // Un même e-mail peut administrer plusieurs entreprises : chaque entreprise a son propre compte et son code de connexion.
      const loginCode = await availableCompanyCode(db, suggestCompanyCode(input.companyName));
      const sessionDurationMs = input.rememberMe ? REMEMBERED_AUTH_SESSION_MS : STANDARD_AUTH_SESSION_MS;
      const openId = `local_admin_${randomUUID()}`;
      const passwordHash = await hashPassword(input.password);
      const { companyId, administratorId } = await db.transaction(async tx => {
        const companyResult = await tx.insert(companies).values({ name: input.companyName, loginCode }).$returningId();
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
      return { success: true, companyId, companyCode: loginCode } as const;
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
      if (ctx.user.role === "agent" || ctx.user.role === "cashier") throw new TRPCError({ code: "FORBIDDEN", message: "Le tableau de bord général n’est pas disponible pour votre rôle." });
      const db = await requireDb();
      const companyId = ctx.user.companyId;
      if (ctx.user.role !== "admin") {
        const warehouseId = input?.warehouseId ?? (await warehousesRouter.createCaller(ctx).active()).warehouseId;
        if (!warehouseId) throw new TRPCError({ code: "FORBIDDEN", message: "Aucun entrepôt autorisé." });
        await assertSellerWarehouseAccess(db, ctx.user, warehouseId);
        input = { warehouseId };
      }
      if (input?.warehouseId) await getScopedWarehouse(db, companyId, input.warehouseId, { requireActive: true });
      const salesScope = input?.warehouseId ? and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, input.warehouseId)) : companyScope(sales.companyId, companyId);
      const inventoryScope = input?.warehouseId ? and(companyScope(inventorySessions.companyId, companyId), eq(inventorySessions.warehouseId, input.warehouseId)) : companyScope(inventorySessions.companyId, companyId);
      const expenseScope = input?.warehouseId ? and(companyScope(expenses.companyId, companyId), eq(expenses.warehouseId, input.warehouseId)) : companyScope(expenses.companyId, companyId);
      const paymentScope = input?.warehouseId ? and(companyScope(agentPayments.companyId, companyId), eq(agentPayments.warehouseId, input.warehouseId)) : companyScope(agentPayments.companyId, companyId);
      const [productRows, movements, saleRows, customerRows, inventories, profiles, commissions, payments, expenseRows, budgetRows] = await Promise.all([listProducts(companyId, input?.warehouseId), listMovements(companyId, 250, input?.warehouseId), db.select().from(sales).where(salesScope), db.select().from(customers).where(companyScope(customers.companyId, companyId)), db.select().from(inventorySessions).where(inventoryScope), db.select().from(remunerationProfiles).where(companyScope(remunerationProfiles.companyId, companyId)), companyId === null ? db.select().from(saleCommissions) : Promise.resolve([]), db.select().from(agentPayments).where(paymentScope), db.select().from(expenses).where(expenseScope), db.select().from(expenseBudgets).where(companyScope(expenseBudgets.companyId, companyId))]);
      // Entrepôt affiché : seuls les produits réellement stockés ici peuvent être « sous le seuil »
      // (un entrepôt neuf ou remis à zéro ne signale pas tout le catalogue).
      const warehouseLow = input?.warehouseId ? (await warehouseLowStock(db, companyId, input.warehouseId)).low : null;
      const lowStock = productRows.filter(product => warehouseLow ? warehouseLow.has(product.id) : product.quantity <= product.minimumQuantity);
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
      const canSeeFinance = ["admin", "manager", "accountant"].includes(ctx.user.role) || (ctx.user.role === "custom" && can(ctx.user.role, "finance.notifications", ctx.user.permissions));
      // Paie à régler : même calcul que la page Agents (agents et vendeurs existants uniquement).
      const payroll = await loadPayrollOverview(db, companyId, month, input?.warehouseId);
      const duePayrollCents = payroll.balances.reduce((sum, balance) => sum + Math.max(0, balance.dueCents), 0);
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
      // Accueil : comparaison au même nombre de jours du mois précédent, tendance sur 30 jours
      // (tickets et factures encaissés), meilleures ventes du mois et échéances proches.
      const now = new Date();
      const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const previousMonthCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate(), 23, 59, 59, 999));
      const previousMonthToDateRevenueCents = paidSales.filter(sale => sale.createdAt >= previousMonthStart && sale.createdAt <= previousMonthCutoff && sale.createdAt.getUTCMonth() === previousMonthStart.getUTCMonth()).reduce((sum, sale) => sum + sale.totalCents, 0);
      const days30 = Array.from({ length: 30 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (29 - index)); return date.toISOString().slice(0, 10); });
      const revenueByDay = new Map<string, { revenueCents: number; count: number }>();
      for (const sale of paidSales) { const day = sale.createdAt.toISOString().slice(0, 10); const current = revenueByDay.get(day) ?? { revenueCents: 0, count: 0 }; current.revenueCents += sale.totalCents; current.count += 1; revenueByDay.set(day, current); }
      const salesTrend30 = days30.map(day => ({ day, revenueCents: revenueByDay.get(day)?.revenueCents ?? 0, count: revenueByDay.get(day)?.count ?? 0 }));
      const monthlySaleIds = monthlySales.map(sale => sale.id);
      const monthlyItems = canSeeFinance && monthlySaleIds.length ? await db.select({ productId: saleItems.productId, productName: saleItems.productName, quantity: saleItems.quantity, returnedQuantity: saleItems.returnedQuantity, lineTotalCents: saleItems.lineTotalCents }).from(saleItems).where(inArray(saleItems.saleId, monthlySaleIds)) : [];
      const topByProduct = new Map<number, { productId: number; name: string; quantity: number; revenueCents: number }>();
      for (const item of monthlyItems) { const current = topByProduct.get(item.productId) ?? { productId: item.productId, name: item.productName, quantity: 0, revenueCents: 0 }; current.quantity += item.quantity - (item.returnedQuantity ?? 0); current.revenueCents += item.lineTotalCents; topByProduct.set(item.productId, current); }
      const topProducts = Array.from(topByProduct.values()).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5);
      const receivables = saleRows.filter(isReceivableInvoice);
      const overdueLimit = Date.now() - 30 * 86_400_000;
      const receivableOverdueCount = receivables.filter(sale => sale.createdAt.getTime() < overdueLimit).length;
      const dueSoon = canSeeFinance ? await db.select({ amountCents: paymentDueOccurrences.amountCents, paidCents: paymentDueOccurrences.paidCents }).from(paymentDueOccurrences).where(and(companyScope(paymentDueOccurrences.companyId, companyId), input?.warehouseId ? eq(paymentDueOccurrences.warehouseId, input.warehouseId) : undefined, inArray(paymentDueOccurrences.status, ["upcoming", "due", "overdue", "partially_paid"]), lte(paymentDueOccurrences.dueAt, new Date(Date.now() + 7 * 86_400_000)))) : [];
      return {
        summary: {
          ...(canSeeFinance ? { totalValueCents } : {}),
          productCount: productRows.length,
          activeAlerts: lowStock.length,
          movementCount: movements.length,
          ...(canSeeFinance ? { monthlyRevenueCents, monthlyMarginCents, monthlyExpenseCents, monthlyOperatingProfitCents, expenseBreakdown: expenseBreakdownByCategory([...expenseRows, ...agentExpenseRows], month), monthlyManualExpenseCents, monthlyAgentPaymentCents, expenseBudget, duePayrollCents } : {}),
          ...(canSeeFinance ? { todaySaleCount: todaySales.length, previousMonthToDateRevenueCents, receivableOverdueCount, dueSoonCount: dueSoon.length, dueSoonCents: dueSoon.reduce((sum, row) => sum + Math.max(0, row.amountCents - row.paidCents), 0), receivableCount: saleRows.filter(isReceivableInvoice).length, receivableCents: saleRows.filter(isReceivableInvoice).reduce((sum, sale) => sum + Math.max(0, sale.totalCents - sale.amountPaidCents), 0), monthlyInvoiceCount: monthlySales.length, todayRevenueCents: todaySales.reduce((sum, sale) => sum + sale.totalCents, 0), averageBasketCents: monthlySales.length ? Math.round(monthlyRevenueCents / monthlySales.length) : 0 } : {}),
          draftInventories: inventories.filter(inventory => inventory.status === "draft").length,
        },
        lowStock: lowStock.slice(0, 6).map(product => can(ctx.user.role, "catalog.price", ctx.user.permissions) ? product : { ...product, purchasePriceCents: 0 }),
        recentMovements: movements.slice(0, 6),
        trend,
        ...(canSeeFinance ? { salesTrend, salesTrend30, topProducts,
        recentSales: paidSales.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5).map(sale => { const customer = sale.customerId ? customerMap.get(sale.customerId) : undefined; return { id: sale.id, invoiceNumber: sale.invoiceNumber, channel: sale.channel, status: sale.status, totalCents: sale.totalCents, netProfitCents: sale.netProfitCents, createdAt: sale.createdAt, customerName: customer?.name ?? "Vente comptoir", customerType: customer?.type ?? "ordinary" }; }),
        unpaidInvoices: saleRows.filter(isReceivableInvoice).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5).map(sale => { const customer = sale.customerId ? customerMap.get(sale.customerId) : undefined; return { id: sale.id, invoiceNumber: sale.invoiceNumber, totalCents: sale.totalCents, amountPaidCents: sale.amountPaidCents, balanceCents: Math.max(0, sale.totalCents - sale.amountPaidCents), status: sale.status, createdAt: sale.createdAt, customerName: customer?.name ?? "Client" }; }) } : {}),
      };
    }),
    compareWarehouses: permissionProcedure("audit.view").input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional()).query(async ({ ctx, input }) => {
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
    ...productImagesRouter._def.record,
    list: permissionProcedure("catalog.view").input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      if (input?.warehouseId) {
        await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId, { requireActive: true });
      }
      const rows = await listProducts(ctx.user.companyId, input?.warehouseId);
      // Agent commercial : pas de prix d'achat.
      return hidesPurchaseCosts(ctx.user) ? rows.map(row => ({ ...row, purchasePriceCents: 0 })) : rows;
    }),
    detail: permissionProcedure("catalog.view").input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
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
      const forAgent = hidesPurchaseCosts(ctx.user);
      return { product: forAgent ? { ...product, purchasePriceCents: 0 } : product, supplier, tiers: { retail: tiers.filter(tier => tier.customerType === "retail"), wholesale: tiers.filter(tier => tier.customerType === "wholesale") }, movements: movements.slice(0, 12), sales: saleRows.slice(0, 8).map(sale => forAgent ? { ...sale, netProfitCents: 0, costCents: 0 } : sale), statistics: hidesPurchaseCosts(ctx.user) ? { revenueCents, costCents: 0, grossMarginCents: 0, marginRate: 0, unitsSold, saleCount: uniqueSaleIds.length, lastSaleAt: saleRows[0]?.createdAt ?? null } : { revenueCents, costCents, grossMarginCents: revenueCents - costCents, marginRate: revenueCents > 0 ? Math.round(((revenueCents - costCents) / revenueCents) * 1000) / 10 : 0, unitsSold, saleCount: uniqueSaleIds.length, lastSaleAt: saleRows[0]?.createdAt ?? null } };
    }),
    create: permissionProcedure("catalog.manage").input(productInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        const { priceTiers, retailPriceTiers, wholesalePriceTiers, warehouseId, categoryId, unitId, ...productData } = input;
        const retailTiers = retailPriceTiers.length ? retailPriceTiers : priceTiers;
        const productId = await db.transaction(async tx => { await assertSubscriptionQuota(tx, ctx.user.companyId, "products"); const refs = await resolveCatalogRefs(tx, ctx.user.companyId, productData, { categoryId, unitId }); const result = await tx.insert(products).values({ ...productData, category: refs.category, unit: refs.unit, categoryId: refs.categoryId, unitId: refs.unitId, companyId: ctx.user.companyId }); const id = Number(result[0].insertId); const targetWarehouse = warehouseId ? await getScopedWarehouse(tx, ctx.user.companyId, warehouseId, { requireActive: true }) : await getDefaultWarehouse(tx, ctx.user.companyId); await tx.insert(warehouseStocks).values({ companyId: ctx.user.companyId, warehouseId: targetWarehouse.id, productId: id, quantity: productData.quantity }); const tiers = [...retailTiers.map(tier => ({ ...tier, productId: id, customerType: "retail" as const })), ...wholesalePriceTiers.map(tier => ({ ...tier, productId: id, customerType: "wholesale" as const }))]; if (tiers.length) await tx.insert(productPriceTiers).values(tiers); return id; });
        await syncStockAlert(productId, ctx.user.companyId);
        await createAudit(ctx.user.id, "Création", "Produit", productId, `Produit ${input.reference} créé`);
        return { success: true, id: productId };
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: "Cette référence produit existe déjà.", cause: error });
      }
    }),
    update: permissionProcedure("catalog.manage").input(productInput.safeExtend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { id, priceTiers, retailPriceTiers, wholesalePriceTiers, warehouseId, categoryId, unitId, quantity: requestedQuantity, ...values } = input;
      const retailTiers = retailPriceTiers.length ? retailPriceTiers : priceTiers;
      const current = (await db.select({ id: products.id }).from(products).where(and(eq(products.id, id), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
      await db.transaction(async tx => { const refs = await resolveCatalogRefs(tx, ctx.user.companyId, values, { categoryId, unitId }); await tx.update(products).set({ ...values, category: refs.category, unit: refs.unit, categoryId: refs.categoryId, unitId: refs.unitId }).where(and(eq(products.id, id), companyScope(products.companyId, ctx.user.companyId))); await tx.delete(productPriceTiers).where(eq(productPriceTiers.productId, id)); const tiers = [...retailTiers.map(tier => ({ ...tier, productId: id, customerType: "retail" as const })), ...wholesalePriceTiers.map(tier => ({ ...tier, productId: id, customerType: "wholesale" as const }))]; if (tiers.length) await tx.insert(productPriceTiers).values(tiers);  
        // Le stock saisi sur la fiche est celui de l'entrepôt actif : l'écart devient un ajustement tracé
        // (stock de l'entrepôt, total du produit et mouvement), comme une correction manuelle.
        const warehouse = warehouseId ? await getScopedWarehouse(tx, ctx.user.companyId, warehouseId, { requireActive: true }) : await getDefaultWarehouse(tx, ctx.user.companyId);
        const localQuantity = await warehouseStockQuantity(tx, ctx.user.companyId, warehouse.id, id);
        const delta = requestedQuantity - localQuantity;
        if (delta !== 0) {
          const localStock = delta > 0 ? await creditWarehouseStock(tx, ctx.user.companyId, warehouse.id, id, delta) : await debitWarehouseStock(tx, ctx.user.companyId, warehouse.id, id, -delta);
          // Total du produit = somme des stocks d'entrepôt (corrige aussi les totaux faussés par d'anciennes modifications).
          const [total] = await tx.select({ quantity: sql<number>`coalesce(sum(${warehouseStocks.quantity}), 0)` }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, ctx.user.companyId), eq(warehouseStocks.productId, id)));
          await tx.update(products).set({ quantity: Number(total?.quantity ?? 0) }).where(and(eq(products.id, id), companyScope(products.companyId, ctx.user.companyId)));
          await tx.insert(stockMovements).values({ companyId: ctx.user.companyId, productId: id, warehouseId: warehouse.id, supplierId: null, type: "adjustment", quantity: delta, previousQuantity: localStock.previousQuantity, resultingQuantity: localStock.resultingQuantity, reason: "Correction du stock depuis la fiche produit", createdByUserId: ctx.user.id });
        }
      });
      await syncStockAlert(id, ctx.user.companyId);
      await createAudit(ctx.user.id, "Modification", "Produit", id, `Produit ${values.reference} modifié`);
      return { success: true };
    }),
    updatePurchasePrice: permissionProcedure("catalog.price").input(z.object({ id: z.number().int().positive(), purchasePriceCents: z.number().int().min(0) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const product = (await db.select().from(products).where(and(eq(products.id, input.id), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
      if (ctx.user.role === "seller") {
        const settings = (await db.select().from(saleSettings).limit(1))[0];
        try { assertSellerSensitiveAction(settings, "purchase_price"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Modification du coût d’achat non autorisée." }); }
      }
      await db.update(products).set({ purchasePriceCents: input.purchasePriceCents }).where(and(eq(products.id, product.id), companyScope(products.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Coût d’achat modifié", "Produit", product.id, `${product.reference} : ${moneyLabel(product.purchasePriceCents)} → ${moneyLabel(input.purchasePriceCents)}`);
      return { success: true };
    }),
    remove: permissionProcedure("catalog.manage").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const product = (await db.select({ id: products.id, imageUrl: products.imageUrl, imageThumbUrl: products.imageThumbUrl }).from(products).where(and(eq(products.id, input.id), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
      // Les traces laissées par d'anciennes réinitialisations d'entrepôt ne comptent pas comme un historique.
      const resetTrace = and(isNull(stockMovements.warehouseId), eq(stockMovements.type, "adjustment"), like(stockMovements.reason, "Réinitialisation de l’entrepôt%"));
      const blocking = await db.select({ warehouseId: stockMovements.warehouseId, count: sql<number>`count(*)` }).from(stockMovements).where(and(eq(stockMovements.productId, input.id), companyScope(stockMovements.companyId, ctx.user.companyId), not(resetTrace!))).groupBy(stockMovements.warehouseId);
      if (blocking.length) {
        const warehouseRows = await db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(companyScope(warehouses.companyId, ctx.user.companyId));
        const names = blocking.map(row => row.warehouseId == null ? "historique antérieur aux entrepôts" : warehouseRows.find(w => w.id === row.warehouseId)?.name ?? `entrepôt n°${row.warehouseId}`);
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Ce produit a des mouvements de stock (${names.join(", ")}) et ne peut pas être supprimé. Réinitialisez l’entrepôt concerné ou conservez le produit.` });
      }
      await db.transaction(async (tx: any) => {
        const locked = (await tx.select({ id: products.id, imageUrl: products.imageUrl, imageThumbUrl: products.imageThumbUrl }).from(products).where(and(eq(products.id, input.id), companyScope(products.companyId, ctx.user.companyId))).for("update").limit(1))[0];
        if (!locked) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." });
        await tx.delete(stockMovements).where(and(eq(stockMovements.productId, input.id), companyScope(stockMovements.companyId, ctx.user.companyId), resetTrace!));
        await tx.delete(products).where(and(eq(products.id, input.id), companyScope(products.companyId, ctx.user.companyId)));
      });
      const { deleteProductImageFiles } = await import("./productImages");
      await deleteProductImageFiles([product.imageUrl, product.imageThumbUrl]);
      await createAudit(ctx.user.id, "Suppression", "Produit", input.id, "Produit supprimé");
      return { success: true };
    }),
  }),

  categories: router({
    list: permissionProcedure("catalog.view").query(async ({ ctx }) => (await requireDb()).select().from(productCategories).where(companyScope(productCategories.companyId, ctx.user.companyId)).orderBy(productCategories.name)),
    create: permissionProcedure("catalog.manage").input(categoryInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); try { const result = await db.insert(productCategories).values({ ...input, companyId: ctx.user.companyId }); const id = Number(result[0].insertId); await createAudit(ctx.user.id, "Création", "Catégorie", id, `Catégorie ${input.name} créée`); return { id }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette catégorie existe déjà.", cause: error }); } }),
    update: permissionProcedure("catalog.manage").input(categoryInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const current = (await db.select().from(productCategories).where(and(eq(productCategories.id, input.id), companyScope(productCategories.companyId, ctx.user.companyId))).limit(1))[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Catégorie introuvable." });
      try {
        await db.transaction(async tx => {
          await tx.update(productCategories).set({ name: input.name }).where(and(eq(productCategories.id, input.id), companyScope(productCategories.companyId, ctx.user.companyId)));
          await tx.update(products).set({ category: input.name, categoryId: input.id }).where(and(or(eq(products.categoryId, input.id), and(isNull(products.categoryId), eq(products.category, current.name))), companyScope(products.companyId, ctx.user.companyId)));
        });
        await createAudit(ctx.user.id, "Modification", "Catégorie", input.id, `Catégorie ${current.name} renommée en ${input.name}`);
        return { success: true };
      } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette catégorie existe déjà.", cause: error }); }
    }),
    remove: permissionProcedure("catalog.manage").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const current = (await db.select().from(productCategories).where(and(eq(productCategories.id, input.id), companyScope(productCategories.companyId, ctx.user.companyId))).limit(1))[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Catégorie introuvable." });
      const usedBy = await db.select({ id: products.id }).from(products).where(and(or(eq(products.categoryId, input.id), and(isNull(products.categoryId), eq(products.category, current.name))), companyScope(products.companyId, ctx.user.companyId))).limit(1);
      if (!categoryCanBeRemoved(usedBy.length)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette catégorie est utilisée par des produits et ne peut pas être supprimée." });
      await db.delete(productCategories).where(and(eq(productCategories.id, input.id), companyScope(productCategories.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Suppression", "Catégorie", input.id, `Catégorie ${current.name} supprimée`);
      return { success: true };
    }),
  }),

  units: router({
    list: permissionProcedure("catalog.view").query(async ({ ctx }) => (await requireDb()).select().from(productUnits).where(companyScope(productUnits.companyId, ctx.user.companyId)).orderBy(productUnits.name)),
    create: permissionProcedure("catalog.manage").input(unitInput).mutation(async ({ ctx, input }) => { const db = await requireDb(); try { const result = await db.insert(productUnits).values({ ...input, companyId: ctx.user.companyId }); const id = Number(result[0].insertId); await createAudit(ctx.user.id, "Création", "Unité", id, `Unité ${input.name} créée`); return { id }; } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette unité existe déjà.", cause: error }); } }),
    update: permissionProcedure("catalog.manage").input(unitInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const current = (await db.select().from(productUnits).where(and(eq(productUnits.id, input.id), companyScope(productUnits.companyId, ctx.user.companyId))).limit(1))[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Unité introuvable." });
      try {
        await db.transaction(async tx => {
          await tx.update(productUnits).set({ name: input.name }).where(and(eq(productUnits.id, input.id), companyScope(productUnits.companyId, ctx.user.companyId)));
          await tx.update(products).set({ unit: input.name, unitId: input.id }).where(and(or(eq(products.unitId, input.id), and(isNull(products.unitId), eq(products.unit, current.name))), companyScope(products.companyId, ctx.user.companyId)));
        });
        await createAudit(ctx.user.id, "Modification", "Unité", input.id, `Unité ${current.name} renommée en ${input.name}`);
        return { success: true };
      } catch (error) { throw new TRPCError({ code: "CONFLICT", message: "Cette unité existe déjà.", cause: error }); }
    }),
    remove: permissionProcedure("catalog.manage").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const current = (await db.select().from(productUnits).where(and(eq(productUnits.id, input.id), companyScope(productUnits.companyId, ctx.user.companyId))).limit(1))[0];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Unité introuvable." });
      const usedBy = await db.select({ id: products.id }).from(products).where(and(or(eq(products.unitId, input.id), and(isNull(products.unitId), eq(products.unit, current.name))), companyScope(products.companyId, ctx.user.companyId))).limit(1);
      if (usedBy.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette unité est utilisée par des produits et ne peut pas être supprimée." });
      await db.delete(productUnits).where(and(eq(productUnits.id, input.id), companyScope(productUnits.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Suppression", "Unité", input.id, `Unité ${current.name} supprimée`);
      return { success: true };
    }),
  }),

  suppliers: router({
    list: protectedProcedure.query(({ ctx }) => listSuppliers(ctx.user.companyId)),
    create: permissionProcedure("purchasing.manage").input(supplierInput).mutation(async ({ ctx, input }) => {
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
    remove: permissionProcedure("purchasing.manage").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
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
    get: permissionProcedure("customers.view").input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      const [supplier, items] = await Promise.all([
        db.select().from(suppliers).where(and(eq(suppliers.id, order.supplierId), companyScope(suppliers.companyId, ctx.user.companyId))).limit(1),
        db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, order.id)),
      ]);
      return { ...order, supplier: supplier[0] ?? null, items };
    }),
    create: permissionProcedure("purchasing.manage").input(z.object({
      supplierId: z.number().int().positive(),
      warehouseId: z.number().int().positive().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      expectedDeliveryDate: z.coerce.date().nullable().optional(),
      items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive().max(MAX_QUANTITY), unitPriceCents: z.number().int().min(0).max(MAX_CENTS).optional() })).min(1).max(100),
      deliveryFeeCents: z.number().int().min(0).max(MAX_CENTS).default(0),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const supplier = (await db.select().from(suppliers).where(and(eq(suppliers.id, input.supplierId), companyScope(suppliers.companyId, ctx.user.companyId))).limit(1))[0];
      if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Fournisseur introuvable." });
      const receivingWarehouse = await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId ?? (await getDefaultWarehouse(db, ctx.user.companyId)).id, { requireActive: true });
      const settings = (await db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
      const catalog = await db.select().from(products).where(companyScope(products.companyId, ctx.user.companyId));
      const selected = input.items.map(item => {
        const product = catalog.find(value => value.id === item.productId);
        if (!product) throw new TRPCError({ code: "BAD_REQUEST", message: "Produit introuvable." });
        const unitPriceCents = item.unitPriceCents ?? product.purchasePriceCents;
        return { product, quantity: item.quantity, unitPriceCents, lineTotalCents: item.quantity * unitPriceCents };
      });
      const subtotalCents = selected.reduce((sum, item) => sum + item.lineTotalCents, 0);
      const totals = calculateCommercialTotals({ subtotalCents, vatRateBasisPoints: settings?.vatEnabled ? settings.vatRateBasisPoints : 0, deliveryFeeCents: input.deliveryFeeCents });
      const orderNumber = `BC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const orderId = await db.transaction(async tx => {
        const result = await tx.insert(purchaseOrders).values({ companyId: ctx.user.companyId, orderNumber, supplierId: input.supplierId, warehouseId: receivingWarehouse.id, subtotalCents: totals.subtotalCents, vatRateBasisPoints: totals.vatRateBasisPoints, vatCents: totals.vatCents, deliveryFeeCents: totals.deliveryFeeCents, totalCents: totals.totalCents, notes: input.notes ?? null, expectedDeliveryDate: input.expectedDeliveryDate ?? null, createdByUserId: ctx.user.id });
        const id = Number(result[0].insertId);
        await tx.insert(purchaseOrderItems).values(selected.map(item => ({ purchaseOrderId: id, productId: item.product.id, productName: item.product.name, productReference: item.product.reference, unit: item.product.unit, quantity: item.quantity, purchasePriceCents: item.unitPriceCents, lineTotalCents: item.lineTotalCents })));
        return id;
      });
      await createAudit(ctx.user.id, "Création", "Bon de commande", orderId, `Bon ${orderNumber} créé pour ${supplier.name}`);
      return { id: orderId, orderNumber, totalCents: totals.totalCents, vatCents: totals.vatCents, deliveryFeeCents: totals.deliveryFeeCents };
    }),
    updateDetails: permissionProcedure("purchasing.manage").input(z.object({ id: z.number().int().positive(), notes: z.string().trim().max(2000).nullable(), expectedDeliveryDate: z.coerce.date().nullable(), deliveryFeeCents: z.number().int().min(0).max(MAX_CENTS).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "received" || order.status === "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce bon ne peut plus être modifié." });
      const update = input.deliveryFeeCents === undefined ? { notes: input.notes, expectedDeliveryDate: input.expectedDeliveryDate } : { notes: input.notes, expectedDeliveryDate: input.expectedDeliveryDate, deliveryFeeCents: input.deliveryFeeCents, totalCents: order.subtotalCents + order.vatCents + input.deliveryFeeCents };
      await db.update(purchaseOrders).set(update).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Modification", "Bon de commande", input.id, `Bon ${order.orderNumber} mis à jour`);
      return { success: true };
    }),
    remove: permissionProcedure("purchasing.manage").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
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
    markSent: permissionProcedure("purchasing.manage").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
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
    cancel: permissionProcedure("purchasing.manage").input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "received") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un bon entièrement reçu ne peut pas être annulé." });
      await db.update(purchaseOrders).set({ status: "cancelled", cancellationReason: input.reason, cancelledAt: new Date() }).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId)));
      await createAudit(ctx.user.id, "Annulation", "Bon de commande", input.id, `Bon ${order.orderNumber} annulé : ${input.reason}`);
      return { success: true, status: "cancelled" as const };
    }),
    receive: permissionProcedure("purchasing.manage").input(z.object({ id: z.number().int().positive(), lines: z.array(z.object({ id: z.number().int().positive(), quantity: z.number().int().positive().max(MAX_QUANTITY), lotNumber: z.string().trim().min(1).max(80).optional(), expiryDate: z.string().refine(isIsoDateOnly, "Date invalide (AAAA-MM-JJ). ").nullable().optional() })).min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, ctx.user.companyId))).limit(1))[0];
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
      if (order.status === "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un bon annulé ne peut pas être réceptionné." });
      if (order.status === "received") return { success: true, alreadyReceived: true, status: "received" as const };
      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, input.id));
      if (!items.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce bon ne contient aucun produit à réceptionner." });
      const requestedByItemId = new Map(input.lines.map(line => [line.id, line.quantity]));
      const lotByItemId = new Map(input.lines.map(line => [line.id, line]));
      if (requestedByItemId.size !== input.lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Une ligne ne peut être réceptionnée qu’une seule fois dans la même opération." });
      for (const line of input.lines) {
        const item = items.find(value => value.id === line.id);
        if (!item) throw new TRPCError({ code: "BAD_REQUEST", message: "Une ligne sélectionnée n’appartient pas à ce bon." });
          if (line.quantity > item.quantity - item.receivedQuantity) throw new TRPCError({ code: "BAD_REQUEST", message: `La quantité reçue dépasse le reliquat de ${item.productName}.` });
          if (line.expiryDate && !line.lotNumber) throw new TRPCError({ code: "BAD_REQUEST", message: "Un numéro de lot est requis lorsqu’une date de péremption est renseignée." });
      }
      const result = await db.transaction(async tx => {
        const receivingWarehouse = await assertSellerWarehouseAccess(tx, ctx.user, order.warehouseId ?? (await getDefaultWarehouse(tx, ctx.user.companyId)).id, { requireActive: true });
        for (const item of items.filter(value => requestedByItemId.has(value.id))) {
          const receivedNow = requestedByItemId.get(item.id) ?? 0;
          const product = (await tx.select().from(products).where(and(eq(products.id, item.productId), companyScope(products.companyId, ctx.user.companyId))).limit(1))[0];
          if (!product) throw new TRPCError({ code: "NOT_FOUND", message: `Produit ${item.productName} introuvable.` });
          const resultingQuantity = product.quantity + receivedNow;
          const localStock = await creditWarehouseStock(tx, ctx.user.companyId, receivingWarehouse.id, product.id, receivedNow, item.purchasePriceCents);
          const receiptLine = lotByItemId.get(item.id);
          const unitCostCents = item.purchasePriceCents;
          const updatedCost = weightedAverageCost(product.quantity, product.purchasePriceCents, receivedNow, unitCostCents);
          await tx.update(products).set({ quantity: resultingQuantity, purchasePriceCents: updatedCost }).where(and(eq(products.id, product.id), companyScope(products.companyId, ctx.user.companyId)));
          if (receiptLine?.lotNumber) await tx.insert(stockLots).values({ companyId: ctx.user.companyId!, warehouseId: receivingWarehouse.id, productId: product.id, lotNumber: receiptLine.lotNumber, expiryDate: receiptLine.expiryDate ?? null, quantity: receivedNow, unitCostCents });
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
      if (input?.warehouseId) await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId, { requireActive: true });
      return listMovements(ctx.user.companyId, 100, input?.warehouseId);
    }),
    create: permissionProcedure("stock.adjust").input(z.object({
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
        const warehouse = await assertSellerWarehouseAccess(tx, ctx.user, input.warehouseId ?? (await getDefaultWarehouse(tx, ctx.user.companyId)).id, { requireActive: true });
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
    list: permissionProcedure("audit.view").query(({ ctx }) => listAuditLogs(ctx.user.companyId)),
    settings: permissionProcedure("audit.view").query(async ({ ctx }) => {
      const { isSettingsAuditEntry } = await import("./settingsAudit");
      return (await listAuditLogs(ctx.user.companyId)).filter(isSettingsAuditEntry);
    }),
  }),

  users: router({
    list: permissionProcedure("users.manage").query(({ ctx }) => listUsers(ctx.user.companyId)),
    updateRole: adminProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(ROLES), customRoleId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      if (input.role === "agent" || input.role === "cashier") throw new TRPCError({ code: "BAD_REQUEST", message: "Les rôles Agent commercial et Caissier se donnent depuis la page Agents (bouton « Donner l’accès »)." });
      const db = await requireDb();
      // Rôle personnalisé : il doit exister dans l’entreprise.
      const customRole = input.role === "custom" ? (input.customRoleId ? (await db.select({ id: customRoles.id, name: customRoles.name }).from(customRoles).where(and(eq(customRoles.id, input.customRoleId), companyScope(customRoles.companyId, ctx.user.companyId))).limit(1))[0] : undefined) : null;
      if (input.role === "custom" && !customRole) throw new TRPCError({ code: "BAD_REQUEST", message: "Choisissez un rôle personnalisé existant." });
      const target = (await db.select({ id: users.id, openId: users.openId, role: users.role, active: users.active, customRoleId: users.customRoleId }).from(users).where(and(eq(users.id, input.id), companyScope(users.companyId, ctx.user.companyId))).limit(1))[0];
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable dans cette entreprise." });
      const owner = (await db.select({ ownerUserId: companies.ownerUserId }).from(companies).where(eq(companies.id, ctx.user.companyId)).limit(1))[0];
      const fallback = (await db.select({ id: adminFallbackPasswords.id }).from(adminFallbackPasswords).where(eq(adminFallbackPasswords.ownerOpenId, target.openId)).limit(1))[0];
      const adminCount = (await db.select({ id: users.id }).from(users).where(and(companyScope(users.companyId, ctx.user.companyId), eq(users.role, "admin"), eq(users.active, true)))).length;
      const refusal = roleChangeRefusal({ actorUserId: ctx.user.id, targetUserId: target.id, targetIsOwner: owner?.ownerUserId === target.id, targetIsFallbackAdmin: Boolean(fallback), activeAdminCount: adminCount, currentRole: target.role as Role, nextRole: input.role as Role });
      if (refusal) {
        const messages = { self: "Vous ne pouvez pas modifier votre propre rôle.", owner: "Le propriétaire de l’entreprise doit rester administrateur.", fallback_admin: "Le compte administrateur de secours doit rester administrateur.", last_admin: "Le dernier administrateur actif ne peut pas être rétrogradé." };
        throw new TRPCError({ code: "BAD_REQUEST", message: messages[refusal] });
      }
      if (target.role === input.role && (input.role !== "custom" || target.customRoleId === customRole?.id)) return { success: true, changed: false };
      await db.transaction(async tx => {
        const storedPassword = await findPasswordHash(tx, target);
        if (storedPassword) await storePasswordHash(tx, target, storedPassword.passwordHash, input.role, ctx.user.id);
        await tx.update(users).set({ role: input.role, customRoleId: customRole?.id ?? null }).where(and(eq(users.id, input.id), companyScope(users.companyId, ctx.user.companyId)));
        await tx.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.userId, input.id), isNull(userSessions.revokedAt)));
        await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Rôle modifié", entityType: "Utilisateur", entityId: String(input.id), detail: `Rôle défini sur ${customRole ? `« ${customRole.name} » (personnalisé)` : ROLE_LABELS[input.role]}; sessions révoquées` });
      });
      return { success: true, changed: true };
    }),
  }),
  support: supportRouter,
  paymentDues: paymentDuesRouter,
  subscriptionBilling: subscriptionBillingRouter,
  accounting: accountingRouter,
});

export type AppRouter = typeof appRouter;
