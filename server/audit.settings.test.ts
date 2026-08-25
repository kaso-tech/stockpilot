import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn(), listAuditLogs: vi.fn(), listMovements: vi.fn(), listProducts: vi.fn(), listSuppliers: vi.fn(), listUsers: vi.fn() }));

import { listAuditLogs } from "./db";
import { appRouter } from "./routers";

const mockedListAuditLogs = vi.mocked(listAuditLogs);

function adminContext(companyId: number): TrpcContext {
  return { user: { id: 7, openId: "audit-admin", name: "Admin", email: "admin@example.test", loginMethod: "password", role: "admin", companyId, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("audit.settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("utilise exclusivement le périmètre de l’entreprise active puis ne retourne que les modifications de paramètres", async () => {
    mockedListAuditLogs.mockResolvedValue([
      { id: 1, action: "Paramètres mis à jour", entityType: "Entreprise", entityId: null, detail: "Profil modifié", createdAt: new Date(), actorName: "Admin", actorEmail: "admin@example.test" },
      { id: 2, action: "Création", entityType: "Produit", entityId: "4", detail: "Produit créé", createdAt: new Date(), actorName: "Admin", actorEmail: "admin@example.test" },
      { id: 3, action: "Paramètres d’impression mis à jour", entityType: "Impression", entityId: null, detail: "Imprimante configurée", createdAt: new Date(), actorName: "Admin", actorEmail: "admin@example.test" },
    ]);

    const result = await appRouter.createCaller(adminContext(42)).audit.settings();

    expect(mockedListAuditLogs).toHaveBeenCalledWith(42);
    expect(result.map(entry => entry.id)).toEqual([1, 3]);
  });
});
