import { moneyLabel } from "../moneyLabel";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { agents, auditLogs, customers, documentSequences, productPriceTiers, products, remunerationProfiles, saleCommissions, saleItems, salePayments, saleReturnItems, saleReturns, saleSettings, sales, salesAgentWarehouseAssignments, stockAlerts, stockMovements, vatRatePresets } from "../../drizzle/schema";
import { commissionCents, effectiveCustomerType, priceForCustomer, priceForQuantityTier } from "../commerceRules";
import { getDb } from "../db";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";
import { can } from "@shared/permissions";
import { resultingStock, signedMovementQuantity } from "../stockRules";
import { assertPaymentMethodsEnabled, didApplyExactlyOneStateTransition, settlementResult } from "../transactionRules";
import { discountCents, type DiscountType } from "../discountRules";
import { assertExplicitInvoiceAgentChoice } from "../agentSelectionRules";
import { assertSellerSensitiveAction } from "../sellerActionRules";
import { assertSellerDiscount, assertSellerUnitPrice } from "../sellerPriceRules";
import { companyScope } from "../companyScope";
import { assertSafeDatabaseInt, MAX_CENTS, MAX_DISCOUNT_BASIS_POINTS, MAX_LINE_ITEMS, MAX_QUANTITY } from "../numericLimits";
import { computeVatBreakdown } from "@shared/pricing";
import { assertVatPresetSelection } from "../vatRateRules";
import { creditWarehouseStock, debitWarehouseStock, getDefaultWarehouse, getScopedWarehouse } from "../warehouseStock";
import { assignedWarehouseIds, assertSellerWarehouseAccess } from "../sellerWarehouseAccess";
import { canCoordinateSaleFromWarehouse } from "../salesAgentWarehouseScope";
import { calculatePartialReturn, formatCreditNoteNumber, requestFingerprint } from "../returnRules";

const paymentMethod = z.enum(["cash", "card", "mobile_money", "bank_transfer", "credit"]);
const discountInput = z.object({ type: z.enum(["none", "percent", "fixed"]), value: z.number().int().min(0).max(MAX_CENTS) }).superRefine((value, ctx) => { if (value.type === "percent" && value.value > MAX_DISCOUNT_BASIS_POINTS) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Le pourcentage de remise est invalide." }); });
const itemInput = z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive().max(MAX_QUANTITY), manualUnitPriceCents: z.number().int().positive().max(MAX_CENTS).nullable().optional(), discount: discountInput.default({ type: "none", value: 0 }) });
const paymentInput = z.object({ method: paymentMethod, amountCents: z.number().int().positive().max(MAX_CENTS) });
const agentSelection = z.object({ salesAgentId: z.number().int().positive().nullable(), cashierId: z.number().int().positive().nullable(), salesAgentSelectionMade: z.boolean().optional().default(false), cashierSelectionMade: z.boolean().optional().default(false) });

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

