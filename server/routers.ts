import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  agentPayments,
  customers,
  expenses,
  inventorySessions,
  products,
  remunerationProfiles,
  saleCommissions,
  sales,
  sellerCredentials,
  stockAlerts,
  stockMovements,
  suppliers,
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
import { backupRouter } from "./routers/backups";
import { transactionsRouter } from "./routers/transactions";
import { expensesRouter } from "./routers/expenses";
import { expenseBreakdownByCategory, monthlyExpenseTotalCents, operatingNetProfitCents } from "./expenseRules";
import { sdk } from "./_core/sdk";
import { verifyPassword } from "./passwords";

const productInput = z.object({
  reference: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(100),
  unit: z.string().trim().min(1).max(30),
  purchasePriceCents: z.number().int().min(0),
  retailPriceCents: z.number().int().min(0),
  wholesalePriceCents: z.number().int().min(0),
  quantity: z.number().int().min(0),
  minimumQuantity: z.number().int().min(0),
  supplierId: z.number().int().positive().nullable(),
});

const supplierInput = z.object({
  name: z.string().trim().min(2).max(160),
  contactName: z.string().trim().max(160).nullable(),
  email: z.string().trim().email().max(320).nullable(),
  phone: z.string().trim().max(50).nullable(),
});

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
    logout: publicProcedure.mutation(({ ctx }) => {
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
  }),

  dashboard: router({
    get: protectedProcedure.query(async () => {
      const db = await requireDb();
      const [productRows, movements, saleRows, customerRows, inventories, profiles, commissions, payments, expenseRows] = await Promise.all([listProducts(), listMovements(250), db.select().from(sales), db.select().from(customers), db.select().from(inventorySessions), db.select().from(remunerationProfiles), db.select().from(saleCommissions), db.select().from(agentPayments), db.select().from(expenses)]);
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
      const monthlyExpenseCents = monthlyExpenseTotalCents(expenseRows, month);
      const monthlyOperatingProfitCents = operatingNetProfitCents(monthlyMarginCents, monthlyExpenseCents);
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
          expenseBreakdown: expenseBreakdownByCategory(expenseRows, month),
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
      };
    }),
  }),

  products: router({
    list: protectedProcedure.query(() => listProducts()),
    create: adminProcedure.input(productInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      try {
        const result = await db.insert(products).values(input);
        const productId = Number(result[0].insertId);
        await syncStockAlert(productId);
        await createAudit(ctx.user.id, "Création", "Produit", productId, `Produit ${input.reference} créé`);
        return { success: true, id: productId };
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: "Cette référence produit existe déjà.", cause: error });
      }
    }),
    update: adminProcedure.input(productInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      await db.update(products).set(values).where(eq(products.id, id));
      await syncStockAlert(id);
      await createAudit(ctx.user.id, "Modification", "Produit", id, `Produit ${values.reference} modifié`);
      return { success: true };
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const movement = await db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.productId, input.id)).limit(1);
      if (movement.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Un produit avec des mouvements ne peut pas être supprimé." });
      await db.delete(products).where(eq(products.id, input.id));
      await createAudit(ctx.user.id, "Suppression", "Produit", input.id, "Produit supprimé");
      return { success: true };
    }),
  }),

  suppliers: router({
    list: protectedProcedure.query(() => listSuppliers()),
    create: adminProcedure.input(supplierInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const result = await db.insert(suppliers).values(input);
      const supplierId = Number(result[0].insertId);
      await createAudit(ctx.user.id, "Création", "Fournisseur", supplierId, `Fournisseur ${input.name} créé`);
      return { success: true, id: supplierId };
    }),
    update: adminProcedure.input(supplierInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const { id, ...values } = input;
      await db.update(suppliers).set(values).where(eq(suppliers.id, id));
      await createAudit(ctx.user.id, "Modification", "Fournisseur", id, `Fournisseur ${values.name} modifié`);
      return { success: true };
    }),
  }),

  movements: router({
    list: protectedProcedure.query(() => listMovements()),
    create: protectedProcedure.input(z.object({
      productId: z.number().int().positive(),
      supplierId: z.number().int().positive().nullable(),
      type: z.enum(["entry", "exit", "adjustment"]),
      quantity: z.number().int().refine(value => value !== 0, "La quantité doit être différente de zéro."),
      reason: z.string().trim().min(3).max(255),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
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
    list: adminProcedure.query(() => listAuditLogs()),
  }),

  users: router({
    list: adminProcedure.query(() => listUsers()),
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
