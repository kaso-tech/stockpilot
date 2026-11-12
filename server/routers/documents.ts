import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  customers,
  purchaseOrders,
  saleSettings,
  sales,
  suppliers,
} from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { sendMail } from "../mailer";
import { assertRateLimit } from "../authSessions";
import { protectedProcedure, router } from "../_core/trpc";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const sendInput = z.object({
  id: z.number().int().positive(),
  /** PDF généré par le client (même rendu que le téléchargement), encodé en base64. */
  pdfBase64: z
    .string()
    .min(100)
    .max(Math.ceil((MAX_PDF_BYTES * 4) / 3) + 8),
  filename: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[\w\-. ]+\.pdf$/i, "Nom de fichier PDF invalide."),
  to: z.string().trim().email().max(320).optional(),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().max(5000),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Base de données indisponible.",
    });
  return db;
}

function decodePdf(base64: string) {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_PDF_BYTES)
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Le PDF dépasse 5 Mo.",
    });
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Le fichier joint n'est pas un PDF.",
    });
  return buffer;
}

async function companyReplyTo(db: any, companyId: number | null) {
  const settings = (
    await db
      .select({
        companyEmail: saleSettings.companyEmail,
        companyName: saleSettings.companyName,
      })
      .from(saleSettings)
      .where(companyScope(saleSettings.companyId, companyId))
      .limit(1)
  )[0];
  return settings ?? { companyEmail: null, companyName: null };
}

/**
 * Envoi des documents commerciaux par e-mail depuis le serveur (9.9) : le
 * destinataire reçoit le PDF en pièce jointe, la réponse arrive à l'adresse de
 * l'entreprise. `delivered: false` si aucun serveur SMTP n'est configuré : le
 * client se rabat alors sur le partage local.
 */
export const documentsRouter = router({
  sendSale: protectedProcedure
    .input(sendInput)
    .mutation(async ({ ctx, input }) => {
      assertRateLimit(
        ctx.req,
        `documents:${ctx.user.companyId}`,
        60,
        60 * 60 * 1000
      );
      const db = await dbOrThrow();
      const sale = (
        await db
          .select()
          .from(sales)
          .where(
            and(
              eq(sales.id, input.id),
              companyScope(sales.companyId, ctx.user.companyId)
            )
          )
          .limit(1)
      )[0];
      if (!sale)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document introuvable.",
        });
      const customer = sale.customerId
        ? (
            await db
              .select()
              .from(customers)
              .where(
                and(
                  eq(customers.id, sale.customerId),
                  companyScope(customers.companyId, ctx.user.companyId)
                )
              )
              .limit(1)
          )[0]
        : null;
      const to = input.to ?? customer?.email;
      if (!to)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "L’adresse e-mail du client n’est pas renseignée.",
        });
      const company = await companyReplyTo(db, ctx.user.companyId);
      const result = await sendMail({
        to,
        subject: input.subject,
        text: input.message,
        replyTo: company.companyEmail ?? undefined,
        attachments: [
          {
            filename: input.filename,
            content: decodePdf(input.pdfBase64),
            contentType: "application/pdf",
          },
        ],
      });
      if (result.delivered)
        await db.insert(auditLogs).values({
          companyId: ctx.user.companyId,
          actorUserId: ctx.user.id,
          action: "Envoi par e-mail",
          entityType: sale.channel === "quote" ? "Devis" : "Facture",
          entityId: String(sale.id),
          detail: `${sale.invoiceNumber} envoyé à ${to}`,
        });
      return result;
    }),
  sendPurchaseOrder: protectedProcedure
    .input(sendInput)
    .mutation(async ({ ctx, input }) => {
      assertRateLimit(
        ctx.req,
        `documents:${ctx.user.companyId}`,
        60,
        60 * 60 * 1000
      );
      const db = await dbOrThrow();
      const order = (
        await db
          .select()
          .from(purchaseOrders)
          .where(
            and(
              eq(purchaseOrders.id, input.id),
              companyScope(purchaseOrders.companyId, ctx.user.companyId)
            )
          )
          .limit(1)
      )[0];
      if (!order)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bon de commande introuvable.",
        });
      const supplier = (
        await db
          .select()
          .from(suppliers)
          .where(
            and(
              eq(suppliers.id, order.supplierId),
              companyScope(suppliers.companyId, ctx.user.companyId)
            )
          )
          .limit(1)
      )[0];
      const to = input.to ?? supplier?.email;
      if (!to)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "L’adresse e-mail du fournisseur est indisponible.",
        });
      const company = await companyReplyTo(db, ctx.user.companyId);
      const result = await sendMail({
        to,
        subject: input.subject,
        text: input.message,
        replyTo: company.companyEmail ?? undefined,
        attachments: [
          {
            filename: input.filename,
            content: decodePdf(input.pdfBase64),
            contentType: "application/pdf",
          },
        ],
      });
      if (result.delivered)
        await db.insert(auditLogs).values({
          companyId: ctx.user.companyId,
          actorUserId: ctx.user.id,
          action: "Envoi par e-mail",
          entityType: "Bon de commande",
          entityId: String(order.id),
          detail: `${order.orderNumber} envoyé à ${to}`,
        });
      return result;
    }),
});
