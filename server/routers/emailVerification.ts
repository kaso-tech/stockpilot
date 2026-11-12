import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authTokens, users } from "../../drizzle/schema";
import { authenticatedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { appUrl, accountMailerConfigured, sendMail } from "../mailer";
import { consumeRateLimit } from "../rateLimit";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const emailVerificationRouter = router({
  status: authenticatedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const row = db ? (await db.select({ verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, ctx.user.id)).limit(1))[0] : null;
    return { verifiedAt: row?.verifiedAt ?? null, available: accountMailerConfigured() };
  }),
  request: authenticatedProcedure.mutation(async ({ ctx }) => {
    if (!consumeRateLimit(`email-verification:${ctx.user.id}`, 3, 60 * 60 * 1000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Veuillez patienter avant de demander un nouveau lien." });
    if (!accountMailerConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "L’envoi d’e-mail serveur n’est pas configuré. La vérification reste facultative." });
    const origin = appUrl();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
    const token = randomBytes(32).toString("base64url");
    const account = await db.transaction(async tx => {
      const row = (await tx.select().from(users).where(and(eq(users.id, ctx.user.id), eq(users.active, true))).limit(1).for("update"))[0];
      if (!row?.email || !row.emailNormalized) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Adresse e-mail de compte manquante." });
      await tx.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, row.id), eq(authTokens.type, "email_verification"), isNull(authTokens.usedAt)));
      await tx.insert(authTokens).values({ userId: row.id, type: "email_verification", tokenHash: hash(token), emailHash: hash(row.emailNormalized), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      return row;
    });
    const result = await sendMail({ to: account.email!, subject: "Confirmez votre adresse StockPilot", text: `Confirmez votre adresse avec ce lien valable 24 heures : ${origin}/verifier-email?token=${encodeURIComponent(token)}\nSi vous n’êtes pas à l’origine de cette demande, ignorez-la. Votre accès actuel n’est pas bloqué.` });
    if (!result.delivered) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "L’e-mail n’a pas pu être envoyé. Réessayez plus tard." });
    return { success: true };
  }),
  verify: publicProcedure.input(z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })).mutation(async ({ ctx, input }) => {
    if (!consumeRateLimit(`email-verification-consume:${ctx.req.ip ?? "unknown"}`, 30, 60 * 60 * 1000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de tentatives. Réessayez plus tard." });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
    return db.transaction(async tx => {
      const token = (await tx.select().from(authTokens).where(and(eq(authTokens.type, "email_verification"), eq(authTokens.tokenHash, hash(input.token)), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1).for("update"))[0];
      if (!token) throw new TRPCError({ code: "BAD_REQUEST", message: "Lien invalide, expiré ou déjà utilisé." });
      const user = (await tx.select().from(users).where(and(eq(users.id, token.userId), eq(users.active, true))).limit(1).for("update"))[0];
      if (!user?.emailNormalized || token.emailHash !== hash(user.emailNormalized)) throw new TRPCError({ code: "BAD_REQUEST", message: "L’adresse a changé ; demandez un nouveau lien." });
      await tx.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, token.id));
      await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
      return { success: true };
    });
  }),
});
