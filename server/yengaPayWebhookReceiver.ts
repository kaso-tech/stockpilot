import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { saasPaymentEvents } from "../drizzle/schema";
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
  await db.insert(saasPaymentEvents).values({
    provider: "yengapay",
    eventType: parsed.eventType,
    providerReference: parsed.providerReference,
    payloadSha256: parsed.payloadSha256,
    signatureVerified: true,
    status: isPayInSuccess ? "received" : "ignored",
  }).onDuplicateKeyUpdate({
    set: { payloadSha256: parsed.payloadSha256 },
  });

  return res.status(200).json({ accepted: true });
}
