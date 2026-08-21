import { TRPCError } from "@trpc/server";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  agents, auditLogs, customers, products, remunerationProfiles, saleCommissions,
  saleItems, sales, saleSettings, stockAlerts, stockMovements, users,
} from "../../drizzle/schema";
import { commissionCents, priceForCustomer } from "../commerceRules";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { resultingStock, signedMovementQuantity } from "../stockRules";

const customerInput = z.object({ name: z.string().trim().min(2).max(180), type: z.enum(["ordinary", "wholesale"]), contactName: z.string().trim().max(160).nullable(), email: z.string().trim().email().max(320).nullable(), phone: z.string().trim().max(50).nullable(), address: z.string().trim().max(1000).nullable() });
const agentInput = z.object({ name: z.string().trim().min(2).max(160), type: z.enum(["sales_agent", "cashier"]), email: z.string().trim().email().max(320).nullable(), phone: z.string().trim().max(50).nullable(), active: z.boolean() });

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

async function audit(actorUserId: number, action: string, entityType: string, entityId: string | number | null, detail: string) {
  const db = await dbOrThrow();
  await db.insert(auditLogs).values({ actorUserId, action, entityType, entityId: entityId === null ? null : String(entityId), detail });
}

async function listSales(limit = 100) {
  const db = await dbOrThrow();
  return db.select({ id: sales.id, invoiceNumber: sales.invoiceNumber, status: sales.status, paymentMethod: sales.paymentMethod, totalCents: sales.totalCents, netProfitCents: sales.netProfitCents, createdAt: sales.createdAt, customerName: customers.name, customerType: customers.type, sellerName: users.name, salesAgentName: agents.name })
    .from(sales).innerJoin(customers, eq(sales.customerId, customers.id)).leftJoin(users, eq(sales.sellerUserId, users.id)).leftJoin(agents, eq(sales.salesAgentId, agents.id)).orderBy(desc(sales.createdAt)).limit(limit);
}

