import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { agents, auditLogs, customers, productPriceTiers, products, remunerationProfiles, saleCommissions, saleItems, salePayments, saleSettings, sales, stockAlerts, stockMovements } from "../../drizzle/schema";
import { commissionCents, priceForCustomer, priceForQuantityTier } from "../commerceRules";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { resultingStock, signedMovementQuantity } from "../stockRules";
import { assertPaymentMethodsEnabled, settlementResult } from "../transactionRules";
import { discountCents, type DiscountType } from "../discountRules";
import { assertExplicitInvoiceAgentChoice } from "../agentSelectionRules";
import { assertSellerSensitiveAction } from "../sellerActionRules";
import { assertSellerDiscount, assertSellerUnitPrice } from "../sellerPriceRules";
import { companyScope } from "../companyScope";

const paymentMethod = z.enum(["cash", "card", "mobile_money", "bank_transfer", "credit"]);
const discountInput = z.object({ type: z.enum(["none", "percent", "fixed"]), value: z.number().int().min(0) });
const itemInput = z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive(), manualUnitPriceCents: z.number().int().positive().nullable().optional(), discount: discountInput.default({ type: "none", value: 0 }) });
const paymentInput = z.object({ method: paymentMethod, amountCents: z.number().int().positive() });
const agentSelection = z.object({ salesAgentId: z.number().int().positive().nullable(), cashierId: z.number().int().positive().nullable(), salesAgentSelectionMade: z.boolean().optional().default(false), cashierSelectionMade: z.boolean().optional().default(false) });

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

