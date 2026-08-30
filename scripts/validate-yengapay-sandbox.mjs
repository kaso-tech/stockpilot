import "dotenv/config";
import { randomUUID } from "node:crypto";

const organizationId = process.env.YENGAPAY_ORGANIZATION_ID?.trim();
const projectId = process.env.YENGAPAY_SANDBOX_PROJECT_ID?.trim();
const apiKey = process.env.YENGAPAY_API_KEY?.trim();
if (!organizationId || !projectId || !apiKey) throw new Error("Configuration YengaPay SANDBOX incomplète.");

const response = await fetch(`https://api.yengapay.com/api/v1/groups/${organizationId}/payment-intent/${projectId}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": apiKey },
  body: JSON.stringify({
    paymentAmount: 1000,
    reference: `SP-SANDBOX-CHECK-${randomUUID()}`,
    apiEnv: "test",
    articles: [{ title: "Vérification StockPilot", description: "Validation technique SANDBOX", price: 1000 }],
  }),
});
const payload = await response.json().catch(() => null);
const body = payload && typeof payload === "object" ? payload : {};
console.log(JSON.stringify({
  httpStatus: response.status,
  paymentIntentCreated: Boolean(body.id),
  checkoutUrlReturned: typeof body.checkoutPageUrlWithPaymentToken === "string",
  providerStatus: typeof body.status === "string" ? body.status : null,
}));
if (!response.ok || !body.id || typeof body.checkoutPageUrlWithPaymentToken !== "string") process.exitCode = 1;
