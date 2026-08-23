import { beforeEach, describe, expect, it, vi } from "vitest";
import { companies, customers, products, saleSettings } from "../drizzle/schema";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

describe("onboarding.status", () => {
  beforeEach(() => {
    const rowsFor = (table: unknown) => table === companies ? [{ id: 9, onboardingCompletedAt: null }] : table === products ? [] : table === customers ? [] : table === saleSettings ? [{ paymentCashEnabled: true, paymentCardEnabled: false, paymentMobileMoneyEnabled: false, paymentBankTransferEnabled: false, paymentCreditEnabled: false }] : [];
    const db: any = { select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => rowsFor(table) }) }) }) };
    vi.mocked(getDb).mockResolvedValue(db);
  });

  it("signale les étapes restantes et un moyen de paiement déjà configuré", async () => {
    const context = { user: { id: 4, openId: "new-admin", name: "Admin", email: "admin@example.test", loginMethod: "password", role: "admin", active: true, companyId: 9, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} }, res: {} } as never;
    await expect(appRouter.createCaller(context).onboarding.status()).resolves.toEqual({ completed: false, steps: { product: false, customer: false, paymentMethod: true } });
  });
});
