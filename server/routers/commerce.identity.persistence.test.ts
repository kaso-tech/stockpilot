import { beforeEach, describe, expect, it, vi } from "vitest";
import { saleSettings } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("../storage", () => ({ storagePut: vi.fn() }));
import { getDb } from "../db";
import { storagePut } from "../storage";
import { commerceRouter } from "./commerce";

const mockedGetDb = vi.mocked(getDb);
function adminContext(): TrpcContext { return { user: { id: 1, openId: "identity-admin", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }

describe("persistance de l’identité entreprise", () => {
  let stored: Record<string, unknown> | null;
  beforeEach(() => {
    stored = null;
    vi.mocked(storagePut).mockImplementation(async key => key.includes("signature") ? { key: "company/1/signature.png", url: "/manus-storage/company/1/signature.png" } : { key: "company/1/logo.png", url: "/manus-storage/company/1/logo.png" });
    const db: any = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => stored ? [stored] : [] }), limit: async () => stored ? [stored] : [] }) }),
      insert: (table: unknown) => ({ values: async (values: Record<string, unknown>) => { if (table === saleSettings) stored = { id: 1, ...values }; return [{ insertId: 1 }]; } }),
      update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async () => { if (table === saleSettings) stored = { ...(stored ?? {}), ...values }; } }) }),
    };
    mockedGetDb.mockResolvedValue(db);
  });
  it("relit les coordonnées et le logo après leurs enregistrements successifs", async () => {
    const caller = commerceRouter.createCaller(adminContext());
    await caller.settings.save({ defaultSalesAgentId: null, defaultCashierId: null, requireSalesAgent: false, requireCashier: false, currency: "XOF", companyName: "Bati Pro", companyAddress: "Ouagadougou, Koulouba", companyPhone: "+226 70 00 00 00", companyEmail: "contact@batipro.test", companyFooter: "NIF : BF-TEST" });
    await caller.settings.uploadLogo({ dataUrl: "data:image/png;base64,iVBORw0KGgo=", filename: "logo.png" });
    await caller.settings.uploadSignature({ dataUrl: "data:image/png;base64,iVBORw0KGgo=", filename: "signature.png" });
    const reloaded = await caller.settings.get();
    expect(reloaded).toMatchObject({ companyName: "Bati Pro", companyAddress: "Ouagadougou, Koulouba", companyPhone: "+226 70 00 00 00", companyEmail: "contact@batipro.test", companyFooter: "NIF : BF-TEST", companyLogoUrl: "/manus-storage/company/1/logo.png", companySignatureUrl: "/manus-storage/company/1/signature.png" });
  });
});
