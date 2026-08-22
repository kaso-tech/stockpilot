import { beforeEach, describe, expect, it, vi } from "vitest";
import { agents, customers, saleCommissions, saleItems, salePayments, sales, users } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));
import { getDb } from "../db";
import { commerceRouter } from "./commerce";

const mockedGetDb = vi.mocked(getDb);
function sellerContext(): TrpcContext { return { user: { id: 1, openId: "seller-detail", name: "Vendeur", email: "v@example.test", loginMethod: "manus", role: "seller", active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }

describe("commerce.sales.detail", () => {
  beforeEach(() => {
    let agentRead = 0;
    const sale = { id: 80, invoiceNumber: "FAC-80", customerId: 4, sellerUserId: 3, salesAgentId: 7, cashierId: 8, subtotalCents: 24000, totalCents: 24000, paymentMethod: "cash", createdAt: new Date() };
    const db: any = { select: () => ({ from: (table: unknown) => { const rows = table === sales ? [sale] : table === customers ? [{ id: 4, name: "Client pro", type: "wholesale" }] : table === saleItems ? [{ id: 1, productName: "Article", quantity: 2, unitPriceCents: 12000, lineTotalCents: 24000 }] : table === salePayments ? [{ id: 4, method: "cash", amountCents: 24000 }] : table === saleCommissions ? [] : table === users ? [{ id: 3, name: "Kadré Vendeur", email: null }] : table === agents ? [agentRead++ === 0 ? { id: 7, name: "Aminata Commerciale" } : { id: 8, name: "Moussa Caissier" }] : []; const chain = Object.assign(rows, { limit: async () => rows }); return { where: () => chain, then: (resolve: any) => resolve(rows) }; } }) };
    mockedGetDb.mockResolvedValue(db);
  });
  it("retourne les lignes, le total et les noms des trois intervenants", async () => {
    const detail = await commerceRouter.createCaller(sellerContext()).sales.detail({ id: 80 });
    expect(detail.sale.totalCents).toBe(24000);
    expect(detail.items).toHaveLength(1);
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]).toMatchObject({ id: 4, method: "cash", amountCents: 24000 });
    expect(detail.participants).toEqual({ seller: { id: 3, name: "Kadré Vendeur", role: "Vendeur" }, salesAgent: { id: 7, name: "Aminata Commerciale", role: "Agent commercial" }, cashier: { id: 8, name: "Moussa Caissier", role: "Caissier" } });
  });
});
