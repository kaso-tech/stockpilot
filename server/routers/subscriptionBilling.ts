import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auditLogs, companies, companySubscriptions, saasPaymentIntents, subscriptionPlans } from "../../drizzle/schema";
import { getDb } from "../db";
import { getYengaPaySandboxConfig, isYengaPaySandboxPayInEnabled } from "../yengaPayConfig";
import { protectedProcedure, router } from "../_core/trpc";

const MIN_YENGAPAY_AMOUNT_CENTS = 100;
const checkoutInput = z.object({
  planId: z.number().int().positive(),
  requestKey: z.string().uuid(),
});

const yengaPayCreateResponse = z.object({
  id: z.string().trim().min(1).max(180),
  status: z.string().trim().min(1).max(80),
  checkoutPageUrlWithPaymentToken: z.string().url().max(1600),
});

function assertYengaPayCheckoutUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".yengapay.com")) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La réponse de paiement ne contient pas une URL de checkout autorisée." });
  }
  return url.toString();
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le service d’abonnement est temporairement indisponible." });
  return db;
}

async function requireCompanyOwner(db: any, companyId: number, userId: number) {
  const company = (await db.select({ ownerUserId: companies.ownerUserId }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  if (!company || company.ownerUserId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seul le propriétaire de l’entreprise peut ouvrir un checkout d’abonnement." });
  }
}

function publicIntent(intent: any) {
  return {
    id: intent.id,
    planId: intent.planId,
    amountCents: intent.amountCents,
    currency: intent.currency,
    billingInterval: intent.billingInterval,
    status: intent.status,
    checkoutUrl: intent.checkoutUrl ?? null,
    createdAt: intent.createdAt,
    confirmedAt: intent.confirmedAt ?? null,
  };
}

export const subscriptionBillingRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbOrThrow();
    await requireCompanyOwner(db, ctx.user.companyId, ctx.user.id);
    const [subscription, plans, intents] = await Promise.all([
      db.select().from(companySubscriptions).where(eq(companySubscriptions.companyId, ctx.user.companyId)).limit(1),
      db.select({ id: subscriptionPlans.id, code: subscriptionPlans.code, name: subscriptionPlans.name, description: subscriptionPlans.description, priceCents: subscriptionPlans.priceCents, currency: subscriptionPlans.currency, billingInterval: subscriptionPlans.billingInterval, trialDays: subscriptionPlans.trialDays }).from(subscriptionPlans).where(eq(subscriptionPlans.active, true)).orderBy(subscriptionPlans.sortOrder, subscriptionPlans.name),
      db.select().from(saasPaymentIntents).where(eq(saasPaymentIntents.companyId, ctx.user.companyId)).orderBy(desc(saasPaymentIntents.createdAt)).limit(8),
    ]);
    return {
      subscription: subscription[0] ?? null,
      plans,
      intents: intents.map(publicIntent),
      checkoutEnabled: isYengaPaySandboxPayInEnabled(),
    };
  }),

  createCheckout: protectedProcedure.input(checkoutInput).mutation(async ({ ctx, input }) => {
    const db = await dbOrThrow();
    await requireCompanyOwner(db, ctx.user.companyId, ctx.user.id);
    if (!isYengaPaySandboxPayInEnabled()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Le checkout YengaPay est en cours de validation technique. Aucun paiement ne peut encore être créé." });
    }

    const existing = (await db.select().from(saasPaymentIntents).where(and(eq(saasPaymentIntents.companyId, ctx.user.companyId), eq(saasPaymentIntents.requestKey, input.requestKey))).limit(1))[0];
    if (existing) return { ...publicIntent(existing), reused: true };

    const plan = (await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, input.planId), eq(subscriptionPlans.active, true))).limit(1))[0];
    if (!plan || plan.billingInterval !== "monthly" || plan.currency !== "XOF" || plan.priceCents < MIN_YENGAPAY_AMOUNT_CENTS) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Cette offre ne peut pas être réglée par le checkout YengaPay configuré." });
    }

    const reference = `SP-${ctx.user.companyId}-${randomUUID()}`;
    let intentId: number;
    try {
      const insert = await db.insert(saasPaymentIntents).values({
        companyId: ctx.user.companyId,
        planId: plan.id,
        createdByUserId: ctx.user.id,
        requestKey: input.requestKey,
        reference,
        amountCents: plan.priceCents,
        currency: plan.currency,
        billingInterval: "monthly",
        provider: "yengapay",
        status: "created",
      });
      intentId = Number(insert[0].insertId);
    } catch {
      const concurrent = (await db.select().from(saasPaymentIntents).where(and(eq(saasPaymentIntents.companyId, ctx.user.companyId), eq(saasPaymentIntents.requestKey, input.requestKey))).limit(1))[0];
      if (concurrent) return { ...publicIntent(concurrent), reused: true };
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La demande de paiement n’a pas pu être préparée. Réessayez." });
    }

    const config = getYengaPaySandboxConfig();
    let providerResponse: z.infer<typeof yengaPayCreateResponse>;
    try {
      const response = await fetch(config.paymentIntentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": config.apiKey },
        body: JSON.stringify({
          paymentAmount: plan.priceCents,
          reference,
          apiEnv: "test",
          articles: [{ title: plan.name, description: plan.description ?? `Abonnement ${plan.name}`, price: plan.priceCents }],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`YengaPay HTTP ${response.status}`);
      providerResponse = yengaPayCreateResponse.parse(payload);
    } catch (error) {
      await db.update(saasPaymentIntents).set({ status: "failed" }).where(eq(saasPaymentIntents.id, intentId));
      console.warn("[YengaPay] création PayIn SANDBOX indisponible", { companyId: ctx.user.companyId, intentId, reason: error instanceof Error ? error.message : "unknown" });
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Le checkout de test est temporairement indisponible. Réessayez plus tard." });
    }

    const checkoutUrl = assertYengaPayCheckoutUrl(providerResponse.checkoutPageUrlWithPaymentToken);
    await db.transaction(async (tx: any) => {
      await tx.update(saasPaymentIntents).set({ status: "pending", providerIntentId: providerResponse.id, providerStatus: providerResponse.status, checkoutUrl }).where(and(eq(saasPaymentIntents.id, intentId), eq(saasPaymentIntents.status, "created")));
      await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Checkout abonnement préparé", entityType: "Abonnement SaaS", entityId: String(intentId), detail: `Intent YengaPay SANDBOX créé pour ${plan.name}, ${plan.priceCents} ${plan.currency}.` });
    });
    return { id: intentId, planId: plan.id, amountCents: plan.priceCents, currency: plan.currency, billingInterval: "monthly" as const, status: "pending" as const, checkoutUrl, createdAt: new Date(), confirmedAt: null, reused: false };
  }),
});
