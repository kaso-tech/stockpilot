import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { agents, auditLogs, customers, productPriceTiers, products, remunerationProfiles, saleCommissions, saleItems, salePayments, saleSettings, sales } from "../../drizzle/schema";
import { commissionCents, priceForCustomer, priceForQuantityTier } from "../commerceRules";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { assertPaymentMethodsEnabled, settlementResult } from "../transactionRules";
import { discountCents, type DiscountType } from "../discountRules";
import { assertExplicitInvoiceAgentChoice } from "../agentSelectionRules";
import { assertSellerSensitiveAction } from "../sellerActionRules";
import { assertSellerDiscount, assertSellerUnitPrice } from "../sellerPriceRules";
import { companyScope } from "../companyScope";
import { assertSafeDatabaseInt, MAX_CENTS, MAX_DISCOUNT_BASIS_POINTS, MAX_LINE_ITEMS, MAX_QUANTITY } from "../numericLimits";
import { calculateCommercialTotals } from "../commercialTotals";
import { lockProducts } from "../stockLedger";
import { nextDocumentNumber } from "../documentNumbers";
import { companyTimezone, dayKey } from "../companyTime";

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

const listInput = z.object({ channel: z.enum(["pos", "invoice", "quote"]).optional(), limit: z.number().int().min(1).max(1000).optional() }).optional();
const SERIES_BY_CHANNEL = { pos: "POS", invoice: "FAC", quote: "DEV" } as const;

