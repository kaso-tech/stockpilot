import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminFallbackPasswords, companies, saleSettings, userSessions, users } from "../drizzle/schema";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);

describe("auth.registerCompany", () => {
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  beforeEach(() => {
    inserts.length = 0;
    const tx: any = {
      insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => { inserts.push({ table, values }); return Object.assign(Promise.resolve([]), { $returningId: async () => [{ id: table === companies ? 41 : 73 }] }); } }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    const db: any = {
      select: () => ({ from: (table: unknown) => table === users ? [] : [] }),
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
      insert: (table: unknown) => ({ values: async (values: Record<string, unknown>) => { inserts.push({ table, values }); return []; } }),
    };
    mockedGetDb.mockResolvedValue(db);
  });

  it("crée une entreprise, son premier administrateur, ses réglages et une session sécurisée", async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const context = { user: null, req: { protocol: "https", headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0)" } }, res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) } } as never;
    await expect(appRouter.createCaller(context).auth.registerCompany({ companyName: "Nova Commerce", administratorName: "Awa Diallo", email: "awa@example.test", password: "MotDePasse!2026", rememberMe: false })).resolves.toEqual({ success: true, companyId: 41 });
    expect(inserts.find(entry => entry.table === companies)?.values).toMatchObject({ name: "Nova Commerce" });
    expect(inserts.find(entry => entry.table === users)?.values).toMatchObject({ companyId: 41, role: "admin", email: "awa@example.test" });
    expect(inserts.find(entry => entry.table === saleSettings)?.values).toMatchObject({ companyId: 41, companyName: "Nova Commerce" });
    expect(inserts.find(entry => entry.table === adminFallbackPasswords)?.values?.passwordHash).toEqual(expect.any(String));
    expect(inserts.find(entry => entry.table === userSessions)?.values).toMatchObject({ userId: 73 });
    expect(cookies[0]?.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "none", maxAge: 86_400_000 });
  });

  it("retourne uniquement la disponibilité d’une adresse e-mail pour l’inscription", async () => {
    const context = { user: null, req: { protocol: "https", headers: {} }, res: {} } as never;
    await expect(appRouter.createCaller(context).auth.emailAvailability({ email: "nouveau@example.test" })).resolves.toEqual({ available: true });
  });
});
