import { TRPCError } from "@trpc/server";
import { and, between, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  cashClosures,
  customers,
  salePayments,
  saleReturns,
  sales,
} from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { companyTimezone, dayKey } from "../companyTime";
import { getDb } from "../db";
import { conflictOr } from "../dbErrors";
import { MAX_CENTS } from "../numericLimits";
import { permissionProcedure, router } from "../_core/trpc";
import {
  accountingEntries,
  entriesAreBalanced,
  fecFile,
  paymentsJournalCsv,
  salesJournalCsv,
  type PaymentRecord,
  type ReturnRecord,
  type SaleRecord,
} from "../accounting";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ attendue.");
const DAY_MS = 86_400_000;

async function dbOrThrow() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Base de données indisponible.",
    });
  return db;
}

/** Fenêtre UTC couvrant largement les journées locales demandées (le filtre exact se fait par fuseau). */
function utcWindow(from: string, to: string) {
  return {
    start: new Date(Date.parse(`${from}T00:00:00Z`) - DAY_MS),
    end: new Date(Date.parse(`${to}T23:59:59Z`) + DAY_MS),
  };
}

async function loadPeriod(
  db: any,
  companyId: number | null,
  from: string,
  to: string,
  timezone: string
) {
  const { start, end } = utcWindow(from, to);
  const inPeriod = (date: Date) => {
    const key = dayKey(date, timezone);
    return key >= from && key <= to;
  };
  const returnRows: ReturnRecord[] = await db
    .select({
      saleId: saleReturns.saleId,
      creditNoteNumber: saleReturns.creditNoteNumber,
      refundCents: saleReturns.refundCents,
      createdAt: saleReturns.createdAt,
    })
    .from(saleReturns)
    .where(
      and(
        companyScope(saleReturns.companyId, companyId),
        between(saleReturns.createdAt, start, end)
      )
    );
  const saleWindow = or(
    between(sales.createdAt, start, end),
    between(sales.refundedAt, start, end),
    between(sales.voidedAt, start, end)
  );
  const returnSaleIds = Array.from(new Set(returnRows.map(row => row.saleId)));
  const saleRows = await db
    .select()
    .from(sales)
    .where(
      and(
        companyScope(sales.companyId, companyId),
        returnSaleIds.length
          ? or(saleWindow, inArray(sales.id, returnSaleIds))
          : saleWindow
      )
    )
    .orderBy(sales.createdAt, sales.id);
  const paymentRows = await db
    .select({
      saleId: salePayments.saleId,
      method: salePayments.method,
      amountCents: salePayments.amountCents,
      createdAt: salePayments.createdAt,
      invoiceNumber: sales.invoiceNumber,
      customerId: sales.customerId,
    })
    .from(salePayments)
    .innerJoin(sales, eq(salePayments.saleId, sales.id))
    .where(
      and(
        companyScope(sales.companyId, companyId),
        between(salePayments.createdAt, start, end)
      )
    )
    .orderBy(salePayments.createdAt);
  const customerIds = Array.from(
    new Set(
      [...saleRows, ...paymentRows]
        .map((row: { customerId: number | null }) => row.customerId)
        .filter((id): id is number => id !== null)
    )
  );
  const customerRows = customerIds.length
    ? await db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(
          and(
            inArray(customers.id, customerIds),
            companyScope(customers.companyId, companyId)
          )
        )
    : [];
  const customerNames = new Map<number, string>(
    customerRows.map((row: { id: number; name: string }) => [row.id, row.name])
  );
  const salesData: SaleRecord[] = saleRows.map((sale: any) => ({
    ...sale,
    customerName: sale.customerId
      ? (customerNames.get(sale.customerId) ?? null)
      : null,
  }));
  const payments: PaymentRecord[] = paymentRows.map((row: any) => ({
    ...row,
    customerName: row.customerId
      ? (customerNames.get(row.customerId) ?? null)
      : null,
  }));
  return { sales: salesData, returns: returnRows, payments, inPeriod };
}

/** Totaux d'encaissement d'une journée, par moyen de paiement (remboursements déduits). */
async function daySummary(
  db: any,
  companyId: number | null,
  businessDay: string,
  timezone: string
) {
  const { payments, inPeriod } = await loadPeriod(
    db,
    companyId,
    businessDay,
    businessDay,
    timezone
  );
  const dayPayments = payments.filter(payment => inPeriod(payment.createdAt));
  const totals: Record<string, number> = {
    cash: 0,
    card: 0,
    mobile_money: 0,
    bank_transfer: 0,
    credit: 0,
  };
  for (const payment of dayPayments)
    totals[payment.method] =
      (totals[payment.method] ?? 0) + payment.amountCents;
  return {
    businessDay,
    totals,
    documentCount: new Set(dayPayments.map(payment => payment.saleId)).size,
    totalCents: dayPayments.reduce(
      (sum, payment) => sum + payment.amountCents,
      0
    ),
  };
}

