import { beforeEach, describe, expect, it, vi } from "vitest";
import { documentSequences, saleCommissions, saleItems, salePayments, saleReturns, sales, warehouseStocks, warehouses } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { calculatePartialReturn, formatCreditNoteNumber, requestFingerprint } from "./returnRules";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { transactionsRouter } from "./routers/transactions";
const mockedGetDb = vi.mocked(getDb);
const ctx = (companyId: number): TrpcContext => ({
  user: { id: 1, openId: `return-${companyId}`, name: "Test", email: "test@example.test", loginMethod: "manus", role: "admin", companyId, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"],
});
const sampleSale = { id: 7, companyId: 1, warehouseId: 99, status: "paid", channel: "invoice", invoiceNumber: "FAC-7", paymentMethod: "cash", amountPaidCents: 10000, totalCents: 10000, deliveryFeeCents: 0, returnedCents: 0, returnedCostCents: 0 };
const sampleItem = { id: 51, saleId: 7, productId: 21, productName: "Article", productReference: "SKU-21", quantity: 2, returnedQuantity: 0, lineTotalCents: 10000, lineCostCents: 6000 };
function mockDb({ companyId = 1, includeSale = true }: { companyId?: number; includeSale?: boolean } = {}) {
  const sale = { ...sampleSale };
  const item = { ...sampleItem };
  const returns: any[] = [];
  const inserted: Array<{ table: unknown; value: any }> = [];
  let stockQuantity = 5;
  let sequence = 0;
  const tx: any = {
    select: () => ({ from: (table: unknown) => {
      let rows: any[] = [];
      if (table === sales) rows = includeSale && sale.companyId === companyId ? [sale] : [];
      else if (table === saleItems) rows = [{ ...item }];
      else if (table === saleReturns) rows = returns;
      else if (table === documentSequences) rows = sequence ? [{ lastValue: sequence }] : [];
      else if (table === warehouseStocks) rows = [{ quantity: stockQuantity }];
      else if (table === warehouses) rows = [{ id: 99, companyId, active: true, name: "Entrepôt test" }];
      const query: any = { where: () => query, limit: async () => rows, for: () => query, then: (resolve: (value: any[]) => unknown) => resolve(rows) };
      query.limit = () => query;
      return query;
    } }),
    insert: (table: unknown) => ({ values: (value: any) => {
      inserted.push({ table, value });
      if (table === documentSequences) return { onDuplicateKeyUpdate: async () => { sequence = sequence ? sequence + 1 : value.lastValue; return []; } };
      if (table === warehouseStocks) return { onDuplicateKeyUpdate: async () => { stockQuantity += value.quantity; return []; } };
      if (table === saleReturns) { returns.push({ ...value, id: returns.length + 1 }); return [{ insertId: returns.length }]; }
      return Promise.resolve([{ insertId: 1 }]);
    } }),
    update: (table: unknown) => ({ set: (value: any) => ({ where: async () => {
      if (table === sales) Object.assign(sale, value);
      if (table === saleItems) Object.assign(item, value);
      if (table === warehouseStocks) stockQuantity += 0;
      return [{ affectedRows: 1 }];
    } }) }),
  };
  const db: any = { transaction: async (callback: (value: any) => Promise<any>) => callback(tx) };
  return { db, sale, item, returns, inserted, get stockQuantity() { return stockQuantity; } };
}

describe("partial return rules", () => {
  it("prorates returned lines including discount/TVA embedded in invoice total and excludes delivery", () => {
    const result = calculatePartialReturn({ totalCents: 11000, deliveryFeeCents: 1000, amountPaidCents: 11000 }, [sampleItem], [{ saleItemId: 51, quantity: 1, restock: true }]);
    expect(result.refundCents).toBe(5000);
    expect(result.costCents).toBe(3000);
    expect(result.fullyReturned).toBe(false);
  });
  it("rejects quantities beyond remaining quantity and foreign sale-item IDs", () => {
    expect(() => calculatePartialReturn({ totalCents: 10000, deliveryFeeCents: 0, amountPaidCents: 10000 }, [{ ...sampleItem, returnedQuantity: 1 }], [{ saleItemId: 51, quantity: 2, restock: true }])).toThrow(/dépasse/);
    expect(() => calculatePartialReturn({ totalCents: 10000, deliveryFeeCents: 0, amountPaidCents: 10000 }, [sampleItem], [{ saleItemId: 999, quantity: 1, restock: true }])).toThrow(/n’appartient pas/);
  });
  it("produces stable fingerprints independent of line input order and tenant-local AV labels", () => {
    const a = [{ saleItemId: 9, quantity: 1, restock: true }, { saleItemId: 2, quantity: 2, restock: false }];
    expect(requestFingerprint(a, "cash", null)).toBe(requestFingerprint([...a].reverse(), "cash", null));
    expect(formatCreditNoteNumber(2026, 4)).toBe("AV-2026-000004");
  });
});

describe("transactions.returnItems", () => {
  beforeEach(() => vi.resetAllMocks());
  it("creates a numbered credit, negative payment and warehouse stock entry; retry is idempotent", async () => {
    const mock = mockDb();
    mockedGetDb.mockResolvedValue(mock.db);
    const caller = transactionsRouter.createCaller(ctx(1));
    const input = { saleId: 7, requestKey: "req-return-00000001", lines: [{ saleItemId: 51, quantity: 1, restock: true }], method: "cash" as const };
    const first = await caller.returnItems(input);
    expect(first).toMatchObject({ creditNoteNumber: expect.stringMatching(/^AV-\d{4}-000001$/), refundCents: 5000, fullyReturned: false, replayed: false });
    expect(mock.stockQuantity).toBe(6);
    expect(mock.inserted.find(row => row.table === salePayments)?.value).toMatchObject({ amountCents: -5000, method: "cash" });
    expect(mock.returns[0]).toMatchObject({ requestKey: input.requestKey, refundCents: 5000, warehouseId: 99 });
    const retry = await caller.returnItems(input);
    expect(retry).toMatchObject({ creditNoteNumber: first.creditNoteNumber, refundCents: 5000, replayed: true });
    expect(mock.stockQuantity).toBe(6);
    expect(mock.returns).toHaveLength(1);
  });
  it("rejects reuse of a key for different payload and does not expose another tenant's sale", async () => {
    const mock = mockDb();
    mockedGetDb.mockResolvedValue(mock.db);
    const caller = transactionsRouter.createCaller(ctx(1));
    const input = { saleId: 7, requestKey: "req-return-00000002", lines: [{ saleItemId: 51, quantity: 1, restock: true }] };
    await caller.returnItems(input);
    await expect(caller.returnItems({ ...input, lines: [{ saleItemId: 51, quantity: 1, restock: false }] })).rejects.toMatchObject({ code: "CONFLICT" });
    const foreign = mockDb({ companyId: 2, includeSale: false });
    mockedGetDb.mockResolvedValue(foreign.db);
    await expect(transactionsRouter.createCaller(ctx(2)).returnItems({ ...input, requestKey: "req-return-00000003" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