function invoiceNumber(channel: "pos" | "invoice" | "quote") {
  const prefix = channel === "pos" ? "POS" : channel === "quote" ? "DEV" : "FAC";
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString().slice(-7)}`;
}

async function nextCreditNoteSequence(tx: any, companyId: number, year: number) {
  await tx.insert(documentSequences).values({ companyId, series: "AV", year, lastValue: 1 }).onDuplicateKeyUpdate({ set: { lastValue: sql`${documentSequences.lastValue} + 1` } });
  const row = (await tx.select({ lastValue: documentSequences.lastValue }).from(documentSequences).where(and(eq(documentSequences.companyId, companyId), eq(documentSequences.series, "AV"), eq(documentSequences.year, year))).limit(1))[0];
  if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Compteur d’avoirs introuvable." });
  return row.lastValue;
}

async function validateAgents(tx: any, companyId: number | null, warehouseId: number, selected: { salesAgentId: number | null; cashierId: number | null; salesAgentSelectionMade?: boolean; cashierSelectionMade?: boolean }, channel?: "pos" | "invoice" | "quote") {
  const settings = (await tx.select().from(saleSettings).where(companyScope(saleSettings.companyId, companyId)).limit(1))[0];
  const salesAgentId = selected.salesAgentId ?? settings?.defaultSalesAgentId ?? null;
  const cashierId = selected.cashierId ?? settings?.defaultCashierId ?? null;
  if (channel === "invoice" || channel === "quote") {
    try { assertExplicitInvoiceAgentChoice({ requiresSalesAgentChoice: !settings?.defaultSalesAgentId, requiresCashierChoice: !settings?.defaultCashierId, salesAgentSelectionMade: selected.salesAgentSelectionMade ?? false, cashierSelectionMade: selected.cashierSelectionMade ?? false }); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Sélectionnez les intervenants." }); }
  }
  if (settings?.requireSalesAgent && !salesAgentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un agent commercial est requis." });
  if (settings?.requireCashier && !cashierId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un caissier est requis." });
  const ids = [salesAgentId, cashierId].filter((id): id is number => id !== null);
  const selectedAgents = ids.length ? await tx.select().from(agents).where(and(inArray(agents.id, ids), companyScope(agents.companyId, companyId))) : [];
  const salesAgent = selectedAgents.find((agent: any) => agent.id === salesAgentId);
  if (salesAgentId && (!salesAgent || salesAgent.type !== "sales_agent" || !salesAgent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Agent commercial invalide." });
  if (salesAgentId && salesAgent?.warehouseScope === "selected") {
    const assignments = await tx.select({ warehouseId: salesAgentWarehouseAssignments.warehouseId }).from(salesAgentWarehouseAssignments).where(and(companyScope(salesAgentWarehouseAssignments.companyId, companyId), eq(salesAgentWarehouseAssignments.agentId, salesAgentId)));
    if (!canCoordinateSaleFromWarehouse("selected", assignments.map((assignment: any) => assignment.warehouseId), warehouseId)) throw new TRPCError({ code: "FORBIDDEN", message: "Cet agent commercial n’est pas autorisé pour l’entrepôt sélectionné." });
  }
  if (cashierId && !selectedAgents.some((agent: any) => agent.id === cashierId && agent.type === "cashier" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Caissier invalide." });
  return { salesAgentId, cashierId };
}

export const transactionsRouter = router({
  list: permissionProcedure("sales.view").input(z.object({ warehouseId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    if (input?.warehouseId) await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId, { requireActive: true });
    const allowedWarehouseIds = await assignedWarehouseIds(db, ctx.user);
    const [rows, customerRows] = await Promise.all([
      db.select().from(sales).where(input?.warehouseId ? and(companyScope(sales.companyId, ctx.user.companyId), eq(sales.warehouseId, input.warehouseId)) : companyScope(sales.companyId, ctx.user.companyId)).orderBy(desc(sales.createdAt)).limit(100),
      db.select().from(customers).where(companyScope(customers.companyId, ctx.user.companyId)),
    ]);
    const customerNames = new Map(customerRows.map(customer => [customer.id, customer.name]));
    const visibleRows = allowedWarehouseIds === null ? rows : rows.filter(row => row.warehouseId !== null && allowedWarehouseIds.includes(row.warehouseId));
    return visibleRows.map(row => ({ ...row, customerName: row.customerId ? customerNames.get(row.customerId) ?? null : null }));
  }),
  // Annule un document non encaissé. Une facture, qui a pu être remise au client, est
  // conservée avec le statut « annulée ». Un ticket de caisse ou un devis est supprimé
  // (trace dans le journal d'audit). Aucun stock n'est concerné : il ne sort qu'à l'encaissement.
  removeDraft: permissionProcedure("sales.create").input(z.object({ saleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const settings = ctx.user.role === "seller" ? (await db.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0] : undefined;
    return db.transaction(async tx => {
      const sale = (await tx.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1).for("update"))[0];
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
      if (sale.status !== "draft" || sale.amountPaidCents > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seuls les documents non encaissés peuvent être annulés." });
      // Un vendeur peut toujours abandonner le ticket de caisse qu'il vient d'ouvrir ;
      // annuler le document d'un autre reste soumis au réglage « annulation de facture ».
      const ownPosTicket = sale.channel === "pos" && sale.sellerUserId === ctx.user.id;
      if (ctx.user.role === "seller" && !ownPosTicket) { try { assertSellerSensitiveAction(settings, "invoice_cancellation"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Annulation non autorisée." }); } }
      const entityType = sale.channel === "pos" ? "Ticket POS" : sale.channel === "quote" ? "Devis" : "Facture";
      // Ticket de caisse ou devis non encaissé : ni paiement, ni stock, ni écriture comptable.
      // Il est supprimé pour ne pas encombrer les listes ; le journal d'audit en garde la trace.
      if (sale.channel === "quote" || sale.channel === "pos") {
        await tx.delete(saleItems).where(eq(saleItems.saleId, sale.id));
        await tx.delete(sales).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId)));
        await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Suppression", entityType, entityId: String(sale.id), detail: `${sale.invoiceNumber} supprimé avant encaissement (${moneyLabel(sale.totalCents)})` });
        return { success: true, outcome: "deleted" as const };
      }
      const voided = await tx.update(sales).set({ status: "void", voidedAt: new Date() }).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId), eq(sales.status, "draft"), eq(sales.amountPaidCents, 0)));
      if (!didApplyExactlyOneStateTransition(voided)) throw new TRPCError({ code: "CONFLICT", message: "Ce document a été modifié. Actualisez avant de recommencer." });
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Annulation", entityType, entityId: String(sale.id), detail: `${sale.invoiceNumber} annulé avant encaissement` });
      return { success: true, outcome: "voided" as const };
    });
  }),
  refund: permissionProcedure("sales.refund").input(z.object({ saleId: z.number().int().positive(), method: paymentMethod.optional() })).mutation(async ({ ctx, input }) => {
    if (ctx.user.companyId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Une entreprise active est requise pour émettre un avoir." });
    const db = await dbOrThrow();
    let creditNoteNumber = "";
    await db.transaction(async tx => {
      const sale = (await tx.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1).for("update"))[0];
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Facture introuvable." });
      if ((sale.status !== "paid" && sale.status !== "partial") || sale.amountPaidCents <= 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seule une facture encaissée ou partiellement encaissée peut être remboursée." });
      if (ctx.user.role === "seller") {
        const settings = (await tx.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
        try { assertSellerSensitiveAction(settings, "refund"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Remboursement non autorisé." }); }
      }
      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
      const warehouse = sale.warehouseId ? await getScopedWarehouse(tx, ctx.user.companyId, sale.warehouseId) : await getDefaultWarehouse(tx, ctx.user.companyId);
      await assertSellerWarehouseAccess(tx, ctx.user, warehouse.id);
      const refundLock = await tx.update(sales).set({ status: "void", amountPaidCents: 0, creditNoteNumber: "pending", refundedAt: new Date(), voidedAt: new Date() }).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId), eq(sales.status, sale.status), eq(sales.amountPaidCents, sale.amountPaidCents)));
      if (!didApplyExactlyOneStateTransition(refundLock)) throw new TRPCError({ code: "CONFLICT", message: "Cette facture a été modifiée. Actualisez avant de recommencer." });
      for (const item of items) {
        const remaining = item.quantity - (item.returnedQuantity ?? 0);
        if (remaining > 0) {
          const localStock = await creditWarehouseStock(tx, ctx.user.companyId, warehouse.id, item.productId, remaining);
          await tx.update(products).set({ quantity: sql`${products.quantity} + ${remaining}` }).where(and(eq(products.id, item.productId), companyScope(products.companyId, ctx.user.companyId)));
          await tx.insert(stockMovements).values({ companyId: ctx.user.companyId, productId: item.productId, warehouseId: warehouse.id, type: "entry", quantity: signedMovementQuantity("entry", remaining), previousQuantity: localStock.previousQuantity, resultingQuantity: localStock.resultingQuantity, reason: `Remboursement ${sale.invoiceNumber}`, createdByUserId: ctx.user.id });
          await tx.update(saleItems).set({ returnedQuantity: item.quantity }).where(and(eq(saleItems.id, item.id), eq(saleItems.saleId, sale.id)));
        }
      }
      const method = input.method ?? sale.paymentMethod;
      await tx.insert(salePayments).values({ saleId: sale.id, method, amountCents: -sale.amountPaidCents, createdByUserId: ctx.user.id });
      const commissions = await tx.select().from(saleCommissions).where(eq(saleCommissions.saleId, sale.id));
      const commissionTotals = new Map<string, { row: typeof commissions[number]; cents: number }>();
      for (const row of commissions) {
        const key = `${row.beneficiaryType}:${row.beneficiaryId}`;
        const current = commissionTotals.get(key);
        commissionTotals.set(key, { row, cents: (current?.cents ?? 0) + row.commissionCents });
      }
      for (const { row, cents } of Array.from(commissionTotals.values())) if (cents !== 0) await tx.insert(saleCommissions).values({ saleId: sale.id, beneficiaryType: row.beneficiaryType, beneficiaryId: row.beneficiaryId, commissionBasis: row.commissionBasis, rateBasisPoints: row.rateBasisPoints, commissionCents: -cents });
      const sequence = await nextCreditNoteSequence(tx, ctx.user.companyId!, new Date().getUTCFullYear());
      creditNoteNumber = formatCreditNoteNumber(new Date().getUTCFullYear(), sequence);
      await tx.update(sales).set({ creditNoteNumber }).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId)));
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Remboursement", entityType: "Facture", entityId: String(sale.id), detail: `Facture ${sale.invoiceNumber} remboursée pour ${moneyLabel(sale.amountPaidCents)} (avoir ${creditNoteNumber}) ; stock réintégré et commissions contrepassées.` });
    });
    return { success: true, creditNoteNumber };
  }),
  returnItems: permissionProcedure("sales.refund").input(z.object({
    saleId: z.number().int().positive(),
    requestKey: z.string().trim().min(16).max(80).regex(/^[A-Za-z0-9._:-]+$/),
    lines: z.array(z.object({ saleItemId: z.number().int().positive(), quantity: z.number().int().positive().max(MAX_QUANTITY), restock: z.boolean().default(true) })).min(1).max(MAX_LINE_ITEMS),
    method: paymentMethod.optional(),
    reason: z.string().trim().max(500).nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    if (ctx.user.companyId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Une entreprise active est requise pour enregistrer un retour." });
    const db = await dbOrThrow();
    const method = input.method ?? "cash";
    const reason = input.reason?.trim() || null;
    const fingerprint = requestFingerprint(input.lines, method, reason);
    return db.transaction(async tx => {
      const sale = (await tx.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1).for("update"))[0];
      if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Facture introuvable." });
      if (!sale.warehouseId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La facture n’est pas rattachée à un entrepôt valide." });
      const warehouse = await assertSellerWarehouseAccess(tx, ctx.user, sale.warehouseId, { requireActive: true });
      const existing = (await tx.select().from(saleReturns).where(and(companyScope(saleReturns.companyId, ctx.user.companyId), eq(saleReturns.requestKey, input.requestKey))).limit(1))[0];
      if (existing) {
        if (existing.saleId !== sale.id || existing.requestFingerprint !== fingerprint) throw new TRPCError({ code: "CONFLICT", message: "Cette clé de requête a déjà été utilisée pour un retour différent." });
        return { creditNoteNumber: existing.creditNoteNumber, refundCents: existing.refundCents, fullyReturned: sale.status === "void", replayed: true };
      }
      if (sale.status !== "paid" || sale.channel === "quote") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seule une vente intégralement encaissée peut faire l’objet d’un retour partiel." });
      if (ctx.user.role === "seller") {
        const settings = (await tx.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
        try { assertSellerSensitiveAction(settings, "refund"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Retour non autorisé." }); }
      }
      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
      let calculation: ReturnType<typeof calculatePartialReturn>;
      try { calculation = calculatePartialReturn(sale, items, input.lines); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Retour invalide." }); }
      const priorReturned = sale.returnedCents ?? 0;
      const refundableRemaining = Math.max(0, sale.totalCents - sale.deliveryFeeCents - priorReturned);
      const refundCents = Math.min(calculation.refundCents, sale.amountPaidCents, refundableRemaining);
      const sequence = await nextCreditNoteSequence(tx, ctx.user.companyId!, new Date().getUTCFullYear());
      const creditNoteNumber = formatCreditNoteNumber(new Date().getUTCFullYear(), sequence);
      const lock = await tx.update(sales).set({ amountPaidCents: sale.amountPaidCents - refundCents, returnedCents: priorReturned + refundCents, returnedCostCents: (sale.returnedCostCents ?? 0) + calculation.costCents, ...(calculation.fullyReturned ? { status: "void" as const, refundedAt: new Date(), voidedAt: new Date() } : {}) }).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId), eq(sales.status, sale.status), eq(sales.amountPaidCents, sale.amountPaidCents), eq(sales.returnedCents, priorReturned)));
      if (!didApplyExactlyOneStateTransition(lock)) throw new TRPCError({ code: "CONFLICT", message: "Cette facture a été modifiée. Actualisez avant de recommencer." });
      const returnResult = await tx.insert(saleReturns).values({ companyId: ctx.user.companyId!, warehouseId: warehouse.id, saleId: sale.id, requestKey: input.requestKey, requestFingerprint: fingerprint, creditNoteNumber, refundCents, costCents: calculation.costCents, method, reason, createdByUserId: ctx.user.id });
      const returnId = Number(returnResult[0].insertId);
      for (const line of calculation.returned) {
        await tx.insert(saleReturnItems).values({ returnId, saleItemId: line.item.id, productId: line.item.productId, quantity: line.quantity, restocked: line.restock, refundCents: line.refundCents });
        await tx.update(saleItems).set({ returnedQuantity: (line.item.returnedQuantity ?? 0) + line.quantity }).where(and(eq(saleItems.id, line.item.id), eq(saleItems.saleId, sale.id)));
        if (line.restock) {
          const localStock = await creditWarehouseStock(tx, ctx.user.companyId, warehouse.id, line.item.productId, line.quantity);
          await tx.update(products).set({ quantity: sql`${products.quantity} + ${line.quantity}` }).where(and(eq(products.id, line.item.productId), companyScope(products.companyId, ctx.user.companyId)));
          await tx.insert(stockMovements).values({ companyId: ctx.user.companyId, productId: line.item.productId, warehouseId: warehouse.id, type: "entry", quantity: signedMovementQuantity("entry", line.quantity), previousQuantity: localStock.previousQuantity, resultingQuantity: localStock.resultingQuantity, reason: `Retour ${creditNoteNumber} (${sale.invoiceNumber})`, createdByUserId: ctx.user.id });
        }
      }
      if (refundCents > 0) await tx.insert(salePayments).values({ saleId: sale.id, method, amountCents: -refundCents, createdByUserId: ctx.user.id });
      const commissionRows = await tx.select().from(saleCommissions).where(eq(saleCommissions.saleId, sale.id));
      const commissionsByBeneficiary = new Map<string, { row: typeof commissionRows[number]; earned: number; reversed: number }>();
      for (const row of commissionRows) {
        const key = `${row.beneficiaryType}:${row.beneficiaryId}`;
        const current = commissionsByBeneficiary.get(key) ?? { row, earned: 0, reversed: 0 };
        if (row.commissionCents > 0) current.earned += row.commissionCents;
        else current.reversed += -row.commissionCents;
        commissionsByBeneficiary.set(key, current);
      }
      for (const { row, earned, reversed } of Array.from(commissionsByBeneficiary.values())) {
        const targetReversal = Math.min(earned, Math.round(earned * Math.min(1, (priorReturned + refundCents) / Math.max(1, sale.totalCents))));
        const additionalReversal = Math.max(0, targetReversal - reversed);
        if (additionalReversal > 0) await tx.insert(saleCommissions).values({ saleId: sale.id, beneficiaryType: row.beneficiaryType, beneficiaryId: row.beneficiaryId, commissionBasis: row.commissionBasis, rateBasisPoints: row.rateBasisPoints, commissionCents: -additionalReversal });
      }
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Retour", entityType: "Facture", entityId: String(sale.id), detail: `Retour ${creditNoteNumber} sur ${sale.invoiceNumber} : ${calculation.returned.reduce((sum, line) => sum + line.quantity, 0)} article(s), ${moneyLabel(refundCents)} remboursés.` });
      return { creditNoteNumber, refundCents, fullyReturned: calculation.fullyReturned, replayed: false };
    });
  }),
  createDraft: protectedProcedure.input(z.object({ channel: z.enum(["pos", "invoice", "quote"]), customerId: z.number().int().positive().nullable(), warehouseId: z.number().int().positive().optional(), note: z.string().trim().max(1000).nullable(), deliveryAddress: z.string().trim().max(1500).nullable().optional(), deliveryFeeCents: z.number().int().min(0).max(MAX_CENTS).default(0), applyVat: z.boolean().optional(), vatRateBasisPoints: z.number().int().min(0).max(MAX_DISCOUNT_BASIS_POINTS).optional(), items: z.array(itemInput).min(1).max(MAX_LINE_ITEMS), invoiceDiscount: discountInput.default({ type: "none", value: 0 }), replacesSaleId: z.number().int().positive().optional(), offlineOperationId: z.string().trim().min(8).max(80).optional() }).merge(agentSelection)).mutation(async ({ ctx, input }) => {
    // Agent commercial : uniquement des devis, attribués à sa fiche, avec les limites de prix et de remise des vendeurs.
    const agentQuote = ctx.user.role === "agent";
    if (!can(ctx.user.role, "sales.create") && !(agentQuote && input.channel === "quote")) throw new TRPCError({ code: "FORBIDDEN", message: "Cette action n’est pas autorisée pour votre rôle." });
    if (agentQuote && (input.replacesSaleId || input.offlineOperationId)) throw new TRPCError({ code: "FORBIDDEN", message: "Cette action n’est pas autorisée pour votre rôle." });
    const restricted = ctx.user.role === "seller" || agentQuote;
    if ((input.channel === "invoice" || input.channel === "quote") && !input.customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "Un client est obligatoire pour créer ce document." });
    const db = await dbOrThrow();
    let created: { id: number; invoiceNumber: string; totalCents: number; salesAgentId: number | null; cashierId: number | null } | null = null;
    await db.transaction(async tx => {
      if (input.offlineOperationId) {
        const existing = (await tx.select().from(sales).where(and(eq(sales.offlineOperationId, input.offlineOperationId), eq(sales.sellerUserId, ctx.user.id), companyScope(sales.companyId, ctx.user.companyId))).limit(1))[0];
        if (existing) {
          created = { id: existing.id, invoiceNumber: existing.invoiceNumber, totalCents: existing.totalCents, salesAgentId: existing.salesAgentId, cashierId: existing.cashierId };
          return;
        }
      }
      const customer = input.customerId ? (await tx.select().from(customers).where(and(eq(customers.id, input.customerId), companyScope(customers.companyId, ctx.user.companyId))).limit(1))[0] : null;
      if (input.customerId && !customer) throw new TRPCError({ code: "NOT_FOUND", message: "Client introuvable." });
      const defaultWarehouse = input.warehouseId ? null : await getDefaultWarehouse(tx, ctx.user.companyId);
      const warehouse = agentQuote ? await assertSellerWarehouseAccess(tx, ctx.user, input.warehouseId ?? defaultWarehouse!.id, { requireActive: true, permission: "view_stock" }) : input.warehouseId ? await assertSellerWarehouseAccess(tx, ctx.user, input.warehouseId, { requireActive: true, permission: "sell" }) : ctx.user.role === "seller" ? await assertSellerWarehouseAccess(tx, ctx.user, defaultWarehouse!.id, { requireActive: true, permission: "sell" }) : defaultWarehouse!;
      const productIds = input.items.map(item => item.productId);
      const productRows = await tx.select().from(products).where(and(inArray(products.id, productIds), companyScope(products.companyId, ctx.user.companyId)));
      if (productRows.length !== productIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Un produit est introuvable." });
      const tierRows = productIds.length ? await tx.select().from(productPriceTiers).where(inArray(productPriceTiers.productId, productIds)) : [];
      const permissions = (await tx.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
      const lines = input.items.map(item => { const product = productRows.find((row: any) => row.id === item.productId)!; const pricingType = effectiveCustomerType(customer?.type, warehouse.wholesaleEnabled); const isWholesale = pricingType === "wholesale"; const basePriceCents = priceForCustomer(pricingType, product.retailPriceCents, product.wholesalePriceCents); const applicableTiers = tierRows.filter((tier: any) => tier.productId === product.id && tier.customerType === (isWholesale ? "wholesale" : "retail")); const tariffCents = priceForQuantityTier(basePriceCents, item.quantity, applicableTiers); const unitPriceCents = item.manualUnitPriceCents ?? tariffCents; if (restricted) { try { assertSellerUnitPrice(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, tariffCents, unitPriceCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Prix non autorisé." }); } } const lineSubtotalCents = assertSafeDatabaseInt(unitPriceCents * item.quantity, "Sous-total de ligne"); const lineDiscountCents = discountCents(lineSubtotalCents, item.discount.type as DiscountType, item.discount.value); if (restricted) { try { assertSellerDiscount(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, "line", lineSubtotalCents, lineDiscountCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Remise non autorisée." }); } } return { product, quantity: item.quantity, unitPriceCents, lineSubtotalCents, lineDiscountCents, discount: item.discount, lineTotalCents: assertSafeDatabaseInt(lineSubtotalCents - lineDiscountCents, "Total de ligne"), lineCostCents: assertSafeDatabaseInt(product.purchasePriceCents * item.quantity, "Coût de ligne") }; });
      const subtotalCents = assertSafeDatabaseInt(lines.reduce((sum, line) => sum + line.lineSubtotalCents, 0), "Sous-total");
      const lineNetCents = assertSafeDatabaseInt(lines.reduce((sum, line) => sum + line.lineTotalCents, 0), "Total net");
      const invoiceDiscountCents = discountCents(lineNetCents, input.invoiceDiscount.type as DiscountType, input.invoiceDiscount.value);
      if (restricted) { try { assertSellerDiscount(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, input.channel === "pos" ? "cart" : "invoice", lineNetCents, invoiceDiscountCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Remise non autorisée." }); } }
      const taxableSubtotalCents = assertSafeDatabaseInt(lineNetCents - invoiceDiscountCents, "Base taxable");
      const defaultVatApplied = Boolean(permissions?.vatEnabled);
      const applyVat = input.applyVat ?? defaultVatApplied;
      if (restricted && applyVat !== defaultVatApplied && !(permissions?.vatEnabled && permissions?.sellerCanToggleVat)) throw new TRPCError({ code: "FORBIDDEN", message: "Modification de TVA non autorisée." });
      const activeVatPresets = await tx.select().from(vatRatePresets).where(and(companyScope(vatRatePresets.companyId, ctx.user.companyId), eq(vatRatePresets.active, true)));
      if (applyVat && input.vatRateBasisPoints !== undefined) { try { assertVatPresetSelection(input.vatRateBasisPoints, activeVatPresets); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Taux de TVA non autorisé." }); } }
      // Les taux spécifiques viennent exclusivement des produits relus côté serveur.
      // Le taux document/preset reste le repli pour les produits sans taux propre.
      const fallbackVatRate = applyVat
        ? input.vatRateBasisPoints ?? permissions?.vatRateBasisPoints ?? 0
        : 0;
      const vatBreakdown = computeVatBreakdown(
        lines.map(line => ({
          netCents: line.lineTotalCents,
          vatRateBasisPoints: applyVat
            ? (line.product.vatRateBasisPoints ?? fallbackVatRate)
            : 0,
        })),
        invoiceDiscountCents
      );
      const vatCents = assertSafeDatabaseInt(vatBreakdown.vatCents, "TVA");
      const totalCents = assertSafeDatabaseInt(
        taxableSubtotalCents + vatCents + input.deliveryFeeCents,
        "Total TTC"
      );
      if (totalCents > MAX_CENTS) throw new TRPCError({ code: "BAD_REQUEST", message: "Le total commercial dépasse la limite autorisée." });
      const totalCostCents = assertSafeDatabaseInt(lines.reduce((sum, line) => sum + line.lineCostCents, 0), "Coût total");
      let agentSelection = input;
      if (agentQuote) {
        const ownAgent = (await tx.select({ id: agents.id, active: agents.active }).from(agents).where(and(eq(agents.userId, ctx.user.id), companyScope(agents.companyId, ctx.user.companyId))).limit(1))[0];
        if (!ownAgent?.active) throw new TRPCError({ code: "FORBIDDEN", message: "Votre fiche d’agent n’est plus active." });
        agentSelection = { ...input, salesAgentId: ownAgent.id, cashierId: null, salesAgentSelectionMade: true, cashierSelectionMade: true };
      }
      const assigned = await validateAgents(tx, ctx.user.companyId, warehouse.id, agentSelection, input.channel);
      // Ticket en attente rappelé dans le panier puis modifié : il est remplacé en gardant son numéro.
      let number = invoiceNumber(input.channel);
      if (input.replacesSaleId) {
        const previous = (await tx.select().from(sales).where(and(eq(sales.id, input.replacesSaleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1).for("update"))[0];
        if (!previous || previous.channel !== "pos" || input.channel !== "pos") throw new TRPCError({ code: "NOT_FOUND", message: "Ticket en attente introuvable." });
        if (previous.status !== "draft" || previous.amountPaidCents > 0) throw new TRPCError({ code: "CONFLICT", message: "Ce ticket a déjà été encaissé ou modifié. Actualisez avant de recommencer." });
        if (previous.warehouseId != null) await assertSellerWarehouseAccess(tx, ctx.user, previous.warehouseId, { permission: "sell" });
        number = previous.invoiceNumber;
        await tx.delete(saleItems).where(eq(saleItems.saleId, previous.id));
        await tx.delete(sales).where(and(eq(sales.id, previous.id), companyScope(sales.companyId, ctx.user.companyId)));
      }
      const result = await tx.insert(sales).values({ companyId: ctx.user.companyId, invoiceNumber: number, offlineOperationId: input.offlineOperationId, channel: input.channel, customerId: customer?.id ?? null, warehouseId: warehouse.id, sellerUserId: ctx.user.id, ...assigned, paymentMethod: "cash", amountPaidCents: 0, subtotalCents, invoiceDiscountType: input.invoiceDiscount.type, invoiceDiscountValue: input.invoiceDiscount.value, invoiceDiscountCents, vatRateBasisPoints: fallbackVatRate, vatCents, deliveryFeeCents: input.deliveryFeeCents, totalCents, totalCostCents, netProfitCents: assertSafeDatabaseInt(totalCents - totalCostCents, "Bénéfice net"), note: input.note, deliveryAddress: input.deliveryAddress?.trim() || null, status: "draft" });
      const saleId = Number(result[0].insertId);
      for (const [index, line] of lines.entries()) await tx.insert(saleItems).values({ saleId, productId: line.product.id, productName: line.product.name, productReference: line.product.reference, quantity: line.quantity, unitPriceCents: line.unitPriceCents, purchasePriceCents: line.product.purchasePriceCents, discountType: line.discount.type, discountValue: line.discount.value, discountCents: line.lineDiscountCents, lineSubtotalCents: line.lineSubtotalCents, lineTotalCents: line.lineTotalCents, lineCostCents: line.lineCostCents, vatRateBasisPoints: vatBreakdown.perLine[index]!.vatRateBasisPoints, vatCents: vatBreakdown.perLine[index]!.vatCents });
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: input.replacesSaleId ? "Modification" : "Document créé", entityType: input.channel === "pos" ? "Ticket POS" : input.channel === "quote" ? "Devis" : "Facture", entityId: String(saleId), detail: input.replacesSaleId ? `${number} modifié avant encaissement` : `${number} enregistré en attente d’encaissement` });
      created = { id: saleId, invoiceNumber: number, totalCents, salesAgentId: assigned.salesAgentId, cashierId: assigned.cashierId };
    });
    return created!;
  }),
  checkout: permissionProcedure("sales.create").input(z.object({ saleId: z.number().int().positive(), settlementMode: z.enum(["full", "partial"]), payments: z.array(paymentInput).min(1), note: z.string().trim().max(1000).nullable().optional(), offlineOperationId: z.string().trim().min(8).max(80).optional() }).merge(agentSelection)).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    let result: { status: "partial" | "paid"; amountPaidCents: number; balanceCents: number } | null = null;
    await db.transaction(async tx => {
      const sale = (await tx.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1))[0];
      if (!sale || sale.status === "void" || sale.channel === "quote") throw new TRPCError({ code: "NOT_FOUND", message: "Vente encaissable introuvable." });
      if (input.offlineOperationId) {
        const existingPayment = (await tx.select().from(salePayments).where(and(eq(salePayments.saleId, sale.id), eq(salePayments.offlineOperationId, input.offlineOperationId))).limit(1))[0];
        if (existingPayment) {
          result = { status: sale.status === "paid" ? "paid" : "partial", amountPaidCents: sale.amountPaidCents, balanceCents: sale.totalCents - sale.amountPaidCents };
          return;
        }
      }
      if (sale.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Cette vente est déjà intégralement encaissée." });
      const remainingBefore = Math.max(0, sale.totalCents - (sale.returnedCents ?? 0) - sale.amountPaidCents);
      if (sale.channel === "pos" && input.settlementMode !== "full") throw new TRPCError({ code: "BAD_REQUEST", message: "Le POS requiert un règlement intégral." });
      const settings = (await tx.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
      try { assertPaymentMethodsEnabled(input.payments.map(payment => payment.method), settings); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Moyen de paiement invalide." }); }
      let settlement: ReturnType<typeof settlementResult>;
      try { settlement = settlementResult(remainingBefore, input.settlementMode, input.payments.map(payment => payment.amountCents)); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Règlement invalide." }); }
      const saleWarehouse = sale.warehouseId ? await assertSellerWarehouseAccess(tx, ctx.user, sale.warehouseId, { permission: "checkout" }) : ctx.user.role === "seller" ? await assertSellerWarehouseAccess(tx, ctx.user, (await getDefaultWarehouse(tx, ctx.user.companyId)).id, { permission: "checkout" }) : await getDefaultWarehouse(tx, ctx.user.companyId);
      const assigned = await validateAgents(tx, ctx.user.companyId, saleWarehouse.id, input);
      const isFirstCollection = sale.status === "draft";
      const checkoutLock = await tx.update(sales).set({ ...assigned, status: settlement.status, amountPaidCents: sale.amountPaidCents + settlement.paidCents, paymentMethod: input.payments[0].method, note: input.note ?? sale.note }).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId), eq(sales.status, sale.status), eq(sales.amountPaidCents, sale.amountPaidCents)));
      if (!didApplyExactlyOneStateTransition(checkoutLock)) throw new TRPCError({ code: "CONFLICT", message: "Cette vente a été modifiée. Actualisez avant de recommencer." });
      if (isFirstCollection) {
        const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
        const productRows = await tx.select().from(products).where(and(inArray(products.id, items.map((item: any) => item.productId)), companyScope(products.companyId, ctx.user.companyId)));
        const warehouse = saleWarehouse;
        for (const item of items) { const product = productRows.find((row: any) => row.id === item.productId); if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." }); const quantity = resultingStock(product.quantity, "exit", item.quantity); const localStock = await debitWarehouseStock(tx, ctx.user.companyId, warehouse.id, product.id, item.quantity); await tx.update(products).set({ quantity }).where(and(eq(products.id, product.id), companyScope(products.companyId, ctx.user.companyId))); await tx.insert(stockMovements).values({ companyId: ctx.user.companyId, productId: product.id, warehouseId: warehouse.id, type: "exit", quantity: signedMovementQuantity("exit", item.quantity), previousQuantity: localStock.previousQuantity, resultingQuantity: localStock.resultingQuantity, reason: `Vente ${sale.invoiceNumber}`, createdByUserId: ctx.user.id }); if (quantity <= product.minimumQuantity) await tx.insert(stockAlerts).values({ companyId: ctx.user.companyId, productId: product.id, threshold: product.minimumQuantity, observedQuantity: quantity, status: "active" }).onDuplicateKeyUpdate({ set: { observedQuantity: quantity, threshold: product.minimumQuantity, status: "active", resolvedAt: null } }); }
        const profiles = await tx.select().from(remunerationProfiles).where(and(eq(remunerationProfiles.active, true), companyScope(remunerationProfiles.companyId, ctx.user.companyId)));
        const beneficiaries = [{ type: "user" as const, id: sale.sellerUserId }, ...(assigned.salesAgentId ? [{ type: "agent" as const, id: assigned.salesAgentId }] : []), ...(assigned.cashierId ? [{ type: "agent" as const, id: assigned.cashierId }] : [])];
        for (const beneficiary of beneficiaries) { const profile = profiles.find((item: any) => item.beneficiaryType === beneficiary.type && item.beneficiaryId === beneficiary.id); if (profile) { const value = commissionCents({ remunerationMode: profile.remunerationMode, commissionBasis: profile.commissionBasis, rateBasisPoints: profile.rateBasisPoints, invoiceRevenueCents: sale.totalCents, invoiceNetProfitCents: sale.netProfitCents }); if (value > 0) await tx.insert(saleCommissions).values({ saleId: sale.id, beneficiaryType: beneficiary.type, beneficiaryId: beneficiary.id, commissionBasis: profile.commissionBasis, rateBasisPoints: profile.rateBasisPoints, commissionCents: value }); } }
      }
      for (let index = 0; index < input.payments.length; index += 1) { const payment = input.payments[index]!; await tx.insert(salePayments).values({ saleId: sale.id, offlineOperationId: index === 0 ? input.offlineOperationId : undefined, method: payment.method, amountCents: payment.amountCents, createdByUserId: ctx.user.id }); }
      const amountPaidCents = sale.amountPaidCents + settlement.paidCents;
      const status = settlement.status;
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Encaissement", entityType: "Vente", entityId: String(sale.id), detail: `${settlement.paidCents} encaissé sur ${sale.invoiceNumber} (${status === "paid" ? "soldée" : "partielle"})` });
      result = { status, amountPaidCents, balanceCents: Math.max(0, sale.totalCents - (sale.returnedCents ?? 0) - amountPaidCents) };
    });
    return result!;
  }),
});