export const accountingRouter = router({
  export: permissionProcedure("accounting.export")
    .input(
      z.object({
        from: day,
        to: day,
        format: z.enum(["sales_csv", "payments_csv", "fec"]),
        referential: z.enum(["pcg", "syscohada"]).default("pcg"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.from > input.to)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La date de début doit précéder la date de fin.",
        });
      if (Date.parse(input.to) - Date.parse(input.from) > 400 * DAY_MS)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La période exportée est limitée à 13 mois.",
        });
      const db = await dbOrThrow();
      const timezone = await companyTimezone(db, ctx.user.companyId);
      const period = await loadPeriod(
        db,
        ctx.user.companyId,
        input.from,
        input.to,
        timezone
      );
      const dayOf = (date: Date) => dayKey(date, timezone);
      const suffix = `${input.from}_${input.to}`;
      let filename: string;
      let content: string;
      if (input.format === "sales_csv") {
        filename = `journal-ventes_${suffix}.csv`;
        content = salesJournalCsv(
          period.sales.filter(sale => period.inPeriod(sale.createdAt)),
          dayOf
        );
      } else if (input.format === "payments_csv") {
        filename = `journal-encaissements_${suffix}.csv`;
        content = paymentsJournalCsv(
          period.payments.filter(payment => period.inPeriod(payment.createdAt)),
          dayOf
        );
      } else {
        const entries = accountingEntries({
          ...period,
          referential: input.referential,
          dayOf,
        });
        if (!entriesAreBalanced(entries))
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Écritures déséquilibrées : export interrompu.",
          });
        filename = `FEC_${input.referential}_${input.to.replaceAll("-", "")}.txt`;
        content = fecFile(entries, dayKey(new Date(), timezone));
      }
      await db.insert(auditLogs).values({
        companyId: ctx.user.companyId,
        actorUserId: ctx.user.id,
        action: "Export comptable",
        entityType: "Comptabilité",
        entityId: null,
        detail: `${filename} (${input.from} → ${input.to})`,
      });
      return {
        filename,
        content,
        mimeType: input.format === "fec" ? "text/plain" : "text/csv",
      };
    }),
  cash: router({
    summary: permissionProcedure("cash.close")
      .input(z.object({ businessDay: day.optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        const timezone = await companyTimezone(db, ctx.user.companyId);
        const businessDay = input?.businessDay ?? dayKey(new Date(), timezone);
        const summary = await daySummary(
          db,
          ctx.user.companyId,
          businessDay,
          timezone
        );
        const closure =
          (
            await db
              .select()
              .from(cashClosures)
              .where(
                and(
                  eq(cashClosures.businessDay, businessDay),
                  companyScope(cashClosures.companyId, ctx.user.companyId)
                )
              )
              .limit(1)
          )[0] ?? null;
        return { ...summary, closure };
      }),
    close: permissionProcedure("cash.close")
      .input(
        z.object({
          businessDay: day,
          openingFloatCents: z.number().int().min(0).max(MAX_CENTS),
          countedCashCents: z.number().int().min(0).max(MAX_CENTS),
          note: z.string().trim().max(500).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        const timezone = await companyTimezone(db, ctx.user.companyId);
        if (input.businessDay > dayKey(new Date(), timezone))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Impossible de clôturer une journée future.",
          });
        const summary = await daySummary(
          db,
          ctx.user.companyId,
          input.businessDay,
          timezone
        );
        const expectedCashCents = input.openingFloatCents + summary.totals.cash;
        const differenceCents = input.countedCashCents - expectedCashCents;
        try {
          await db.insert(cashClosures).values({
            companyId: ctx.user.companyId,
            businessDay: input.businessDay,
            openingFloatCents: input.openingFloatCents,
            cashSalesCents: summary.totals.cash,
            expectedCashCents,
            countedCashCents: input.countedCashCents,
            differenceCents,
            totalsByMethodJson: JSON.stringify(summary.totals),
            documentCount: summary.documentCount,
            note: input.note ?? null,
            closedByUserId: ctx.user.id,
          });
        } catch (error) {
          conflictOr(error, "Cette journée est déjà clôturée.");
        }
        await db.insert(auditLogs).values({
          companyId: ctx.user.companyId,
          actorUserId: ctx.user.id,
          action: "Clôture de caisse",
          entityType: "Caisse",
          entityId: input.businessDay,
          detail: `Attendu ${expectedCashCents}, compté ${input.countedCashCents}, écart ${differenceCents} centimes`,
        });
        return { expectedCashCents, differenceCents };
      }),
    history: permissionProcedure("cash.close").query(async ({ ctx }) => {
      const db = await dbOrThrow();
      return db
        .select()
        .from(cashClosures)
        .where(companyScope(cashClosures.companyId, ctx.user.companyId))
        .orderBy(desc(cashClosures.businessDay))
        .limit(60);
    }),
  }),
});
