import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { auditLogs, companySubscriptions, saasPaymentEvents, saasPaymentIntents, subscriptionPlans } from "../drizzle/schema";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "./db";
import { verifyYengaPayWebhookSignature } from "./yengaPayWebhook";

const MAX_WEBHOOK_BYTES = 128 * 1024;

type ParsedYengaPayWebhook = {
  eventType: string;
  providerReference: string | null;
  payloadSha256: string;
};

function readNonEmptyString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

/** Analyse exclusivement les métadonnées requises ; le corps complet n’est jamais persisté. */
export function parseVerifiedYengaPayWebhook(rawBody: Buffer, eventHeader: string | undefined): ParsedYengaPayWebhook | null {
  if (rawBody.length === 0 || rawBody.length > MAX_WEBHOOK_BYTES) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const eventType = readNonEmptyString(eventHeader, 96);
  if (!eventType) return null;

  const record = payload as Record<string, unknown>;
  const providerReference =
    readNonEmptyString(record.reference, 180) ??
    readNonEmptyString(record.transId, 180) ??
    readNonEmptyString(record.id, 180);

  return {
    eventType,
    providerReference,
    payloadSha256: createHash("sha256").update(rawBody).digest("hex"),
  };
}

/**
 * Réception YengaPay : signature obligatoire, stockage minimal et idempotence par empreinte.
 * Aucun abonnement ne peut être activé dans ce handler : la réconciliation PayIn restera séparée.
 */
export async function receiveYengaPayWebhook(req: Request, res: Response) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const signatureHeader = req.header("x-webhook-hash") ?? undefined;
  const eventHeader = req.header("x-yengapay-event") ?? undefined;

  if (!verifyYengaPayWebhookSignature(rawBody, signatureHeader, process.env.YENGAPAY_WEBHOOK_SECRET)) {
    return res.status(401).json({ accepted: false, code: "invalid_signature" });
  }

  const parsed = parseVerifiedYengaPayWebhook(rawBody, eventHeader);
  if (!parsed) return res.status(400).json({ accepted: false, code: "invalid_payload" });

  const db = await getDb();
  if (!db) return res.status(503).json({ accepted: false, code: "storage_unavailable" });

  const isPayInSuccess = parsed.eventType === "payment.success";
  const existingEvent = (await db.select().from(saasPaymentEvents).where(and(eq(saasPaymentEvents.provider, "yengapay"), eq(saasPaymentEvents.payloadSha256, parsed.payloadSha256))).limit(1))[0];
  const eventId = existingEvent?.id ?? Number((await db.insert(saasPaymentEvents).values({
    provider: "yengapay",
    eventType: parsed.eventType,
    providerReference: parsed.providerReference,
    payloadSha256: parsed.payloadSha256,
    signatureVerified: true,
    status: isPayInSuccess ? "received" : "ignored",
  }))[0].insertId);

  if (!isPayInSuccess || !parsed.providerReference) return res.status(200).json({ accepted: true });

  await db.transaction(async (tx: any) => {
    const intent = (await tx.select().from(saasPaymentIntents).where(eq(saasPaymentIntents.reference, parsed.providerReference!)).limit(1))[0];
    if (!intent) {
      await tx.update(saasPaymentEvents).set({ status: "ignored" }).where(eq(saasPaymentEvents.id, eventId));
      return;
    }
    await tx.update(saasPaymentEvents).set({ companyId: intent.companyId }).where(eq(saasPaymentEvents.id, eventId));
    const confirmation = await tx.update(saasPaymentIntents).set({ status: "confirmed", providerStatus: "SUCCESS", paymentEventId: eventId, confirmedAt: new Date() }).where(and(eq(saasPaymentIntents.id, intent.id), eq(saasPaymentIntents.status, "pending")));
    if (!Number(confirmation[0]?.affectedRows ?? 0)) return;

    const plan = (await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, intent.planId)).limit(1))[0];
    if (!plan || plan.billingInterval !== "monthly" || plan.currency !== "XOF" || plan.priceCents !== intent.amountCents) {
      await tx.update(saasPaymentIntents).set({ status: "reconciliation_required" }).where(eq(saasPaymentIntents.id, intent.id));
      return;
    }
    const previous = (await tx.select().from(companySubscriptions).where(eq(companySubscriptions.companyId, intent.companyId)).limit(1))[0];
    const now = new Date();
    const startsAt = previous?.currentPeriodEndsAt && previous.currentPeriodEndsAt > now ? previous.currentPeriodEndsAt : now;
    const nextPeriodEndsAt = new Date(startsAt);
    nextPeriodEndsAt.setMonth(nextPeriodEndsAt.getMonth() + 1);
    await tx.insert(companySubscriptions).values({ companyId: intent.companyId, planId: plan.id, status: "active", trialEndsAt: null, currentPeriodEndsAt: nextPeriodEndsAt, graceEndsAt: null, cancelledAt: null, updatedByPlatformUserId: null }).onDuplicateKeyUpdate({ set: { planId: plan.id, status: "active", trialEndsAt: null, currentPeriodEndsAt: nextPeriodEndsAt, graceEndsAt: null, cancelledAt: null, updatedByPlatformUserId: null } });
    await tx.update(saasPaymentEvents).set({ status: "processed", companyId: intent.companyId, processedAt: now }).where(eq(saasPaymentEvents.id, eventId));
    await tx.insert(auditLogs).values({ companyId: intent.companyId, actorUserId: intent.createdByUserId, action: "Abonnement confirmé", entityType: "Abonnement SaaS", entityId: String(intent.id), detail: `Paiement YengaPay SANDBOX confirmé pour l’offre ${plan.name}.` });
  });

  return res.status(200).json({ accepted: true });
}
