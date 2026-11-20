import { describe, expect, it, vi } from "vitest";
import { customers, sales } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { appRouter } from "./routers";

const mockedGetDb = vi.mocked(getDb);
function context(): TrpcContext { return { user: { id: 1, openId: "client-detail-admin", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, companyId: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }

describe("commerce.customers.get", () => {
  it("retourne le client, ses factures et un solde calculé", async () => {
    const client = { id: 7, name: "Client Démo", type: "ordinary", email: "client@example.test", phone: null, address: null, taxNumber: null, notes: null };
    const invoices = [
      { id: 11, invoiceNumber: "FAC-001", status: "partial", totalCents: 15000, amountPaidCents: 5000, createdAt: new Date("2026-08-22") },
      { id: 10, invoiceNumber: "FAC-000", status: "paid", totalCents: 9000, amountPaidCents: 9000, createdAt: new Date("2026-08-20") },
    ];
    const rows = new Map<unknown, unknown[]>([[customers, [client]], [sales, invoices]]);
    const db: any = { select: () => ({ from: (table: unknown) => { const values = rows.get(table) ?? []; return { where: () => ({ limit: async () => values, orderBy: () => ({ limit: async () => values }) }) }; } }) };
    mockedGetDb.mockResolvedValue(db);
    const result = await appRouter.createCaller(context()).commerce.customers.get({ id: 7 });
    expect(result.customer).toMatchObject({ name: "Client Démo" });
    expect(result.invoices).toHaveLength(2);
    expect(result.summary).toMatchObject({ invoiceCount: 2, totalSalesCents: 24000, outstandingCents: 10000, lastInvoiceAt: new Date("2026-08-22") });
  });
});