export const commerceRouter = router({
  customers: router({
    list: protectedProcedure.query(async () => (await dbOrThrow()).select().from(customers).orderBy(customers.name)),
    create: adminProcedure.input(customerInput).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const result = await db.insert(customers).values(input); const id = Number(result[0].insertId); await audit(ctx.user.id, "Création", "Client", id, `Client ${input.name} créé`); return { id }; }),
    update: adminProcedure.input(customerInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const { id, ...data } = input; await db.update(customers).set(data).where(eq(customers.id, id)); await audit(ctx.user.id, "Modification", "Client", id, `Client ${data.name} modifié`); return { success: true }; }),
  }),
  agents: router({
    list: protectedProcedure.query(async () => (await dbOrThrow()).select().from(agents).orderBy(agents.name)),
    create: adminProcedure.input(agentInput).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const result = await db.insert(agents).values(input); const id = Number(result[0].insertId); await audit(ctx.user.id, "Création", "Agent", id, `Agent ${input.name} créé`); return { id }; }),
    update: adminProcedure.input(agentInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const { id, ...data } = input; await db.update(agents).set(data).where(eq(agents.id, id)); await audit(ctx.user.id, "Modification", "Agent", id, `Agent ${data.name} modifié`); return { success: true }; }),
  }),
  settings: router({
    get: protectedProcedure.query(async () => { const db = await dbOrThrow(); return (await db.select().from(saleSettings).limit(1))[0] ?? null; }),
    save: adminProcedure.input(z.object({ defaultSalesAgentId: z.number().int().positive().nullable(), defaultCashierId: z.number().int().positive().nullable(), requireSalesAgent: z.boolean(), requireCashier: z.boolean(), currency: z.enum(["USD", "EUR", "XOF"]).default("XOF") })).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const current = (await db.select().from(saleSettings).limit(1))[0]; const data = { ...input, updatedByUserId: ctx.user.id }; if (current) await db.update(saleSettings).set(data).where(eq(saleSettings.id, current.id)); else await db.insert(saleSettings).values(data); await audit(ctx.user.id, "Paramètres mis à jour", "Vente", null, `Affectations et devise ${input.currency} mises à jour`); return { success: true }; }),
  }),
  remuneration: router({
    list: adminProcedure.query(async () => (await dbOrThrow()).select().from(remunerationProfiles).orderBy(desc(remunerationProfiles.updatedAt))),
    save: adminProcedure.input(z.object({ beneficiaryType: z.enum(["user", "agent"]), beneficiaryId: z.number().int().positive(), remunerationMode: z.enum(["fixed", "commission", "fixed_plus_commission"]), fixedMonthlyCents: z.number().int().min(0), commissionBasis: z.enum(["revenue", "net_profit"]), rateBasisPoints: z.number().int().min(0).max(10000), active: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const current = (await db.select().from(remunerationProfiles)).find(item => item.beneficiaryType === input.beneficiaryType && item.beneficiaryId === input.beneficiaryId); if (current) await db.update(remunerationProfiles).set(input).where(eq(remunerationProfiles.id, current.id)); else await db.insert(remunerationProfiles).values(input); await audit(ctx.user.id, "Rémunération configurée", "Agent", input.beneficiaryId, "Profil de rémunération mis à jour"); return { success: true }; }),
  }),
  sales: router({
    list: protectedProcedure.query(() => listSales()),
    detail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => { const db = await dbOrThrow(); const sale = (await db.select().from(sales).where(eq(sales.id, input.id)).limit(1))[0]; if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Facture introuvable." }); const [customer, items, commissions] = await Promise.all([(await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1))[0], db.select().from(saleItems).where(eq(saleItems.saleId, sale.id)), db.select().from(saleCommissions).where(eq(saleCommissions.saleId, sale.id))]); return { sale, customer, items, commissions }; }),
    create: protectedProcedure.input(z.object({ customerId: z.number().int().positive(), salesAgentId: z.number().int().positive().nullable(), cashierId: z.number().int().positive().nullable(), paymentMethod: z.enum(["cash", "card", "mobile_money", "bank_transfer", "credit"]), note: z.string().trim().max(1000).nullable(), items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1) })).mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const invoiceNumber = `FAC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-7)}`;
      await db.transaction(async tx => {
        const [customer] = await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Client introuvable." });
        const settings = (await tx.select().from(saleSettings).limit(1))[0];
        const salesAgentId = input.salesAgentId ?? settings?.defaultSalesAgentId ?? null;
        const cashierId = input.cashierId ?? settings?.defaultCashierId ?? null;
        if (settings?.requireSalesAgent && !salesAgentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un agent commercial est requis pour cette vente." });
        if (settings?.requireCashier && !cashierId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un caissier est requis pour cette vente." });
        const associatedIds = [salesAgentId, cashierId].filter((id): id is number => id !== null);
        const selectedAgents = associatedIds.length ? await tx.select().from(agents).where(inArray(agents.id, associatedIds)) : [];
        if (salesAgentId && !selectedAgents.some(agent => agent.id === salesAgentId && agent.type === "sales_agent" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Agent commercial invalide." });
        if (cashierId && !selectedAgents.some(agent => agent.id === cashierId && agent.type === "cashier" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Caissier invalide." });
        const productIds = input.items.map(item => item.productId);
        const productRows = await tx.select().from(products).where(inArray(products.id, productIds));
        if (productRows.length !== productIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Un produit de la vente est introuvable." });
        const lines = input.items.map(item => { const product = productRows.find(row => row.id === item.productId)!; const unitPriceCents = priceForCustomer(customer.type, product.retailPriceCents, product.wholesalePriceCents); const lineTotalCents = unitPriceCents * item.quantity; const lineCostCents = product.purchasePriceCents * item.quantity; const resultingQuantity = resultingStock(product.quantity, "exit", item.quantity); return { product, quantity: item.quantity, unitPriceCents, lineTotalCents, lineCostCents, resultingQuantity }; });
        const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0); const totalCostCents = lines.reduce((sum, line) => sum + line.lineCostCents, 0); const netProfitCents = totalCents - totalCostCents;
        const result = await tx.insert(sales).values({ invoiceNumber, customerId: customer.id, sellerUserId: ctx.user.id, salesAgentId, cashierId, paymentMethod: input.paymentMethod, subtotalCents: totalCents, totalCents, totalCostCents, netProfitCents, note: input.note });
        const saleId = Number(result[0].insertId);
        for (const line of lines) { await tx.insert(saleItems).values({ saleId, productId: line.product.id, productName: line.product.name, productReference: line.product.reference, quantity: line.quantity, unitPriceCents: line.unitPriceCents, purchasePriceCents: line.product.purchasePriceCents, lineTotalCents: line.lineTotalCents, lineCostCents: line.lineCostCents }); await tx.update(products).set({ quantity: line.resultingQuantity }).where(eq(products.id, line.product.id)); await tx.insert(stockMovements).values({ productId: line.product.id, type: "exit", quantity: signedMovementQuantity("exit", line.quantity), previousQuantity: line.product.quantity, resultingQuantity: line.resultingQuantity, reason: `Vente ${invoiceNumber}`, createdByUserId: ctx.user.id }); const existingAlert = (await tx.select().from(stockAlerts).where(eq(stockAlerts.productId, line.product.id)).limit(1))[0]; if (line.resultingQuantity <= line.product.minimumQuantity) { if (existingAlert) await tx.update(stockAlerts).set({ threshold: line.product.minimumQuantity, observedQuantity: line.resultingQuantity, status: "active", resolvedAt: null }).where(eq(stockAlerts.id, existingAlert.id)); else await tx.insert(stockAlerts).values({ productId: line.product.id, threshold: line.product.minimumQuantity, observedQuantity: line.resultingQuantity }); } }
        const profiles = await tx.select().from(remunerationProfiles).where(eq(remunerationProfiles.active, true));
        const beneficiaries = [{ type: "user" as const, id: ctx.user.id }, ...(salesAgentId ? [{ type: "agent" as const, id: salesAgentId }] : []), ...(cashierId ? [{ type: "agent" as const, id: cashierId }] : [])];
        for (const beneficiary of beneficiaries) { const profile = profiles.find(item => item.beneficiaryType === beneficiary.type && item.beneficiaryId === beneficiary.id); if (profile) { const amount = commissionCents({ remunerationMode: profile.remunerationMode, commissionBasis: profile.commissionBasis, rateBasisPoints: profile.rateBasisPoints, invoiceRevenueCents: totalCents, invoiceNetProfitCents: netProfitCents }); if (amount > 0) await tx.insert(saleCommissions).values({ saleId, beneficiaryType: beneficiary.type, beneficiaryId: beneficiary.id, commissionBasis: profile.commissionBasis, rateBasisPoints: profile.rateBasisPoints, commissionCents: amount }); } }
        await tx.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Vente créée", entityType: "Facture", entityId: String(saleId), detail: `Facture ${invoiceNumber} créée pour ${customer.name}` });
      });
      return { success: true, invoiceNumber };
    }),
  }),
});