async function validateAgents(tx: any, companyId: number | null, selected: { salesAgentId: number | null; cashierId: number | null; salesAgentSelectionMade?: boolean; cashierSelectionMade?: boolean }, channel?: "pos" | "invoice" | "quote") {
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
  if (salesAgentId && !selectedAgents.some((agent: any) => agent.id === salesAgentId && agent.type === "sales_agent" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Agent commercial invalide." });
  if (cashierId && !selectedAgents.some((agent: any) => agent.id === cashierId && agent.type === "cashier" && agent.active)) throw new TRPCError({ code: "BAD_REQUEST", message: "Caissier invalide." });
  return { salesAgentId, cashierId };
}

export const transactionsRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    // Filtre par canal côté serveur et limite extensible (« Charger plus ») : les
    // devis ou factures anciens ne sont plus masqués par les 100 derniers tickets (E12).
    const scope = input?.channel ? and(companyScope(sales.companyId, ctx.user.companyId), eq(sales.channel, input.channel)) : companyScope(sales.companyId, ctx.user.companyId);
    const [rows, customerRows] = await Promise.all([
      db.select().from(sales).where(scope).orderBy(desc(sales.createdAt), desc(sales.id)).limit(input?.limit ?? 100), // tenant-scope-ok: `scope` contient companyScope
      db.select().from(customers).where(companyScope(customers.companyId, ctx.user.companyId)),
    ]);
    const customerNames = new Map(customerRows.map(customer => [customer.id, customer.name]));
    return rows.map(row => ({ ...row, customerName: row.customerId ? customerNames.get(row.customerId) ?? null : null }));
  }),
  removeDraft: protectedProcedure.input(z.object({ saleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.transaction(async tx => {
      const sale = (await tx.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1).for("update"))[0];
      if (!sale || (sale.channel !== "invoice" && sale.channel !== "quote")) throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
      if (sale.status !== "draft" || sale.amountPaidCents > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seuls les documents non encaissés peuvent être annulés." });
      if (ctx.user.role === "seller") { const settings = (await tx.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0]; try { assertSellerSensitiveAction(settings, "invoice_cancellation"); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Annulation non autorisée." }); } }
      if (sale.channel === "invoice") {
        // Une facture numérotée n'est jamais supprimée : elle est annulée pour
        // préserver la continuité de la numérotation (E5).
        await tx.update(sales).set({ status: "void", voidedAt: new Date() }).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId)));
        await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Annulation", entityType: "Facture", entityId: String(sale.id), detail: `Facture ${sale.invoiceNumber} annulée avant encaissement` });
      } else {
        await tx.delete(saleItems).where(eq(saleItems.saleId, sale.id));
        await tx.delete(sales).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId)));
        await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Suppression", entityType: "Devis", entityId: String(sale.id), detail: `Devis ${sale.invoiceNumber} supprimé` });
      }
    });
    return { success: true };
  }),
  refund: protectedProcedure.input(z.object({ saleId: z.number().int().positive(), method: paymentMethod.optional() })).mutation(async ({ ctx, input }) => {
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
      const ledger = await lockProducts(tx, items.map(item => item.productId), ctx.user.companyId);
      ledger.assertAll(items.map(item => item.productId), "Un produit de cette facture est introuvable ; le remboursement ne peut pas être finalisé.");
      for (const item of items) await ledger.apply(item.productId, { type: "entry", quantity: item.quantity, reason: `Remboursement ${sale.invoiceNumber}`, createdByUserId: ctx.user.id });
      // Avoir numéroté (E8) : la facture d'origine est conservée et annulée, le
      // remboursement est tracé par un paiement négatif (la caisse reste juste) et
      // les commissions sont contrepassées au lieu d'être effacées (elles ont pu être versées).
      const timezone = await companyTimezone(tx, ctx.user.companyId);
      creditNoteNumber = await nextDocumentNumber(tx, ctx.user.companyId!, "AV", Number(dayKey(new Date(), timezone).slice(0, 4)));
      await tx.insert(salePayments).values({ saleId: sale.id, method: input.method ?? sale.paymentMethod, amountCents: -sale.amountPaidCents, createdByUserId: ctx.user.id });
      const commissions = await tx.select().from(saleCommissions).where(eq(saleCommissions.saleId, sale.id));
      const totals = new Map<string, { row: typeof commissions[number]; cents: number }>();
      for (const row of commissions) { const key = `${row.beneficiaryType}:${row.beneficiaryId}`; const current = totals.get(key); totals.set(key, { row, cents: (current?.cents ?? 0) + row.commissionCents }); }
      for (const { row, cents } of Array.from(totals.values())) if (cents !== 0) await tx.insert(saleCommissions).values({ saleId: sale.id, beneficiaryType: row.beneficiaryType, beneficiaryId: row.beneficiaryId, commissionBasis: row.commissionBasis, rateBasisPoints: row.rateBasisPoints, commissionCents: -cents });
      await tx.update(sales).set({ status: "void", amountPaidCents: 0, creditNoteNumber, refundedAt: new Date(), voidedAt: new Date() }).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId)));
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Remboursement", entityType: "Facture", entityId: String(sale.id), detail: `Facture ${sale.invoiceNumber} remboursée pour ${sale.amountPaidCents} centimes (avoir ${creditNoteNumber}) ; stock réintégré et commissions contrepassées.` });
    });
    return { success: true, creditNoteNumber };
  }),
  createDraft: protectedProcedure.input(z.object({ channel: z.enum(["pos", "invoice", "quote"]), customerId: z.number().int().positive().nullable(), note: z.string().trim().max(1000).nullable(), deliveryAddress: z.string().trim().max(1500).nullable().optional(), deliveryFeeCents: z.number().int().min(0).max(MAX_CENTS).default(0), items: z.array(itemInput).min(1).max(MAX_LINE_ITEMS), invoiceDiscount: discountInput.default({ type: "none", value: 0 }), offlineOperationId: z.string().trim().min(8).max(80).optional() }).merge(agentSelection)).mutation(async ({ ctx, input }) => {
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
      const productIds = Array.from(new Set(input.items.map(item => item.productId)));
      const productRows = await tx.select().from(products).where(and(inArray(products.id, productIds), companyScope(products.companyId, ctx.user.companyId)));
      if (productRows.length !== productIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Un produit est introuvable." });
      const tierRows = productIds.length ? await tx.select().from(productPriceTiers).where(inArray(productPriceTiers.productId, productIds)) : [];
      const permissions = (await tx.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
      const lines = input.items.map(item => { const product = productRows.find((row: any) => row.id === item.productId)!; const isWholesale = customer?.type === "wholesale"; const basePriceCents = priceForCustomer(customer?.type ?? "ordinary", product.retailPriceCents, product.wholesalePriceCents); const applicableTiers = tierRows.filter((tier: any) => tier.productId === product.id && tier.customerType === (isWholesale ? "wholesale" : "retail")); const tariffCents = priceForQuantityTier(basePriceCents, item.quantity, applicableTiers); const unitPriceCents = item.manualUnitPriceCents ?? tariffCents; if (ctx.user.role === "seller") { try { assertSellerUnitPrice(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, tariffCents, unitPriceCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Prix non autorisé." }); } } const lineSubtotalCents = assertSafeDatabaseInt(unitPriceCents * item.quantity, "Sous-total de ligne"); const lineDiscountCents = discountCents(lineSubtotalCents, item.discount.type as DiscountType, item.discount.value); if (ctx.user.role === "seller") { try { assertSellerDiscount(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, lineSubtotalCents, lineDiscountCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Remise non autorisée." }); } } return { product, quantity: item.quantity, unitPriceCents, lineSubtotalCents, lineDiscountCents, discount: item.discount, lineTotalCents: assertSafeDatabaseInt(lineSubtotalCents - lineDiscountCents, "Total de ligne"), lineCostCents: assertSafeDatabaseInt(product.purchasePriceCents * item.quantity, "Coût de ligne") }; });
      const subtotalCents = assertSafeDatabaseInt(lines.reduce((sum, line) => sum + line.lineSubtotalCents, 0), "Sous-total");
      const lineNetCents = assertSafeDatabaseInt(lines.reduce((sum, line) => sum + line.lineTotalCents, 0), "Total net");
      const invoiceDiscountCents = discountCents(lineNetCents, input.invoiceDiscount.type as DiscountType, input.invoiceDiscount.value);
      if (ctx.user.role === "seller") { try { assertSellerDiscount(permissions ?? { sellerCanOverridePrice: false, sellerCanSellBelowPrice: false, sellerMaxDiscountPercent: 0 }, lineNetCents, invoiceDiscountCents); } catch (error) { throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Remise non autorisée." }); } }
      const taxableSubtotalCents = assertSafeDatabaseInt(lineNetCents - invoiceDiscountCents, "Base taxable");
      const commercialTotals = calculateCommercialTotals({ subtotalCents: taxableSubtotalCents, vatRateBasisPoints: permissions?.vatEnabled ? permissions.vatRateBasisPoints : 0, deliveryFeeCents: input.deliveryFeeCents });
      const totalCents = commercialTotals.totalCents;
      const totalCostCents = assertSafeDatabaseInt(lines.reduce((sum, line) => sum + line.lineCostCents, 0), "Coût total");
      const assigned = await validateAgents(tx, ctx.user.companyId, input, input.channel);
      const timezone = await companyTimezone(tx, ctx.user.companyId);
      const number = await nextDocumentNumber(tx, ctx.user.companyId!, SERIES_BY_CHANNEL[input.channel], Number(dayKey(new Date(), timezone).slice(0, 4)));
      const result = await tx.insert(sales).values({ companyId: ctx.user.companyId, invoiceNumber: number, offlineOperationId: input.offlineOperationId, channel: input.channel, customerId: customer?.id ?? null, sellerUserId: ctx.user.id, ...assigned, paymentMethod: "cash", amountPaidCents: 0, subtotalCents, invoiceDiscountType: input.invoiceDiscount.type, invoiceDiscountValue: input.invoiceDiscount.value, invoiceDiscountCents, vatRateBasisPoints: commercialTotals.vatRateBasisPoints, vatCents: commercialTotals.vatCents, deliveryFeeCents: commercialTotals.deliveryFeeCents, totalCents, totalCostCents, netProfitCents: assertSafeDatabaseInt(totalCents - totalCostCents, "Bénéfice net"), note: input.note, deliveryAddress: input.deliveryAddress?.trim() || null, status: "draft" });
      const saleId = Number(result[0].insertId);
      for (const line of lines) await tx.insert(saleItems).values({ saleId, productId: line.product.id, productName: line.product.name, productReference: line.product.reference, quantity: line.quantity, unitPriceCents: line.unitPriceCents, purchasePriceCents: line.product.purchasePriceCents, discountType: line.discount.type, discountValue: line.discount.value, discountCents: line.lineDiscountCents, lineSubtotalCents: line.lineSubtotalCents, lineTotalCents: line.lineTotalCents, lineCostCents: line.lineCostCents });
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Document créé", entityType: input.channel === "pos" ? "Ticket POS" : input.channel === "quote" ? "Devis" : "Facture", entityId: String(saleId), detail: `${number} enregistré en attente d’encaissement` });
      created = { id: saleId, invoiceNumber: number, totalCents, salesAgentId: assigned.salesAgentId, cashierId: assigned.cashierId };
    });
    return created!;
  }),
  checkout: protectedProcedure.input(z.object({ saleId: z.number().int().positive(), settlementMode: z.enum(["full", "partial"]), payments: z.array(paymentInput).min(1).max(10), note: z.string().trim().max(1000).nullable().optional(), offlineOperationId: z.string().trim().min(8).max(80).optional() }).merge(agentSelection)).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    let result: { status: "partial" | "paid"; amountPaidCents: number; balanceCents: number } | null = null;
    await db.transaction(async tx => {
      // Verrou sur la vente : un second encaissement concurrent attend la fin de
      // celui-ci puis relit le statut à jour (plus de double décrément du stock).
      const sale = (await tx.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1).for("update"))[0];
      if (!sale || sale.status === "void" || sale.channel === "quote") throw new TRPCError({ code: "NOT_FOUND", message: "Vente encaissable introuvable." });
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
      const settings = (await tx.select().from(saleSettings).where(companyScope(saleSettings.companyId, ctx.user.companyId)).limit(1))[0];
      try { assertPaymentMethodsEnabled(input.payments.map(payment => payment.method), settings); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Moyen de paiement invalide." }); }
      let settlement: ReturnType<typeof settlementResult>;
      try { settlement = settlementResult(remainingBefore, input.settlementMode, input.payments.map(payment => payment.amountCents)); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Règlement invalide." }); }
      const assigned = await validateAgents(tx, ctx.user.companyId, input);
      const isFirstCollection = sale.status === "draft";
      if (isFirstCollection) {
        const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
        const ledger = await lockProducts(tx, items.map((item: any) => item.productId), ctx.user.companyId);
        ledger.assertAll(items.map((item: any) => item.productId), "Produit introuvable.");
        for (const item of items) await ledger.apply(item.productId, { type: "exit", quantity: item.quantity, reason: `Vente ${sale.invoiceNumber}`, createdByUserId: ctx.user.id });
      }
      for (let index = 0; index < input.payments.length; index += 1) { const payment = input.payments[index]!; await tx.insert(salePayments).values({ saleId: sale.id, offlineOperationId: index === 0 ? input.offlineOperationId : undefined, method: payment.method, amountCents: payment.amountCents, createdByUserId: ctx.user.id }); }
      // Commissions calculées sur la part encaissée (E10) : un acompte ne génère
      // que la commission correspondante, le solde suivra au prochain encaissement.
      if (sale.totalCents > 0 && settlement.paidCents > 0) {
        const share = Math.min(1, settlement.paidCents / sale.totalCents);
        const profiles = await tx.select().from(remunerationProfiles).where(and(eq(remunerationProfiles.active, true), companyScope(remunerationProfiles.companyId, ctx.user.companyId)));
        const beneficiaries = [{ type: "user" as const, id: sale.sellerUserId }, ...(assigned.salesAgentId ? [{ type: "agent" as const, id: assigned.salesAgentId }] : []), ...(assigned.cashierId ? [{ type: "agent" as const, id: assigned.cashierId }] : [])];
        for (const beneficiary of beneficiaries) {
          const profile = profiles.find((item: any) => item.beneficiaryType === beneficiary.type && item.beneficiaryId === beneficiary.id);
          if (!profile) continue;
          const value = commissionCents({ remunerationMode: profile.remunerationMode, commissionBasis: profile.commissionBasis, rateBasisPoints: profile.rateBasisPoints, invoiceRevenueCents: settlement.paidCents, invoiceNetProfitCents: Math.round(sale.netProfitCents * share) });
          if (value > 0) await tx.insert(saleCommissions).values({ saleId: sale.id, beneficiaryType: beneficiary.type, beneficiaryId: beneficiary.id, commissionBasis: profile.commissionBasis, rateBasisPoints: profile.rateBasisPoints, commissionCents: value });
        }
      }
      const amountPaidCents = sale.amountPaidCents + settlement.paidCents;
      const status = settlement.status;
      await tx.update(sales).set({ ...assigned, status, amountPaidCents, paymentMethod: input.payments[0].method, note: input.note ?? sale.note }).where(and(eq(sales.id, sale.id), companyScope(sales.companyId, ctx.user.companyId)));
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Encaissement", entityType: "Vente", entityId: String(sale.id), detail: `${settlement.paidCents} encaissé sur ${sale.invoiceNumber} (${status === "paid" ? "soldée" : "partielle"})` });
      result = { status, amountPaidCents, balanceCents: sale.totalCents - amountPaidCents };
    });
    return result!;
  }) });
