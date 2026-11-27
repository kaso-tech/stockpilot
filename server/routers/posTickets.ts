import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, sales, saleItems } from "../../drizzle/schema";
import { permissionProcedure, router } from "../_core/trpc";
import { companyScope } from "../companyScope";
import { companyTimezone, dayKey } from "../companyTime";
import { getDb } from "../db";
import { lockedByOther } from "../posQueueRules";
import { assertSellerWarehouseAccess, warehouseHasDedicatedCashier } from "../sellerWarehouseAccess";

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }
type Db = Awaited<ReturnType<typeof dbOrThrow>>;

/** L’utilisateur peut-il encaisser dans cet entrepôt (caissier, gérant de dépôt, administrateur…) ? */
async function canCheckoutIn(db: Db, user: any, warehouseId: number) {
  try { await assertSellerWarehouseAccess(db, user, warehouseId, { permission: "checkout" }); return true; } catch { return false; }
}

async function openTicket(db: Db, companyId: number | null, saleId: number) {
  const sale = (await db.select().from(sales).where(and(eq(sales.id, saleId), companyScope(sales.companyId, companyId))).limit(1))[0];
  if (!sale || sale.channel !== "pos" || sale.status !== "draft") throw new TRPCError({ code: "NOT_FOUND", message: "Ticket en attente introuvable : il a peut-être déjà été encaissé." });
  return sale;
}