function invoiceNumber(channel: "pos" | "invoice") {
  const prefix = channel === "pos" ? "POS" : "FAC";
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-7)}`;
}

async function validateAgents(tx: any, selected: { salesAgentId: number | null; cashierId: number | null; salesAgentSelectionMade?: boolean; cashierSelectionMade?: boolean }, channel?: "pos" | "invoice") {
  const settings = (await tx.select().from(saleSettings).limit(1))[0];
  const salesAgentId = selected.salesAgentId ?? settings?.defaultSalesAgentId ?? null;
  const cashierId = selected.cashierId ?? settings?.defaultCashierId ?? null;
  if (channel === "invoice") {
    try { assertExplicitInvoiceAgentChoice({ requiresSalesAgentChoice: !settings?.defaultSalesAgentId, requiresCashierChoice: !settings?.defaultCashierId, salesAgentSelectionMade: selected.salesAgentSelectionMade ?? false, cashierSelectionMade: selected.cashierSelectionMade ?? false }); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Sélectionnez les intervenants." }); }
  }
  if (settings?.requireSalesAgent && !salesAgentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un agent commercial est requis." });
  if (settings?.requireCashier && !cashierId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un caissier est requis." });
  const ids = [salesAgentId, cashierId].filter((id): id is number => id !== null);
  const selectedAgents = ids.length ? await tx.select().from(agents).where(inArray(agents.id, ids)) : [];
  if (salesAgentId && !selectedAgents.some((agent: any) => agent.id === salesAgentId && agent.type === "sales_agent" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Agent commercial invalide." });
  if (cashierId && !selectedAgents.some((agent: any) => agent.id === cashierId && agent.type === "cashier" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Caissier invalide." });
  return { salesAgentId, cashierId };
}

export const transactionsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    const [rows, customerRows] = await Promise.all([
      db.select().from(sales).where(companyScope(sales.companyId, ctx.user.companyId)).orderBy(desc(sales.createdAt)).limit(100),
      db.select().from(customers).where(companyScope(customers.companyId, ctx.user.companyId)),
    ]);
    const customerNames = new Map(customerRows.map(customer => [customer.id, customer.name]));
    return rows.map(row => ({ ...row, customerName: row.customerId ? customerNames.get(row.customerId) ?? null : null }));
  }),
  removeDraft: protectedProcedure.input(z.object({ saleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const sale = (await db.select().from(sales).where(eq(sales.id, input.saleId)).limit(1))[0];
    if (!sale || sale.channel !== "invoice") throw new TRPCError({ code: "NOT_FOUND", message: "Facture introuvable." });
    if (sale.status !== "draft" || sale.amountPaidCents > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seules les factures non encaissées peuvent être supprimées." });
    if (ctx.user.role === "seller") { const settings = (await db.select().from(saleSettings).limit(1))[0]; try { assertSellerSensitiveAction(settings, "invoice_cancellation"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Annulation non autorisée." }); } }
    await db.transaction(async tx => { await tx.delete(saleItems).where(eq(saleItems.saleId, sale.id)); await tx.delete(sales).where(eq(sales.id, sale.id)); await tx.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Suppression", entityType: "Facture", entityId: String(sale.id), detail: `Facture ${sale.invoiceNumber} supprimée avant encaissement` }); });
    return { success: true };
  }),
  refund: protectedProcedure.input(z.object({ saleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.transaction(async tx => {
      const sale = (await tx.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1))[0];
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Facture introuvable." });
      if ((sale.status !== "paid" && sale.status !== "partial") || sale.amountPaidCents <= 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seule une facture encaissée ou partiellement encaissée peut être remboursée." });
      if (ctx.user.role === "seller") {
        const settings = (await tx.select().from(saleSettings).limit(1))[0];
        try { assertSellerSensitiveAction(settings, "refund"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Remboursement non autorisé." }); }
      }
      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
      const productRows = items.length ? await tx.select().from(products).where(inArray(products.id, items.map(item => item.productId))) : [];
      if (productRows.length !== items.length) throw new TRPCError({ code: "NOT_FOUND", message: "Un produit de cette facture est introuvable ; le remboursement ne peut pas être finalisé." });
      for (const item of items) {
        const product = productRows.find(row => row.id === item.productId)!;
        const quantity = resultingStock(product.quantity, "entry", item.quantity);
        await tx.update(products).set({ quantity }).where(eq(products.id, product.id));
        await tx.insert(stockMovements).values({ productId: product.id, type: "entry", quantity: signedMovementQuantity("entry", item.quantity), previousQuantity: product.quantity, resultingQuantity: quantity, reason: `Remboursement ${sale.invoiceNumber}`, createdByUserId: ctx.user.id });
        if (quantity <= product.minimumQuantity) await tx.insert(stockAlerts).values({ productId: product.id, threshold: product.minimumQuantity, observedQuantity: quantity, status: "active" }).onDuplicateKeyUpdate({ set: { observedQuantity: quantity, threshold: product.minimumQuantity, status: "active", resolvedAt: null } });
        else await tx.update(stockAlerts).set({ observedQuantity: quantity, status: "resolved", resolvedAt: new Date() }).where(eq(stockAlerts.productId, product.id));
      }
      await tx.delete(saleCommissions).where(eq(saleCommissions.saleId, sale.id));
      await tx.update(sales).set({ status: "void", amountPaidCents: 0 }).where(eq(sales.id, sale.id));
      await tx.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Remboursement", entityType: "Facture", entityId: String(sale.id), detail: `Facture ${sale.invoiceNumber} remboursée pour ${sale.amountPaidCents} centimes ; stock réintégré et commissions annulées.` });
    });
    return { success: true };
  }),
  createDraft: protectedProcedure.input(z.object({ channel: z.enum(["pos", "invoice"]), customerId: z.number().int().positive().nullable(), note: z.string().trim().max(1000).nullable(), deliveryAddress: z.string().trim().max(1500).nullable().optional(), items: z.array(itemInput).min(1), invoiceDiscount: discountInput.default({ type: "none", value: 0 }), offlineOperationId: z.string().trim().min(8).max(80).optional() }).merge(agentSelection)).mutation(async ({ ctx, input }) => {
    if (input.channel === "invoice" && !input.customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un client est obligatoire pour créer une facture." });
    const db = await dbOrThrow();
    let created: { id: number; invoiceNumber: string; totalCents: number; salesAgentId: number | null; cashierId: number | null } | null = null;
    await db.transaction(async tx => {
      if (input.offlineOperationId) {
        const existing = (await tx.select().from(sales).where(and(eq(sales.offlineOperationId, input.offlineOperationId), eq(sales.sellerUserId, ctx.user.id))).limit(1))[0];
        if (existing) {
          created = { id: existing.id, invoiceNumber: existing.invoiceNumber, totalCents: existing.totalCents, salesAgentId: existing.salesAgentId, cashierId: existing.cashierId };
          return;
        }
      }
      const customer = input.customerId ? (await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1))[0] : null;
      if (input.customerId && !customer) throw new TRPCError({ code: "NOT_FOUND", message: "Client introuvable." });
      const productIds = input.items.map(item => item.productId);
      const productRows = await tx.select().from(products).where(inArray(products.id, productIds));
      if (productRows.length !== productIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Un produit est introuvable." });
      const tierRows = productIds.length ? await tx.select().from(productPriceTiers).where(inArray(productPriceTiers.productId, productIds)) : [];
      const permissions = (await tx.select().from(saleSettings).limit(1))[0];
      const lines = input.items.map(item => { const product = productRows.find((row: any) => row.id === item.productId)!; const isWholesale = customer?.type === "wholesale"; const basePriceCents = priceForCustomer(customer?.type ?? "ordinary", product.retailPriceCents, product.wholesalePriceCents); const applicableTiers = tierRows.filter((tier: any) => tier.productId === product.id && tier.customerType === (isWholesale ? "wholesale" : "retail")); const tariffCents = priceForQuantityTier(basePriceCents, item.quantity, applicableTiers); const unitPriceCents = item.manualUnitPriceCents ?? tariffCents; if (ctx.user.role === "seller") { try { assertSellerUnitPrice(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, tariffCents, unitPriceCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Prix non autorisé." }); } } const lineSubtotalCents = unitPriceCents * item.quantity; const lineDiscountCents = discountCents(lineSubtotalCents, item.discount.type as DiscountType, item.discount.value); if (ctx.user.role === "seller") { try { assertSellerDiscount(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, lineSubtotalCents, lineDiscountCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Remise non autorisée." }); } } return { product, quantity: item.quantity, unitPriceCents, lineSubtotalCents, lineDiscountCents, discount: item.discount, lineTotalCents: lineSubtotalCents - lineDiscountCents, lineCostCents: product.purchasePriceCents * item.quantity }; });
      const subtotalCents = lines.reduce((sum, line) => sum + line.lineSubtotalCents, 0);
      const lineNetCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
      const invoiceDiscountCents = discountCents(lineNetCents, input.invoiceDiscount.type as DiscountType, input.invoiceDiscount.value);
      if (ctx.user.role === "seller") { try { assertSellerDiscount(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, lineNetCents, invoiceDiscountCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Remise non autorisée." }); } }
      const totalCents = lineNetCents - invoiceDiscountCents;
      const totalCostCents = lines.reduce((sum, line) => sum + line.lineCostCents, 0);
      const assigned = await validateAgents(tx, input, input.channel);
      const number = invoiceNumber(input.channel);
      const result = await tx.insert(sales).values({ invoiceNumber: number, offlineOperationId: input.offlineOperationId, channel: input.channel, customerId: customer?.id ?? null, sellerUserId: ctx.user.id, ...assigned, paymentMethod: "cash", amountPaidCents: 0, subtotalCents, invoiceDiscountType: input.invoiceDiscount.type, invoiceDiscountValue: input.invoiceDiscount.value, invoiceDiscountCents, totalCents, totalCostCents, netProfitCents: totalCents - totalCostCents, note: input.note, deliveryAddress: input.deliveryAddress?.trim() || null, status: "draft" });
      const saleId = Number(result[0].insertId);
      for (const line of lines) await tx.insert(saleItems).values({ saleId, productId: line.product.id, productName: line.product.name, productReference: line.product.reference, quantity: line.quantity, unitPriceCents: line.unitPriceCents, purchasePriceCents: line.product.purchasePriceCents, discountType: line.discount.type, discountValue: line.discount.value, discountCents: line.lineDiscountCents, lineSubtotalCents: line.lineSubtotalCents, lineTotalCents: line.lineTotalCents, lineCostCents: line.lineCostCents });
      await tx.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Document créé", entityType: input.channel === "pos" ? "Ticket POS" : "Facture", entityId: String(saleId), detail: `${number} enregistré en attente d’encaissement` });
      created = { id: saleId, invoiceNumber: number, totalCents, salesAgentId: assigned.salesAgentId, cashierId: assigned.cashierId };
    });
    return created!;
  }),
  checkout: protectedProcedure.input(z.object({ saleId: z.number().int().positive(), settlementMode: z.enum(["full", "partial"]), payments: z.array(paymentInput).min(1), note: z.string().trim().max(1000).nullable().optional(), offlineOperationId: z.string().trim().min(8).max(80).optional() }).merge(agentSelection)).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    let result: { status: "partial" | "paid"; amountPaidCents: number; balanceCents: number } | null = null;
    await db.transaction(async tx => {
      const sale = (await tx.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1))[0];
      if (!sale || sale.status === "void") throw new TRPCError({ code: "NOT_FOUND", message: "Vente introuvable." });
      if (input.offlineOperationId) {
        const existingPayment = (await tx.select().from(salePayments).where(and(eq(salePayments.saleId, sale.id), eq(salePayments.offlineOperationId, input.offlineOperationId))).limit(1))[0];
        if (existingPayment) {
          result = { status: sale.status === "paid" ? "paid" : "partial", amountPaidCents: sale.amountPaidCents, balanceCents: sale.totalCents - sale.amountPaidCents };
          return;
        }
      }
      if (sale.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Cette vente est déjà intégralement encaissée." });
      const remainingBefore = sale.totalCents - sale.amountPaidCents;
      if (sale.channel === "pos" && input.settlementMode !== "full") throw new TRPCError({ code: "BAD_REQUEST", message: "Le POS requiert un règlement intégral." });
      const settings = (await tx.select().from(saleSettings).limit(1))[0];
      try { assertPaymentMethodsEnabled(input.payments.map(payment => payment.method), settings); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Moyen de paiement invalide." }); }
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
      for (let index = 0; index < input.payments.length; index += 1) { const payment = input.payments[index]!; await tx.insert(salePayments).values({ saleId: sale.id, offlineOperationId: index === 0 ? input.offlineOperationId : undefined, method: payment.method, amountCents: payment.amountCents, createdByUserId: ctx.user.id }); }
      const amountPaidCents = sale.amountPaidCents + settlement.paidCents;
      const status = settlement.status;
      await tx.update(sales).set({ ...assigned, status, amountPaidCents, paymentMethod: input.payments[0].method, note: input.note ?? sale.note }).where(eq(sales.id, sale.id));
      await tx.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Encaissement", entityType: "Vente", entityId: String(sale.id), detail: `${settlement.paidCents} encaissé sur ${sale.invoiceNumber} (${status === "paid" ? "soldée" : "partielle"})` });
      result = { status, amountPaidCents, balanceCents: sale.totalCents - amountPaidCents };
    });
    return result!;
  }),
});
