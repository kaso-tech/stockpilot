import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  listOfflineOperations,
  migrateLegacyOfflineStorage,
  offlineDatabase,
  offlineScopeKey,
  readOfflineScope,
  replaceOfflineScope,
  type OfflineScope,
} from "./offlineStore";

type MemoryStorage = Pick<Storage, "getItem" | "removeItem"> & { values: Map<string, string> };
function createMemoryStorage(initial: Record<string, unknown[]>) : MemoryStorage {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return { values, getItem: key => values.get(key) ?? null, removeItem: key => { values.delete(key); } };
}

const scope: OfflineScope = { companyId: 12, userId: 4 };

beforeEach(async () => {
  await offlineDatabase.delete();
  await offlineDatabase.open();
});

describe("offlineScopeKey", () => {
  it("sépare les données hors connexion par entreprise et utilisateur", () => {
    expect(offlineScopeKey({ companyId: 12, userId: 4 })).toBe("company:12:user:4");
    expect(offlineScopeKey({ companyId: 13, userId: 4 })).not.toBe(offlineScopeKey({ companyId: 12, userId: 4 }));
  });

  it("refuse les comptes sans entreprise", () => {
    expect(() => offlineScopeKey({ companyId: null as never, userId: 4 })).toThrow("périmètre offline");
  });
});

describe("migrateLegacyOfflineStorage", () => {
  it("importe seulement le compte actif, ajoute le companyId et supprime les clés globales", async () => {
    const storage = createMemoryStorage({
      stockpilot_offline_sales_v1: [
        { id: "allowed", ownerUserId: 4, kind: "pos_sale", createdAt: 10, status: "pending", draft: { items: [] } },
        { id: "other-user", ownerUserId: 5, kind: "pos_sale", createdAt: 11, status: "pending", draft: { items: [] } },
        { id: "other-company", ownerUserId: 4, companyId: 99, kind: "pos_sale", createdAt: 12, status: "pending", draft: { items: [] } },
      ],
      stockpilot_sync_log_v1: [
        { id: "sync-allowed", ownerUserId: 4, operationId: "allowed", kind: "pos_sale", summary: "Vente", status: "queued", createdAt: 10, updatedAt: 10, attemptCount: 0 },
        { id: "sync-other", ownerUserId: 5, operationId: "other-user", kind: "pos_sale", summary: "Vente", status: "queued", createdAt: 11, updatedAt: 11, attemptCount: 0 },
      ],
    });
    await expect(migrateLegacyOfflineStorage(scope, storage)).resolves.toBe(true);
    const { operations, snapshot } = await readOfflineScope(scope);
    expect(operations).toHaveLength(1);
    expect(operations[0]?.payload).toMatchObject({ id: "allowed", ownerUserId: 4, companyId: 12 });
    expect(snapshot?.payload).toMatchObject({ syncLog: [{ operationId: "allowed", ownerUserId: 4, companyId: 12 }] });
    expect(storage.getItem("stockpilot_offline_sales_v1")).toBeNull();
    expect(storage.getItem("stockpilot_sync_log_v1")).toBeNull();
  });

  it("ne réimporte pas une migration déjà enregistrée et ne recrée aucune file", async () => {
    const storage = createMemoryStorage({ stockpilot_offline_sales_v1: [{ id: "first", ownerUserId: 4, kind: "pos_sale", createdAt: 10, draft: { items: [] } }], stockpilot_sync_log_v1: [] });
    await migrateLegacyOfflineStorage(scope, storage);
    storage.values.set("stockpilot_offline_sales_v1", JSON.stringify([{ id: "second", ownerUserId: 4, kind: "pos_sale", createdAt: 11, draft: { items: [] } }]));
    await expect(migrateLegacyOfflineStorage(scope, storage)).resolves.toBe(false);
    expect((await listOfflineOperations(scope)).map(operation => operation.id)).toEqual(["first"]);
    expect(storage.getItem("stockpilot_offline_sales_v1")).toBeNull();
  });
});

describe("replaceOfflineScope", () => {
  it("remplace file et journal du même périmètre dans une transaction", async () => {
    const operation = { id: "operation-1", type: "pos_sale", payload: { id: "operation-1", ownerUserId: 4, companyId: 12 }, createdAt: 20, attempts: 0 };
    await replaceOfflineScope(scope, [operation], { syncLog: [{ id: "sync-1", ownerUserId: 4, companyId: 12, operationId: "operation-1" }] });
    await replaceOfflineScope(scope, [], { syncLog: [] });
    const { operations, snapshot } = await readOfflineScope(scope);
    expect(operations).toEqual([]);
    expect(snapshot?.payload).toEqual({ syncLog: [] });
  });
});

describe("devis offline avec fiscalité", () => {
  it("conserve le canal quote, le taux TVA et les frais de livraison dans le périmètre actif", async () => {
    const quote = {
      id: "quote-offline-1",
      ownerUserId: scope.userId,
      companyId: scope.companyId,
      kind: "invoice_draft",
      createdAt: 100,
      status: "pending",
      draft: {
        channel: "quote",
        customerId: 77,
        salesAgentId: null,
        cashierId: null,
        salesAgentSelectionMade: true,
        cashierSelectionMade: true,
        note: null,
        deliveryAddress: "12 rue du Marché",
        deliveryFeeCents: 1500,
        vatRateBasisPoints: 1800,
        vatCents: 1800,
        invoiceDiscount: { type: "none", value: 0 },
        items: [{ productId: 9, quantity: 2, manualUnitPriceCents: 5000, discount: { type: "none", value: 0 } }],
      },
    };
    await replaceOfflineScope(scope, [{ id: quote.id, type: quote.kind, payload: quote, createdAt: quote.createdAt, attempts: 0 }], { syncLog: [] });
    const otherScope: OfflineScope = { companyId: 13, userId: scope.userId };
    expect((await readOfflineScope(scope)).operations[0]?.payload).toMatchObject({ draft: { channel: "quote", deliveryFeeCents: 1500, vatRateBasisPoints: 1800, vatCents: 1800 } });
    expect((await readOfflineScope(otherScope)).operations).toHaveLength(0);
  });
});