/** Circuit vendeur → caisse : paniers mis de côté, tickets envoyés en caisse, verrou d’encaissement, renvoi et annulation. */
export const posTicketsRouter = router({
  /** Ce que l’utilisateur peut faire dans l’entrepôt : encaisser lui-même ou seulement envoyer en caisse. */
  capabilities: permissionProcedure("sales.create").input(z.object({ warehouseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const [canCheckout, hasCashier] = await Promise.all([canCheckoutIn(db, ctx.user, input.warehouseId), warehouseHasDedicatedCashier(db, ctx.user.companyId, input.warehouseId)]);
    // « Envoyer en caisse » n’a de sens que s’il existe un caissier séparé dans l’entrepôt.
    return { canCheckout, hasCashier };
  }),

  /** Tickets du vendeur connecté : paniers de côté (y compris renvoyés), envoyés en caisse, et ceux du jour payés ou annulés. */
  mine: permissionProcedure("sales.create").input(z.object({ warehouseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await assertSellerWarehouseAccess(db, ctx.user, input.warehouseId);
    const today = dayKey(new Date(), await companyTimezone(db, ctx.user.companyId));
    const rows = await db.select().from(sales).where(and(companyScope(sales.companyId, ctx.user.companyId), eq(sales.channel, "pos"), eq(sales.warehouseId, input.warehouseId), eq(sales.sellerUserId, ctx.user.id), or(inArray(sales.status, ["draft", "partial"]), eq(sales.queueDay, today)))).orderBy(desc(sales.createdAt)).limit(80);
    const ids = rows.map(row => row.id);
    const items = ids.length ? await db.select({ saleId: saleItems.saleId, productName: saleItems.productName, quantity: saleItems.quantity }).from(saleItems).where(inArray(saleItems.saleId, ids)) : [];
    const now = new Date();
    return rows.filter(row => row.status === "draft" || row.status === "partial" || row.queueNumber).map(row => {
      const lines = items.filter(item => item.saleId === row.id);
      const state = row.status === "paid" ? "paid" : row.status === "void" ? "cancelled" : row.posStage === "queued" ? "queued" : "parked";
      return { id: row.id, invoiceNumber: row.invoiceNumber, state, status: row.status, queueNumber: row.queueNumber, holdLabel: row.holdLabel, returnedReason: row.returnedReason, voidReason: row.voidReason, totalCents: row.totalCents, createdAt: row.createdAt, queuedAt: row.queuedAt, lineCount: lines.length, itemsCount: lines.reduce((sum, line) => sum + line.quantity, 0), summary: lines.map(line => `${line.productName} × ${line.quantity}`).join(" · "), beingCollected: lockedByOther(row.checkoutLockedBy, row.checkoutLockedAt, ctx.user.id, now) };
    });
  }),

  /** Contenu d’un ticket en attente, pour le reprendre dans le panier (vendeur du ticket, ou poste qui peut encaisser). */
  detail: permissionProcedure("sales.create").input(z.object({ saleId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const sale = (await db.select().from(sales).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId))).limit(1))[0];
    if (!sale || sale.channel !== "pos" || !["draft", "partial"].includes(sale.status)) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket en attente introuvable." });
    if (sale.sellerUserId !== ctx.user.id && !(sale.warehouseId && await canCheckoutIn(db, ctx.user, sale.warehouseId))) throw new TRPCError({ code: "FORBIDDEN", message: "Ce ticket appartient à un autre vendeur." });
    const items = await db.select({ productId: saleItems.productId, quantity: saleItems.quantity, discountType: saleItems.discountType, discountValue: saleItems.discountValue }).from(saleItems).where(eq(saleItems.saleId, sale.id));
    return { id: sale.id, invoiceNumber: sale.invoiceNumber, status: sale.status, posStage: sale.posStage, queueNumber: sale.queueNumber, holdLabel: sale.holdLabel, totalCents: sale.totalCents, amountPaidCents: sale.amountPaidCents, vatCents: sale.vatCents, invoiceDiscountType: sale.invoiceDiscountType, invoiceDiscountValue: sale.invoiceDiscountValue, items };
  }),

  /** Le vendeur reprend un ticket envoyé en caisse (client revenu avec un autre article). */
  recall: permissionProcedure("sales.create").input(z.object({ saleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const sale = await openTicket(db, ctx.user.companyId, input.saleId);
    if (sale.sellerUserId !== ctx.user.id && !["admin", "manager"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Seul le vendeur qui a préparé ce ticket peut le reprendre." });
    if (sale.posStage !== "queued") return { success: true };
    if (lockedByOther(sale.checkoutLockedBy, sale.checkoutLockedAt, ctx.user.id)) throw new TRPCError({ code: "CONFLICT", message: "Ce ticket est en cours d’encaissement en caisse : il ne peut plus être repris." });
    await db.update(sales).set({ posStage: "parked" }).where(and(eq(sales.id, sale.id), eq(sales.status, "draft")));
    return { success: true };
  }),

  /** Verrouille le ticket à l’ouverture de l’encaissement (2 minutes, renouvelé à chaque ouverture). */
  lock: permissionProcedure("sales.create").input(z.object({ saleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const sale = await openTicket(db, ctx.user.companyId, input.saleId);
    if (sale.warehouseId) await assertSellerWarehouseAccess(db, ctx.user, sale.warehouseId, { permission: "checkout" });
    if (sale.posStage === "parked" && sale.sellerUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Ce panier n’a pas encore été envoyé en caisse par le vendeur." });
    if (lockedByOther(sale.checkoutLockedBy, sale.checkoutLockedAt, ctx.user.id)) throw new TRPCError({ code: "CONFLICT", message: "Ce ticket est déjà en cours d’encaissement sur un autre poste." });
    await db.update(sales).set({ checkoutLockedBy: ctx.user.id, checkoutLockedAt: new Date() }).where(eq(sales.id, sale.id));
    return { success: true };
  }),

  unlock: permissionProcedure("sales.create").input(z.object({ saleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await db.update(sales).set({ checkoutLockedBy: null, checkoutLockedAt: null }).where(and(eq(sales.id, input.saleId), companyScope(sales.companyId, ctx.user.companyId), eq(sales.checkoutLockedBy, ctx.user.id)));
    return { success: true };
  }),

  /** Le caissier renvoie le ticket au vendeur avec un motif (le client veut changer un article). */
  returnToSeller: permissionProcedure("sales.create").input(z.object({ saleId: z.number().int().positive(), reason: z.string().trim().min(2, "Indiquez le motif.").max(300) })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const sale = await openTicket(db, ctx.user.companyId, input.saleId);
    if (sale.warehouseId) await assertSellerWarehouseAccess(db, ctx.user, sale.warehouseId, { permission: "checkout" });
    if (sale.posStage !== "queued") throw new TRPCError({ code: "BAD_REQUEST", message: "Ce ticket n’est pas dans la file de la caisse." });
    if (lockedByOther(sale.checkoutLockedBy, sale.checkoutLockedAt, ctx.user.id)) throw new TRPCError({ code: "CONFLICT", message: "Ce ticket est en cours d’encaissement sur un autre poste." });
    await db.update(sales).set({ posStage: "parked", returnedReason: input.reason, checkoutLockedBy: null, checkoutLockedAt: null }).where(and(eq(sales.id, sale.id), eq(sales.status, "draft")));
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Renvoyé au vendeur", entityType: "Ticket POS", entityId: String(sale.id), detail: `Ticket n° ${sale.queueNumber ?? "—"} (${sale.invoiceNumber}) : ${input.reason}` });
    return { success: true };
  }),

  /** Le caissier annule un ticket non encaissé (client parti) ; aucun stock n’a encore bougé. */
  cancelQueued: permissionProcedure("sales.create").input(z.object({ saleId: z.number().int().positive(), reason: z.string().trim().min(2, "Indiquez le motif.").max(300) })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const sale = await openTicket(db, ctx.user.companyId, input.saleId);
    if (sale.warehouseId) await assertSellerWarehouseAccess(db, ctx.user, sale.warehouseId, { permission: "checkout" });
    if (sale.posStage !== "queued") throw new TRPCError({ code: "BAD_REQUEST", message: "Seuls les tickets envoyés en caisse peuvent être annulés ici." });
    if (sale.amountPaidCents > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Ce ticket a déjà reçu un paiement : il ne peut pas être annulé." });
    if (lockedByOther(sale.checkoutLockedBy, sale.checkoutLockedAt, ctx.user.id)) throw new TRPCError({ code: "CONFLICT", message: "Ce ticket est en cours d’encaissement sur un autre poste." });
    await db.update(sales).set({ status: "void", voidedAt: new Date(), voidReason: input.reason, posStage: null, checkoutLockedBy: null, checkoutLockedAt: null }).where(and(eq(sales.id, sale.id), eq(sales.status, "draft")));
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Ticket annulé en caisse", entityType: "Ticket POS", entityId: String(sale.id), detail: `Ticket n° ${sale.queueNumber ?? "—"} (${sale.invoiceNumber}) : ${input.reason}` });
    return { success: true };
  }),
});
