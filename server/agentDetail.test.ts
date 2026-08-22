import { describe, expect, it, vi } from "vitest";
import { agentPayments, agents, customers, remunerationProfiles, saleCommissions, sales } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);
const context = (): TrpcContext => ({ user: { id: 1, openId: "agent-detail-admin", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] });

function queryResult<T>(values: T[]) {
  return Object.assign(values, { limit: async () => values, orderBy: () => queryResult(values) });
}

describe("commerce.agents.detail", () => {
  it("retourne l’historique réel, commissions et statistiques d’un agent", async () => {
    const rows = new Map<unknown, unknown[]>([
      [agents, [{ id: 4, name: "Awa Traoré", type: "sales_agent", email: "awa@example.test", phone: "+22501020304", active: true, createdAt: new Date("2026-08-01") }]],
      [remunerationProfiles, [{ id: 1, beneficiaryType: "agent", beneficiaryId: 4, remunerationMode: "commission", fixedMonthlyCents: 0, commissionBasis: "revenue", rateBasisPoints: 500, active: true }]],
      [saleCommissions, [{ id: 1, saleId: 9, beneficiaryType: "agent", beneficiaryId: 4, commissionBasis: "revenue", rateBasisPoints: 500, commissionCents: 1250, createdAt: new Date("2026-08-22") }]],
      [agentPayments, [{ id: 2, beneficiaryType: "agent", beneficiaryId: 4, amountCents: 500, paidAt: new Date("2026-08-22"), periodLabel: "2026-08", note: null }]],
      [sales, [{ id: 9, invoiceNumber: "FAC-009", status: "paid", totalCents: 25000, netProfitCents: 6000, customerId: 7, createdAt: new Date("2026-08-22") }]],
      [customers, [{ id: 7, name: "Client fidèle" }]],
    ]);
    const db: any = { select: () => ({ from: (table: unknown) => ({ where: () => queryResult((rows.get(table) ?? []) as any[]) }) }) };
    mockedGetDb.mockResolvedValue(db);
    const result = await appRouter.createCaller(context()).commerce.agents.detail({ beneficiaryType: "agent", id: 4 });
    expect(result.agent).toMatchObject({ name: "Awa Traoré", role: "Agent commercial", phone: "+22501020304" });
    expect(result.summary).toMatchObject({ salesCount: 1, revenueCents: 25000, commissionCents: 1250, paidCents: 500 });
    expect(result.sales[0]).toMatchObject({ invoiceNumber: "FAC-009", customerName: "Client fidèle" });
    expect(result.commissions[0]).toMatchObject({ invoiceNumber: "FAC-009", commissionCents: 1250 });
  });
});
