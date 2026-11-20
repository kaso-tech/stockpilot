import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyYengaPayWebhookSignature } from "./yengaPayWebhook";

describe("secret webhook YengaPay", () => {
  it("permet de vérifier localement une signature HMAC-SHA256 sans le divulguer", () => {
    const secret = process.env.YENGAPAY_WEBHOOK_SECRET;
    expect(secret).toBeTruthy();

    const body = Buffer.from('{"event":"payment.success","id":"sandbox-check"}', "utf8");
    const signature = createHmac("sha256", secret!).update(body).digest("hex");

    expect(verifyYengaPayWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyYengaPayWebhookSignature(body, "f".repeat(64), secret)).toBe(false);
  });
});
