import { desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { agents, auditLogs, customers, products, remunerationProfiles, saleCommissions, saleItems, salePayments, saleSettings, sales, stockAlerts, stockMovements } from "../../drizzle/schema";
import { commissionCents, priceForCustomer } from "../commerceRules";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { resultingStock, signedMovementQuantity } from "../stockRules";
import { settlementResult } from "../transactionRules";
import { discountCents, type DiscountType } from "../discountRules";

const paymentMethod = z.enum(["cash", "card", "mobile_money", "bank_transfer", "credit"]);
const discountInput = z.object({ type: z.enum(["none", "percent", "fixed"]), value: z.number().int().min(0) });
const itemInput = z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive(), discount: discountInput.default({ type: "none", value: 0 }) });
const paymentInput = z.object({ method: paymentMethod, amountCents: z.number().int().positive() });
const agentSelection = z.object({ salesAgentId: z.number().int().positive().nullable(), cashierId: z.number().int().positive().nullable() });

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

function invoiceNumber(channel: "pos" | "invoice") {
  const prefix = channel === "pos" ? "POS" : "FAC";
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-7)}`;
}

async function validateAgents(tx: any, selected: { salesAgentId: number | null; cashierId: number | null }) {
  const settings = (await tx.select().from(saleSettings).limit(1))[0];
  const salesAgentId = selected.salesAgentId ?? settings?.defaultSalesAgentId ?? null;
  const cashierId = selected.cashierId ?? settings?.defaultCashierId ?? null;
  if (settings?.requireSalesAgent && !salesAgentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un agent commercial est requis." });
  if (settings?.requireCashier && !cashierId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un caissier est requis." });
  const ids = [salesAgentId, cashierId].filter((id): id is number => id !== null);
  const selectedAgents = ids.length ? await tx.select().from(agents).where(inArray(agents.id, ids)) : [];
  if (salesAgentId && !selectedAgents.some((agent: any) => agent.id === salesAgentId && agent.type === "sales_agent" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Agent commercial invalide." });
  if (cashierId && !selectedAgents.some((agent: any) => agent.id === cashierId && agent.type === "cashier" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Caissier invalide." });
  return { salesAgentId, cashierId };
}

export const transactionsRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await dbOrThrow();
    const [rows, customerRows] = await Promise.all([
      db.select().from(sales).orderBy(desc(sales.createdAt)).limit(100),
      db.select().from(customers),
    ]);
    const customerNames = new Map(customerRows.map(customer => [customer.id, customer.name]));
    return rows.map(row => ({ ...row, customerName: row.customerId ? customerNames.get(row.customerId) ?? null : null }));
  }),
  createDraft: protectedProcedure.input(z.object({ channel: z.enum(["pos", "invoice"]), customerId: z.number().int().positive().nullable(), note: z.string().trim().max(1000).nullable(), items: z.array(itemInput).min(1), invoiceDiscount: discountInput.default({ type: "none", value: 0 }) }).merge(agentSelection)).mutation(async ({ ctx, input }) => {
    if (input.channel === "invoice" && !input.customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un client est obligatoire pour créer une facture." });
    const db = await dbOrThrow();
    let created: { id: number; invoiceNumber: string; totalCents: number } | null = null;
    await db.transaction(async tx => {
      const customer = input.customerId ? (await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1))[0] : null;
      if (input.customerId && !customer) throw new TRPCError({ code: "NOT_FOUND", message: "Client introuvable." });
      const productIds = input.items.map(item => item.productId);
      const productRows = await tx.select().from(products).where(inArray(products.id, productIds));
      if (productRows.length !== productIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Un produit est introuvable." });
      const lines = input.items.map(item => { const product = productRows.find((row: any) => row.id === item.productId)!; const unitPriceCents = priceForCustomer(customer?.type ?? "ordinary", product.retailPriceCents, product.wholesalePriceCents); const lineSubtotalCents = unitPriceCents * item.quantity; const lineDiscountCents = discountCents(lineSubtotalCents, item.discount.type as DiscountType, item.discount.value); return { product, quantity: item.quantity, unitPriceCents, lineSubtotalCents, lineDiscountCents, discount: item.discount, lineTotalCents: lineSubtotalCents - lineDiscountCents, lineCostCents: product.purchasePriceCents * item.quantity }; });
      const subtotalCents = lines.reduce((sum, line) => sum + line.lineSubtotalCents, 0);
      const lineNetCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
      const invoiceDiscountCents = discountCents(lineNetCents, input.invoiceDiscount.type as DiscountType, input.invoiceDiscount.value);
      const totalCents = lineNetCents - invoiceDiscountCents;
      const totalCostCents = lines.reduce((sum, line) => sum + line.lineCostCents, 0);
      const assigned = await validateAgents(tx, input);
      const number = invoiceNumber(input.channel);
      const result = await tx.insert(sales).values({ invoiceNumber: number, channel: input.channel, customerId: customer?.id ?? null, sellerUserId: ctx.user.id, ...assigned, paymentMethod: "cash", amountPaidCents: 0, subtotalCents, invoiceDiscountType: input.invoiceDiscount.type, invoiceDiscountValue: input.invoiceDiscount.value, invoiceDiscountCents, totalCents, totalCostCents, netProfitCents: totalCents - totalCostCents, note: input.note, status: "draft" });
      const saleId = Number(result[0].insertId);
      for (const line of lines) await tx.insert(saleItems).values({ saleId, productId: line.product.id, productName: line.product.name, productReference: line.product.reference, quantity: line.quantity, unitPriceCents: line.unitPriceCents, purchasePriceCents: line.product.purchasePriceCents, discountType: line.discount.type, discountValue: line.discount.value, discountCents: line.lineDiscountCents, lineSubtotalCents: line.lineSubtotalCents, lineTotalCents: line.lineTotalCents, lineCostCents: line.lineCostCents });
      await tx.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Document créé", entityType: input.channel === "pos" ? "Ticket POS" : "Facture", entityId: String(saleId), detail: `${number} enregistré en attente d’encaissement` });
      created = { id: saleId, invoiceNumber: number, totalCents };
    });
    return created!;
  }),
  checkout: protectedProcedure.input(z.object({ saleId: z.number().int().positive(), settlementMode: z.enum(["full", "partial"]), payments: z.array(paymentInput).min(1), note: z.string().trim().max(1000).nullable().optional() }).merge(agentSelection)).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    let result: { status: "partial" | "paid"; amountPaidCents: number; balanceCents: number } | null = null;
    await db.transaction(async tx => {
      const sale = (await tx.select().from(sales).where(eq(sales.id, input.saleId)).limit(1))[0];
      if (!sale || sale.status === "void") throw new TRPCError({ code: "NOT_FOUND", message: "Vente introuvable." });
      if (sale.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Cette vente est déjà intégralement encaissée." });
      const remainingBefore = sale.totalCents - sale.amountPaidCents;
      let settlement: ReturnType<typeof settlementResult>;
      try { settlement = settlementResult(remainingBefore, input.settlementMode, input.payments.map(payment => payment.amountCents)); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Règlement invalide." }); }
      const assigned = await validateAgents(tx, input);
      const isFirstCollection = sale.status === "draft";
      if (isFirstCollection) {
        const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
        const productRows = await tx.select().from(products).where(inArray(products.id, items.map((item: any) => item.productId)));
        for (const item of items) { const product = productRows.find((row: any) => row.id === item.productId); if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." }); const quantity = resultingStock(product.quantity, "exit", item.quantity); await tx.update(products).set({ quantity }).where(eq(products.id, product.id)); await tx.insert(stockMovements).values({ productId: product.id, type: "exit", quantity: signedMovementQuantity("exit", item.quantity), previousQuantity: product.quantity, resultingQuantity: quantity, reason: `Vente ${sale.invoiceNumber}`, createdByUserId: ctx.user.id }); if (quantity <= product.minimumQuantity) await tx.insert(stockAlerts).values({ productId: product.id, threshold: product.minimumQuantity, observedQuantity: quantity, status: "active" }).onDuplicateKeyUpdate({ set: { observedQuantity: quantity, threshold: product.minimumQuantity, status: "active", resolvedAt: null } }); }
        const profiles = await tx.select().from(remunerationProfiles).where(eq(remunerationProfiles.active, true));
        const beneficiaries = [{ type: "user" as const, id: sale.sellerUserId }, ...(assigned.salesAgentId ? [{ type: "agent" as const, id: assigned.salesAgentId }] : []), ...(assigned.cashierId ? [{ type: "agent" as const, id: assigned.cashierId }] : [])];
        for (const beneficiary of beneficiaries) { const profile = profiles.find((item: any) => item.beneficiaryType === beneficiary.type && item.beneficiaryId === beneficiary.id); if (profile) { const value = commissionCents({ remunerationMode: profile.remunerationMode, commissionBasis: profile.commissionBasis, rateBasisPoints: profile.rateBasisPoints, invoiceRevenueCents: sale.totalCents, invoiceNetProfitCents: sale.netProfitCents }); if (value > 0) await tx.insert(saleCommissions).values({ saleId: sale.id, beneficiaryType: beneficiary.type, beneficiaryId: beneficiary.id, commissionBasis: profile.commissionBasis, rateBasisPoints: profile.rateBasisPoints, commissionCents: value }); } }
      }
      for (const payment of input.payments) await tx.insert(salePayments).values({ saleId: sale.id, method: payment.method, amountCents: payment.amountCents, createdByUserId: ctx.user.id });
      const amountPaidCents = sale.amountPaidCents + settlement.paidCents;
      const status = settlement.status;
      await tx.update(sales).set({ ...assigned, status, amountPaidCents, paymentMethod: input.payments[0].method, note: input.note ?? sale.note }).where(eq(sales.id, sale.id));
      await tx.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Encaissement", entityType: "Vente", entityId: String(sale.id), detail: `${settlement.paidCents} encaissé sur ${sale.invoiceNumber} (${status === "paid" ? "soldée" : "partielle"})` });
      result = { status, amountPaidCents, balanceCents: sale.totalCents - amountPaidCents };
    });
    return result!;
  }),
});
