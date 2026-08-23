import { beforeEach, describe, expect, it, vi } from "vitest";
import { saleSettings, sales } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));
import { getDb } from "../db";
import { transactionsRouter } from "./transactions";

const mockedGetDb = vi.mocked(getDb);
const context = (): TrpcContext => ({ user: { id: 1, openId: "checkout-tester", name: "Test", email: "test@example.test", loginMethod: "manus", role: "admin", companyId: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] });

describe("transactions.checkout", () => {
  beforeEach(() => {
    const sale = { id: 7, status: "draft", channel: "invoice", totalCents: 10000, amountPaidCents: 0 };
    const tx: any = { select: () => ({ from: (table: unknown) => { const rows: any = table === sales ? [sale] : table === saleSettings ? [{ paymentCashEnabled: false }] : []; rows.limit = async () => rows; rows.where = () => rows; return rows; } }) };
    mockedGetDb.mockResolvedValue({ transaction: async (callback: (db: typeof tx) => Promise<void>) => callback(tx) } as any);
  });
  it("renvoie BAD_REQUEST avant tout encaissement si le moyen est désactivé", async () => {
    const caller = transactionsRouter.createCaller(context());
    await expect(caller.checkout({ saleId: 7, settlementMode: "full", payments: [{ method: "cash", amountCents: 10000 }], salesAgentId: null, cashierId: null, note: null })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("désactivé") });
  });

  it("refuse une vente qui n’est pas visible dans l’entreprise active", async () => {
    const tx: any = { select: () => ({ from: () => { const rows: any[] = []; (rows as any).limit = async () => rows; (rows as any).where = () => rows; return rows; } }) };
    mockedGetDb.mockResolvedValue({ transaction: async (callback: (db: typeof tx) => Promise<void>) => callback(tx) } as any);
    const caller = transactionsRouter.createCaller(context());
    await expect(caller.checkout({ saleId: 999, settlementMode: "full", payments: [{ method: "cash", amountCents: 10000 }], salesAgentId: null, cashierId: null, note: null })).rejects.toMatchObject({ code: "NOT_FOUND", message: expect.stringContaining("introuvable") });
  });
});
