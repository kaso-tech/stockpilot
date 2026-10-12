import { beforeEach, describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { ctx, realDb, realDbUrl, resetDatabase, seedTenant, type SeededTenant } from "./realDb";
import { appRouter } from "../routers";
import { sdk } from "../_core/sdk";
import { clearRateLimitsForTests } from "../rateLimit";
import { userSessions, users } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import type { TrpcContext } from "../_core/context";

const remuneration = { remunerationMode: "commission" as const, fixedMonthlyCents: 0, commissionBasis: "revenue" as const, rateBasisPoints: 500, active: true };

function publicCtx(ip = "203.0.113.10") {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const context = { user: null, req: { protocol: "https", hostname: "app.example.test", ip, headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0)" } }, res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }), clearCookie: () => undefined } } as unknown as TrpcContext;
  return { context, cookies };
}

async function authenticate(token: string) {
  return sdk.authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${token}` } } as never);
}

describe.skipIf(!realDbUrl)("Lot 2 — authentification et sessions (MySQL réel)", () => {
  let a: SeededTenant;

  beforeEach(async () => {
    clearRateLimitsForTests();
    await resetDatabase();
    a = await seedTenant("a");
  });

  it("inscrit une entreprise, ouvre une session suivie et refuse les e-mails déjà pris (casse ignorée)", async () => {
    const { context, cookies } = publicCtx();
    const caller = appRouter.createCaller(context);
    const result = await caller.auth.registerCompany({ companyName: "Nova", administratorName: "Awa", email: "Awa@Nova.test", password: "MotDePasse!2026", rememberMe: false });
    expect(result.success).toBe(true);
    const user = await authenticate(cookies[0]!.value);
    expect(user).toMatchObject({ role: "admin", companyId: result.companyId });
    expect(user.sessionId).toBeTruthy();
    expect(await caller.auth.emailAvailability({ email: "awa@nova.TEST" })).toEqual({ available: false });
    await expect(caller.auth.registerCompany({ companyName: "Copie", administratorName: "Xavier", email: "AWA@nova.test", password: "MotDePasse!2026" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("connecte un administrateur et un vendeur, refuse un mauvais mot de passe ou un compte inconnu", async () => {
    const { context: register } = publicCtx();
    await appRouter.createCaller(register).auth.registerCompany({ companyName: "Nova", administratorName: "Awa", email: "admin@nova.test", password: "MotDePasse!2026" });
    const { context, cookies } = publicCtx();
    const caller = appRouter.createCaller(context);
    await expect(caller.auth.passwordLogin({ email: "ADMIN@nova.test", password: "MotDePasse!2026" })).resolves.toMatchObject({ success: true, role: "admin" });
    await expect(caller.auth.passwordLogin({ email: "admin@nova.test", password: "faux" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.auth.passwordLogin({ email: "inconnu@nova.test", password: "faux" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await appRouter.createCaller(ctx(a.admin)).commerce.sellers.create({ name: "Vendeur", email: "vendeur@a.example", username: "vendeur.a", password: "Vendeur!2026", remuneration });
    await expect(caller.auth.passwordLogin({ email: "vendeur@a.example", password: "Vendeur!2026" })).resolves.toMatchObject({ role: "seller" });
    expect(cookies).toHaveLength(2);
  });

  it("A1 — refuse un jeton de session non suivi en base", async () => {
    const token = await sdk.createSessionToken(a.admin.openId, { name: "Admin" });
    await expect(authenticate(token)).rejects.toThrow();
  });

  it("A6 — changer le mot de passe ou désactiver un vendeur révoque ses sessions", async () => {
    const admin = appRouter.createCaller(ctx(a.admin));
    const { id } = await admin.commerce.sellers.create({ name: "Vendeur", email: "v@a.example", username: "v.a", password: "Vendeur!2026", remuneration });
    const login = async () => { const { context, cookies } = publicCtx(); await appRouter.createCaller(context).auth.passwordLogin({ email: "v@a.example", password: "Vendeur!2026" }); return cookies[0]!.value; };
    const first = await login();
    await expect(authenticate(first)).resolves.toMatchObject({ id });
    await admin.commerce.sellers.update({ id, name: "Vendeur", email: "v@a.example", username: "v.a", password: "Nouveau!2026", remuneration });
    await expect(authenticate(first)).rejects.toThrow();
    const { context, cookies } = publicCtx();
    await appRouter.createCaller(context).auth.passwordLogin({ email: "v@a.example", password: "Nouveau!2026" });
    await admin.commerce.sellers.remove({ id });
    await expect(authenticate(cookies[0]!.value)).rejects.toThrow();
  });

  it("A6 — un administrateur ne peut pas révoquer ou désactiver le vendeur d'une autre entreprise", async () => {
    const b = await seedTenant("b");
    await expect(appRouter.createCaller(ctx(a.admin)).commerce.sellers.remove({ id: b.seller.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const db = await realDb();
    expect((await db.select().from(users).where(eq(users.id, b.seller.id)))[0]?.active).toBe(true);
  });

  it("revokeOthers ne ferme que les autres sessions de l'utilisateur", async () => {
    const db = await realDb();
    const future = new Date(Date.now() + 86_400_000);
    await db.insert(userSessions).values([{ id: "11111111-1111-4111-8111-111111111111", userId: a.admin.id, deviceLabel: "A", expiresAt: future }, { id: "22222222-2222-4222-8222-222222222222", userId: a.admin.id, deviceLabel: "B", expiresAt: future }, { id: "33333333-3333-4333-8333-333333333333", userId: a.seller.id, deviceLabel: "C", expiresAt: future }]);
    const result = await appRouter.createCaller(ctx({ ...a.admin, sessionId: "11111111-1111-4111-8111-111111111111" })).auth.sessions.revokeOthers();
    expect(result.revokedCount).toBe(1);
    const active = await db.select().from(userSessions).where(isNull(userSessions.revokedAt));
    expect(active.map(row => row.id).sort()).toEqual(["11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333"]);
  });

  it("A2/A5 — limite les tentatives par IP Express (pas par X-Forwarded-For) et l'inscription", async () => {
    const attempts = async (ip: string, spoofed: string) => {
      const { context } = publicCtx(ip);
      (context.req.headers as Record<string, string>)["x-forwarded-for"] = spoofed;
      return appRouter.createCaller(context).auth.passwordLogin({ email: `x${Math.random()}@nova.test`, password: "faux" }).then(() => "OK", error => error.code as string);
    };
    const codes: string[] = [];
    for (let index = 0; index < 31; index += 1) codes.push(await attempts("198.51.100.7", `10.0.0.${index}`));
    expect(codes.slice(0, 30).every(code => code === "UNAUTHORIZED")).toBe(true);
    expect(codes[30]).toBe("TOO_MANY_REQUESTS");
    const register = (index: number) => appRouter.createCaller(publicCtx("198.51.100.8").context).auth.registerCompany({ companyName: `Spam ${index}`, administratorName: "Spam", email: `spam${index}@x.test`, password: "MotDePasse!2026" }).then(() => "OK", error => error.code as string);
    const results: string[] = [];
    for (let index = 0; index < 6; index += 1) results.push(await register(index));
    expect(results.slice(0, 5)).toEqual(["OK", "OK", "OK", "OK", "OK"]);
    expect(results[5]).toBe("TOO_MANY_REQUESTS");
  });
});
