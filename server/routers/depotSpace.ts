import { TRPCError } from "@trpc/server";
import { and, eq, gte, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { cashClosures, inventorySessions, products, saleItems, sales, sellerWarehouseAssignments, stockTransfers, users, warehouseStocks, warehouses } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { companyScope } from "../companyScope";
import { companyTimezone, dayKey } from "../companyTime";
import { getDb } from "../db";
import { warehouseRoleForUser } from "../sellerWarehouseAccess";
import { getScopedWarehouse, warehouseLowStock } from "../warehouseStock";
import { daySummary } from "./accounting";

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }

const ROLE_LABELS: Record<string, string> = { manager: "Gérant de dépôt", cashier: "Caissier", seller: "Vendeur" };

/** Le tableau de bord d'un dépôt est ouvert à ses gérants (et aux administrateurs et gérants d'entreprise). */
async function assertDepotManager(db: Awaited<ReturnType<typeof dbOrThrow>>, user: { id: number; role: any; companyId: number | null }, warehouseId: number) {
  const warehouse = await getScopedWarehouse(db, user.companyId, warehouseId, { requireActive: true });
  if (user.role === "admin" || user.role === "manager") return warehouse;
  if (user.role === "seller" && await warehouseRoleForUser(db, user, warehouse.id) === "manager") return warehouse;
  throw new TRPCError({ code: "FORBIDDEN", message: "Ce tableau de bord est réservé aux gérants de ce dépôt." });
}

