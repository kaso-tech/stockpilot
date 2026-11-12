import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  ctx,
  realDb,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";
import { memoryOutbox } from "../mailer";
import { clearRateLimitsForTests } from "../rateLimit";
import { userSessions, users } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

process.env.MAIL_TRANSPORT = "memory";
process.env.PUBLIC_APP_URL = "https://app.example.test";

const remuneration = {
  remunerationMode: "commission" as const,
  fixedMonthlyCents: 0,
  commissionBasis: "revenue" as const,
  rateBasisPoints: 0,
  active: true,
};
function publicCaller() {
  const context = {
    user: null,
    req: {
      protocol: "https",
      ip: "203.0.113.20",
      headers: {},
      get: () => "app.example.test",
    },
    res: { cookie: () => undefined, clearCookie: () => undefined },
  } as unknown as TrpcContext;
  return appRouter.createCaller(context);
}
const tokenIn = (text: string) =>
  text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? "";

describe.skipIf(!realDbUrl)(
  "Lot 9.1 — mot de passe oublié et vérification d'e-mail (MySQL réel)",
  () => {
    let a: SeededTenant;

    beforeEach(async () => {
      clearRateLimitsForTests();
      memoryOutbox.length = 0;
      await resetDatabase();
      a = await seedTenant("a");
    });

    it("réinitialise le mot de passe d'un vendeur, ferme ses sessions et refuse un lien réutilisé", async () => {
      await appRouter.createCaller(ctx(a.admin)).commerce.sellers.create({
        name: "Vendeur",
        email: "vendeur@a.test",
        username: "vendeur.a",
        password: "Ancien!2026",
        remuneration,
      });
      const seller = (
        await (await realDb())
          .select()
          .from(users)
          .where(eq(users.email, "vendeur@a.test"))
      )[0]!;
      await (await realDb()).insert(userSessions).values({
        id: "55555555-5555-4555-8555-555555555555",
        userId: seller.id,
        deviceLabel: "x",
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      await expect(
        publicCaller().auth.requestPasswordReset({ email: "VENDEUR@a.test" })
      ).resolves.toEqual({ success: true });
      expect(memoryOutbox).toHaveLength(1);
      expect(memoryOutbox[0]!.text).toContain(
        "https://app.example.test/reinitialiser-mot-de-passe?token="
      );
      const token = tokenIn(memoryOutbox[0]!.text);
      await expect(
        publicCaller().auth.resetPassword({ token, password: "Nouveau!20266" })
      ).resolves.toEqual({ success: true });
      await expect(
        publicCaller().auth.resetPassword({ token, password: "Encore!202666" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(
        (
          await (await realDb())
            .select()
            .from(userSessions)
            .where(eq(userSessions.userId, seller.id))
        )[0]?.revokedAt
      ).not.toBeNull();
      await expect(
        publicCaller().auth.passwordLogin({
          email: "vendeur@a.test",
          password: "Nouveau!20266",
        })
      ).resolves.toMatchObject({ role: "seller" });
      await expect(
        publicCaller().auth.passwordLogin({
          email: "vendeur@a.test",
          password: "Ancien!2026",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("répond de la même façon pour une adresse inconnue, sans envoyer d'e-mail", async () => {
      await expect(
        publicCaller().auth.requestPasswordReset({
          email: "inconnu@nulle-part.test",
        })
      ).resolves.toEqual({ success: true });
      expect(memoryOutbox).toHaveLength(0);
    });

    it("réinitialise le mot de passe d'un administrateur", async () => {
      await publicCaller().auth.registerCompany({
        companyName: "Nova",
        administratorName: "Awa",
        email: "awa@nova.test",
        password: "MotDePasse!2026",
      });
      memoryOutbox.length = 0;
      await publicCaller().auth.requestPasswordReset({
        email: "awa@nova.test",
      });
      await publicCaller().auth.resetPassword({
        token: tokenIn(memoryOutbox[0]!.text),
        password: "Changement!2026",
      });
      await expect(
        publicCaller().auth.passwordLogin({
          email: "awa@nova.test",
          password: "Changement!2026",
        })
      ).resolves.toMatchObject({ role: "admin" });
    });

    it("envoie un lien de vérification à l'inscription et le valide une seule fois", async () => {
      await publicCaller().auth.registerCompany({
        companyName: "Nova",
        administratorName: "Awa",
        email: "awa@nova.test",
        password: "MotDePasse!2026",
      });
      expect(memoryOutbox[0]!.subject).toContain("Confirmez");
      const account = (
        await (await realDb())
          .select()
          .from(users)
          .where(eq(users.email, "awa@nova.test"))
      )[0]!;
      expect(account.emailVerifiedAt).toBeNull();
      const token = tokenIn(memoryOutbox[0]!.text);
      await expect(publicCaller().auth.verifyEmail({ token })).resolves.toEqual(
        { success: true }
      );
      await expect(
        publicCaller().auth.verifyEmail({ token })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(
        (
          await (await realDb())
            .select()
            .from(users)
            .where(eq(users.id, account.id))
        )[0]!.emailVerifiedAt
      ).not.toBeNull();
    });

    it("refuse un jeton expiré", async () => {
      await publicCaller().auth.requestPasswordReset({ email: a.admin.email! });
      const token = tokenIn(memoryOutbox[0]!.text);
      const { authTokens } = await import("../../drizzle/schema");
      await (await realDb())
        .update(authTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) });
      await expect(
        publicCaller().auth.resetPassword({ token, password: "Nouveau!20266" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  }
);
