import { beforeEach, describe, expect, it, vi } from "vitest";
import { userSessions } from "../drizzle/schema";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);
const currentSessionId = "11111111-1111-4111-8111-111111111111";
const otherSessionId = "22222222-2222-4222-8222-222222222222";

function authenticatedContext() {
  return {
    user: { id: 7, openId: "session-user", name: "Utilisateur", email: "user@example.test", phone: null, loginMethod: "password", role: "seller", active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), sessionId: currentSessionId },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: vi.fn() },
  } as never;
}

describe("auth.sessions", () => {
  const updates: Array<{ values: Record<string, unknown>; id: string }> = [];
  const sessions = [
    { id: currentSessionId, userId: 7, deviceLabel: "Ordinateur Windows", userAgent: null, createdAt: new Date("2026-08-20"), lastSeenAt: new Date("2026-08-23"), expiresAt: new Date("2026-09-22"), revokedAt: null },
    { id: otherSessionId, userId: 7, deviceLabel: "Appareil Android", userAgent: null, createdAt: new Date("2026-08-21"), lastSeenAt: new Date("2026-08-22"), expiresAt: new Date("2026-09-22"), revokedAt: null },
    { id: "33333333-3333-4333-8333-333333333333", userId: 7, deviceLabel: "Ordinateur Mac", userAgent: null, createdAt: new Date("2026-08-19"), lastSeenAt: new Date("2026-08-20"), expiresAt: new Date("2026-09-22"), revokedAt: new Date("2026-08-21") },
  ];

  beforeEach(() => {
    updates.length = 0;
    const db: any = {
      select: () => ({ from: (table: unknown) => {
        const rows = table === userSessions ? sessions : [];
        return { where: () => Object.assign(Promise.resolve(rows), { orderBy: async () => rows, limit: async () => rows }) };
      } }),
      update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updates.push({ values, id: otherSessionId }); } }) }),
    };
    mockedGetDb.mockResolvedValue(db);
  });

  it("liste les sessions actives et identifie la session courante", async () => {
    const result = await appRouter.createCaller(authenticatedContext()).auth.sessions.list();
    expect(result).toHaveLength(2);
    expect(result.find(session => session.id === currentSessionId)?.isCurrent).toBe(true);
    expect(result.find(session => session.id === otherSessionId)?.isCurrent).toBe(false);
  });

  it("révoque une autre session sans fermer la session courante", async () => {
    await expect(appRouter.createCaller(authenticatedContext()).auth.sessions.revoke({ sessionId: otherSessionId })).resolves.toEqual({ success: true });
    expect(updates).toHaveLength(1);
    await expect(appRouter.createCaller(authenticatedContext()).auth.sessions.revoke({ sessionId: currentSessionId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("révoque toutes les autres sessions actives", async () => {
    await expect(appRouter.createCaller(authenticatedContext()).auth.sessions.revokeOthers()).resolves.toEqual({ success: true, revokedCount: 1 });
    expect(updates).toHaveLength(1);
  });
});
