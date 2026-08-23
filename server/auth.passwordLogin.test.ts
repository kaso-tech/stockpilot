import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminFallbackPasswords, sellerCredentials, users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { hashPassword } from "./passwords";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);

function publicContext(cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
  return {
    user: null,
    req: { protocol: "https", hostname: "stockpilot-gpaoheuz.manus.space", headers: {} },
    res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) },
  } as never;
}

describe("auth.passwordLogin", () => {
  const admin = { id: 1, openId: "admin-password-test", name: "Administrateur", email: "admin@example.test", role: "admin" as const, active: true };
  const seller = { id: 2, openId: "seller-password-test", name: "Vendeur", email: "vendeur@example.test", role: "seller" as const, active: true };

  beforeEach(async () => {
    const adminPasswordHash = await hashPassword("Admin!2026");
    const sellerPasswordHash = await hashPassword("Vendeur!2026");
    const db: any = {
      select: () => ({
        from: (table: unknown) => {
          if (table === users) return [admin, seller];
          const rows = table === adminFallbackPasswords
            ? [{ id: 1, ownerOpenId: admin.openId, passwordHash: adminPasswordHash }]
            : table === sellerCredentials
              ? [{ id: 2, userId: seller.id, username: "vendeur", passwordHash: sellerPasswordHash }]
              : [];
          return { where: () => ({ limit: async () => rows }) };
        },
      }),
    };
    mockedGetDb.mockResolvedValue(db);
  });

  it("ouvre une session administrateur sécurisée avec e-mail et mot de passe", async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    await expect(appRouter.createCaller(publicContext(cookies)).auth.passwordLogin({ email: "ADMIN@example.test", password: "Admin!2026" })).resolves.toEqual({ success: true, role: "admin" });
    expect(cookies[0]).toMatchObject({ name: COOKIE_NAME, options: { secure: true, sameSite: "none", httpOnly: true } });
  });

  it("ouvre une session vendeur avec son e-mail et son mot de passe", async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    await expect(appRouter.createCaller(publicContext(cookies)).auth.passwordLogin({ email: "vendeur@example.test", password: "Vendeur!2026" })).resolves.toEqual({ success: true, role: "seller" });
    expect(cookies).toHaveLength(1);
  });

  it("refuse les identifiants invalides sans émettre de cookie", async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    await expect(appRouter.createCaller(publicContext(cookies)).auth.passwordLogin({ email: "vendeur@example.test", password: "mot-de-passe-invalide" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toHaveLength(0);
  });
});