export const depotSpaceRouter = router({
  /** Dépôts que l'utilisateur gère (vide pour un vendeur qui n'est gérant nulle part). */
  managedWarehouses: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    if (ctx.user.role === "admin" || ctx.user.role === "manager") return db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(and(companyScope(warehouses.companyId, ctx.user.companyId), eq(warehouses.active, true))).orderBy(warehouses.name);
    if (ctx.user.role !== "seller") return [];
    return db.select({ id: warehouses.id, name: warehouses.name }).from(sellerWarehouseAssignments).innerJoin(warehouses, eq(warehouses.id, sellerWarehouseAssignments.warehouseId)).where(and(companyScope(sellerWarehouseAssignments.companyId, ctx.user.companyId), eq(sellerWarehouseAssignments.sellerUserId, ctx.user.id), eq(sellerWarehouseAssignments.warehouseRole, "manager"), eq(warehouses.active, true))).orderBy(warehouses.name);
  }),

  /** Activité du dépôt : ventes, caisse, stock, transferts, inventaires et équipe. Sans coûts ni marges. */
  overview: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const warehouse = await assertDepotManager(db, ctx.user, input.warehouseId);
    const companyId = ctx.user.companyId;
    const timezone = await companyTimezone(db, companyId);
    const today = dayKey(new Date(), timezone);
    const month = today.slice(0, 7);
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 40);
    const [cash, closure, saleRows, pendingRows, low, stockRows, transferRows, inventoryRows, teamRows] = await Promise.all([
      daySummary(db, companyId, warehouse.id, today, timezone),
      db.select({ expectedCashCents: cashClosures.expectedCashCents, countedCashCents: cashClosures.countedCashCents, differenceCents: cashClosures.differenceCents }).from(cashClosures).where(and(companyScope(cashClosures.companyId, companyId), eq(cashClosures.warehouseId, warehouse.id), eq(cashClosures.businessDay, today))).limit(1),
      db.select({ id: sales.id, channel: sales.channel, status: sales.status, totalCents: sales.totalCents, createdAt: sales.createdAt, sellerUserId: sales.sellerUserId }).from(sales).where(and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, warehouse.id), gte(sales.createdAt, since))),
      db.select({ channel: sales.channel, status: sales.status, posStage: sales.posStage, totalCents: sales.totalCents, amountPaidCents: sales.amountPaidCents }).from(sales).where(and(companyScope(sales.companyId, companyId), eq(sales.warehouseId, warehouse.id), inArray(sales.status, ["draft", "partial"]))),
      warehouseLowStock(db, companyId, warehouse.id),
      db.select({ productId: warehouseStocks.productId, quantity: warehouseStocks.quantity }).from(warehouseStocks).where(and(companyScope(warehouseStocks.companyId, companyId), eq(warehouseStocks.warehouseId, warehouse.id))),
      db.select({ id: stockTransfers.id, status: stockTransfers.status, sourceWarehouseId: stockTransfers.sourceWarehouseId, destinationWarehouseId: stockTransfers.destinationWarehouseId }).from(stockTransfers).where(and(companyScope(stockTransfers.companyId, companyId), inArray(stockTransfers.status, ["draft", "in_transit"]), or(eq(stockTransfers.sourceWarehouseId, warehouse.id), eq(stockTransfers.destinationWarehouseId, warehouse.id)))),
      db.select({ id: inventorySessions.id }).from(inventorySessions).where(and(companyScope(inventorySessions.companyId, companyId), eq(inventorySessions.warehouseId, warehouse.id), eq(inventorySessions.status, "draft"))),
      db.select({ userId: users.id, name: users.name, active: users.active, warehouseRole: sellerWarehouseAssignments.warehouseRole }).from(sellerWarehouseAssignments).innerJoin(users, eq(users.id, sellerWarehouseAssignments.sellerUserId)).where(and(companyScope(sellerWarehouseAssignments.companyId, companyId), eq(sellerWarehouseAssignments.warehouseId, warehouse.id))),
    ]);
    const sold = saleRows.filter(sale => sale.channel !== "quote" && (sale.status === "paid" || sale.status === "partial"));
    const day = (date: Date) => dayKey(date, timezone);
    const todaySales = sold.filter(sale => day(sale.createdAt) === today);
    const monthSales = sold.filter(sale => day(sale.createdAt).startsWith(month));
    const monthSaleIds = monthSales.map(sale => sale.id);
    const lineRows = monthSaleIds.length ? await db.select({ productId: saleItems.productId, productName: saleItems.productName, quantity: saleItems.quantity, lineTotalCents: saleItems.lineTotalCents }).from(saleItems).where(inArray(saleItems.saleId, monthSaleIds)) : [];
    const top = new Map<number, { productName: string; quantity: number; revenueCents: number }>();
    for (const line of lineRows) { const current = top.get(line.productId) ?? { productName: line.productName, quantity: 0, revenueCents: 0 }; current.quantity += line.quantity; current.revenueCents += line.lineTotalCents; top.set(line.productId, current); }
    const lowIds = Array.from(low.low.keys());
    const lowNames = lowIds.length ? await db.select({ id: products.id, name: products.name, unit: products.unit }).from(products).where(and(companyScope(products.companyId, companyId), inArray(products.id, lowIds))) : [];
    const lowItems = lowIds.map(id => { const product = lowNames.find(row => row.id === id); const entry = low.low.get(id)!; return { productId: id, name: product?.name ?? "Produit", unit: product?.unit ?? "", quantity: entry.quantity, threshold: entry.threshold }; }).sort((a, b) => (a.quantity - a.threshold) - (b.quantity - b.threshold));
    const pendingTickets = pendingRows.filter(row => row.channel === "pos" && row.posStage === "queued");
    const unpaidInvoices = pendingRows.filter(row => row.channel === "invoice");
    const openQuotes = pendingRows.filter(row => row.channel === "quote" && row.status === "draft");
    const balance = (rows: typeof pendingRows) => rows.reduce((sum, row) => sum + Math.max(0, row.totalCents - row.amountPaidCents), 0);
    return {
      warehouse: { id: warehouse.id, name: warehouse.name },
      today,
      sales: {
        todayCount: todaySales.length, todayRevenueCents: todaySales.reduce((sum, sale) => sum + sale.totalCents, 0),
        monthCount: monthSales.length, monthRevenueCents: monthSales.reduce((sum, sale) => sum + sale.totalCents, 0),
        averageBasketCents: monthSales.length ? Math.round(monthSales.reduce((sum, sale) => sum + sale.totalCents, 0) / monthSales.length) : 0,
      },
      pending: { ticketCount: pendingTickets.length, ticketBalanceCents: balance(pendingTickets), invoiceCount: unpaidInvoices.length, invoiceBalanceCents: balance(unpaidInvoices), quoteCount: openQuotes.length },
      cash: { totals: cash.totals, totalCents: cash.totalCents, documentCount: cash.documentCount, closure: closure[0] ?? null },
      stock: { references: stockRows.filter(row => row.quantity > 0).length, units: stockRows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0), lowCount: lowItems.length, lowItems: lowItems.slice(0, 8) },
      transfers: { incoming: transferRows.filter(row => row.destinationWarehouseId === warehouse.id && row.status === "in_transit").length, outgoing: transferRows.filter(row => row.sourceWarehouseId === warehouse.id).length },
      inventories: { open: inventoryRows.length },
      team: teamRows.filter(row => row.active).map(row => ({ userId: row.userId, name: row.name ?? "Vendeur", role: ROLE_LABELS[row.warehouseRole] ?? row.warehouseRole, salesToday: todaySales.filter(sale => sale.sellerUserId === row.userId).length, revenueTodayCents: todaySales.filter(sale => sale.sellerUserId === row.userId).reduce((sum, sale) => sum + sale.totalCents, 0) })).sort((a, b) => b.revenueTodayCents - a.revenueTodayCents),
      topProducts: Array.from(top.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    };
  }),
});
