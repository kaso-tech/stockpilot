import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn(), listAuditLogs: vi.fn(), listMovements: vi.fn(), listProducts: vi.fn(), listSuppliers: vi.fn(), listUsers: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";
import { hashPassword } from "./passwords";
import { sellerCredentials, users } from "../drizzle/schema";

const mockedGetDb = vi.mocked(getDb);

function context() {
  const cookies: Array<{ name: string; value: string }> = [];
  const ctx = { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { cookie: (name: string, value: string) => cookies.push({ name, value }), clearCookie: () => undefined } as TrpcContext["res"] } satisfies TrpcContext;
  return { ctx, cookies };
}

describe("auth.localLogin", () => {
  const insertedSessions: Array<Record<string, unknown>> = [];
  async function setSeller(active: boolean, password = "Vendeur!2026") {
    const passwordHash = await hashPassword(password);
    const account = { id: 7, openId: "local_seller_1", name: "Vendeur", active, role: "seller", companyId: null, emailNormalized: null };
    // La base filtre les comptes inactifs : la fausse base renvoie le compte seulement s'il est actif.
    const fromTable = (table: unknown) => table === users ? { where: async () => (active ? [account] : []) } : table === sellerCredentials ? { where: () => ({ limit: async () => [{ userId: 7, username: "vendeur", passwordHash }] }) } : { where: () => ({ limit: async () => [] }) };
    mockedGetDb.mockResolvedValue({ select: () => ({ from: fromTable }), insert: () => ({ values: async (values: Record<string, unknown>) => { insertedSessions.push(values); return []; } }) } as any);
  }
  beforeEach(() => { vi.clearAllMocks(); insertedSessions.length = 0; });
  it("ouvre une session pour un vendeur actif avec le bon mot de passe", async () => {
    await setSeller(true); const { ctx, cookies } = context();
    await expect(appRouter.createCaller(ctx).auth.localLogin({ username: "vendeur", password: "Vendeur!2026" })).resolves.toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(insertedSessions[0]).toMatchObject({ userId: 7 });
  });
  it("refuse un mot de passe erroné", async () => {
    await setSeller(true); const { ctx } = context();
    await expect(appRouter.createCaller(ctx).auth.localLogin({ username: "vendeur", password: "incorrect" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("refuse la connexion d’un vendeur désactivé", async () => {
    await setSeller(false); const { ctx } = context();
    await expect(appRouter.createCaller(ctx).auth.localLogin({ username: "vendeur", password: "Vendeur!2026" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
