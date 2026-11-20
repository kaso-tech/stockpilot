import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, supportRequests } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { companyScope } from "../companyScope";
import { consumeRateLimit } from "../rateLimit";
import { storagePut } from "../storage";
import { getScopedWarehouse } from "../warehouseStock";
import { hasValidSupportImageSignature, isSupportImageMimeType, normalizeSupportFilename } from "../supportRequestRules";

const MAX_SUPPORT_IMAGE_BYTES = 3 * 1024 * 1024;

const screenshotInput = z.object({
  dataUrl: z.string().min(30).max(4_500_000),
  filename: z.string().trim().min(1).max(180),
}).nullable().optional();

const supportInput = z.object({
  subject: z.string().trim().min(4).max(180),
  message: z.string().trim().min(10).max(2_000),
  warehouseId: z.number().int().positive().nullable().optional(),
  screenshot: screenshotInput,
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}

function parseScreenshot(input: z.infer<typeof screenshotInput>) {
  if (!input) return null;
  const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !isSupportImageMimeType(match[1])) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "La capture doit être une image PNG, JPEG ou WEBP valide." });
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_SUPPORT_IMAGE_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "La capture ne doit pas dépasser 3 Mo." });
  }
  if (!hasValidSupportImageSignature(match[1], buffer)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Le contenu de la capture ne correspond pas au format annoncé." });
  }
  const extension = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
  return { buffer, mimeType: match[1], filename: normalizeSupportFilename(input.filename), extension };
}

export const supportRouter = router({
  create: protectedProcedure.input(supportInput).mutation(async ({ ctx, input }) => {
    if (!consumeRateLimit(`support:${ctx.user.companyId ?? "legacy"}:${ctx.user.id}`, 6, 15 * 60 * 1000)) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de demandes récentes. Réessayez dans quelques minutes." });
    }
    const db = await dbOrThrow();
    const warehouse = input.warehouseId ? await getScopedWarehouse(db, ctx.user.companyId, input.warehouseId, { requireActive: false }) : null;
    const screenshot = parseScreenshot(input.screenshot);
    const attachment = screenshot
      ? await storagePut(`company/${ctx.user.companyId ?? "legacy"}/support/${ctx.user.id}/${randomUUID()}.${screenshot.extension}`, screenshot.buffer, screenshot.mimeType)
      : null;
    const result = await db.insert(supportRequests).values({
      companyId: ctx.user.companyId,
      requesterUserId: ctx.user.id,
      warehouseId: warehouse?.id ?? null,
      subject: input.subject,
      message: input.message,
      attachmentKey: attachment?.key ?? null,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: screenshot?.filename ?? null,
      attachmentMimeType: screenshot?.mimeType ?? null,
    });
    const id = Number(result[0].insertId);
    await db.insert(auditLogs).values({
      companyId: ctx.user.companyId,
      actorUserId: ctx.user.id,
      action: "Demande d’assistance créée",
      entityType: "Demande d’assistance",
      entityId: String(id),
      detail: `Demande créée${warehouse ? ` pour l’entrepôt ${warehouse.code}` : ""}${attachment ? " avec capture jointe" : ""}.`,
    });
    return { id };
  }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    return db.select().from(supportRequests).where(and(companyScope(supportRequests.companyId, ctx.user.companyId), eq(supportRequests.requesterUserId, ctx.user.id))).orderBy(desc(supportRequests.createdAt));
  }),

  adminList: adminProcedure.input(z.object({ status: z.enum(["open", "in_progress", "closed"]).optional() }).optional()).query(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    return db.select().from(supportRequests).where(and(companyScope(supportRequests.companyId, ctx.user.companyId), ...(input?.status ? [eq(supportRequests.status, input.status)] : []))).orderBy(desc(supportRequests.createdAt));
  }),

  updateStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["open", "in_progress", "closed"]) })).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    const request = (await db.select().from(supportRequests).where(and(eq(supportRequests.id, input.id), companyScope(supportRequests.companyId, ctx.user.companyId))).limit(1))[0];
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Demande d’assistance introuvable." });
    await db.update(supportRequests).set({
      status: input.status,
      handledByUserId: ctx.user.id,
      resolvedAt: input.status === "closed" ? new Date() : null,
    }).where(and(eq(supportRequests.id, input.id), companyScope(supportRequests.companyId, ctx.user.companyId)));
    await db.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Statut assistance modifié", entityType: "Demande d’assistance", entityId: String(input.id), detail: `Statut défini sur ${input.status}.` });
    return { success: true };
  }),
});
