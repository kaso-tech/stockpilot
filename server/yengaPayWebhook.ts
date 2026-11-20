import { createHmac, timingSafeEqual } from "node:crypto";

/** Vérifie une signature HMAC-SHA256 YengaPay sans exposer le secret ou le corps de la notification. */
export function verifyYengaPayWebhookSignature(rawBody: Buffer, signature: string | undefined, secret: string | undefined) {
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) return false;

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
}
