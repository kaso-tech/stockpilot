import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, customers, purchaseOrders, saleSettings, sales, suppliers } from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { sendMail } from "../mailer";
import { consumeRateLimit } from "../rateLimit";
import { assertSellerWarehouseAccess } from "../sellerWarehouseAccess";
import { adminProcedure, permissionProcedure, protectedProcedure, router } from "../_core/trpc";

export const MAX_EMAIL_PDF_BYTES = 5 * 1024 * 1024;
export const emailDocumentInput = z.object({
  id: z.number().int().positive(),
  pdfBase64: z.string().min(16).max(Math.ceil(MAX_EMAIL_PDF_BYTES * 4 / 3) + 4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  filename: z.string().trim().min(5).max(120).regex(/^[\w.-]+\.pdf$/i),
  subject: z.string().trim().min(2).max(200).regex(/^[^\r\n\u0000-\u001f\u007f]+$/),
  message: z.string().trim().max(5000),
});

export function decodeEmailPdf(base64: string): Buffer {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_EMAIL_PDF_BYTES) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Le PDF dépasse 5 Mo." });
  if (buffer.byteLength < 8 || buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new TRPCError({ code: "BAD_REQUEST", message: "Le fichier joint n’est pas un PDF valide." });
  return buffer;
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}
function takeSendLimit(companyId: number, req: { ip?: string }) {
  if (!consumeRateLimit(`documents:email:${companyId}:${req.ip || "unknown"}`, 30, 60 * 60 * 1000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop d’envois de documents. Réessayez plus tard." });
}
async function companyReplyTo(db: any, companyId: number) {
  const [settings] = await db.select({ companyEmail: saleSettings.companyEmail }).from(saleSettings).where(companyScope(saleSettings.companyId, companyId)).limit(1);
  return settings?.companyEmail ?? undefined;
}
async function auditSent(db: any, ctx: any, entityType: string, id: number, reference: string) {
  await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Envoi par e-mail", entityType, entityId: String(id), detail: `${reference} envoyé par e-mail` });
}

export const documentsRouter = router({
  sendSale: permissionProcedure("sales.create").input(emailDocumentInput).mutation(async ({ ctx, input }) => {
    const pdf = decodeEmailPdf(input.pdfBase64);
    const companyId = ctx.user.companyId;
    if (companyId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Aucune entreprise active." });
    takeSendLimit(companyId, ctx.req);
    const db = await dbOrThrow();
    const sale = (await db.select().from(sales).where(and(eq(sales.id, input.id), companyScope(sales.companyId, companyId))).limit(1))[0];
    if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Document introuvable." });
    if (sale.warehouseId != null) await assertSellerWarehouseAccess(db, ctx.user, sale.warehouseId);
    const customer = sale.customerId == null ? null : (await db.select({ email: customers.email }).from(customers).where(and(eq(customers.id, sale.customerId), companyScope(customers.companyId, companyId))).limit(1))[0];
    const to = customer?.email?.trim();
    if (!to) throw new TRPCError({ code: "BAD_REQUEST", message: "L’adresse e-mail du client n’est pas renseignée." });
    const replyTo = await companyReplyTo(db, companyId);
    const result = await sendMail({ to, subject: input.subject, text: input.message, replyTo, attachments: [{ filename: input.filename, content: pdf, contentType: "application/pdf" }] });
    if (result.delivered) await auditSent(db, ctx, sale.channel === "quote" ? "Devis" : "Facture", sale.id, sale.invoiceNumber);
    return result;
  }),
  sendPurchaseOrder: permissionProcedure("purchasing.manage").input(emailDocumentInput).mutation(async ({ ctx, input }) => {
    const pdf = decodeEmailPdf(input.pdfBase64);
    const companyId = ctx.user.companyId;
    if (companyId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Aucune entreprise active." });
    takeSendLimit(companyId, ctx.req);
    const db = await dbOrThrow();
    const order = (await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), companyScope(purchaseOrders.companyId, companyId))).limit(1))[0];
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Bon de commande introuvable." });
    if (order.warehouseId != null) await assertSellerWarehouseAccess(db, ctx.user, order.warehouseId);
    const supplier = (await db.select({ email: suppliers.email }).from(suppliers).where(and(eq(suppliers.id, order.supplierId), companyScope(suppliers.companyId, companyId))).limit(1))[0];
    const to = supplier?.email?.trim();
    if (!to) throw new TRPCError({ code: "BAD_REQUEST", message: "L’adresse e-mail du fournisseur n’est pas renseignée." });
    const replyTo = await companyReplyTo(db, companyId);
    const result = await sendMail({ to, subject: input.subject, text: input.message, replyTo, attachments: [{ filename: input.filename, content: pdf, contentType: "application/pdf" }] });
    if (result.delivered) await auditSent(db, ctx, "Bon de commande", order.id, order.orderNumber);
    return result;
  }),
});
