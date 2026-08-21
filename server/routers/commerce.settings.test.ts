import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs, saleSettings } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("../storage", () => ({ storagePut: vi.fn() }));

import { getDb } from "../db";
import { storagePut } from "../storage";
import { commerceRouter } from "./commerce";

const mockedGetDb = vi.mocked(getDb);

function adminContext(): TrpcContext {
  return { user: { id: 1, openId: "settings-admin", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("commerce.settings.save", () => {
  const inserts: Array<{ table: unknown; values: unknown }> = [];
  beforeEach(() => {
    inserts.length = 0;
    const db: any = { select: () => ({ from: () => ({ limit: async () => [] }) }), insert: (table: unknown) => ({ values: async (values: unknown) => { inserts.push({ table, values }); return [{ insertId: 1 }]; } }) };
    mockedGetDb.mockResolvedValue(db);
  });
  it.each(["USD", "EUR", "XOF"] as const)("enregistre %s comme devise de référence", async currency => {
    const caller = commerceRouter.createCaller(adminContext());
    await expect(caller.settings.save({ defaultSalesAgentId: null, defaultCashierId: null, requireSalesAgent: false, requireCashier: false, currency })).resolves.toEqual({ success: true });
    expect(inserts.find(item => item.table === saleSettings)?.values).toMatchObject({ currency, updatedByUserId: 1 });
    expect(inserts.find(item => item.table === auditLogs)?.values).toMatchObject({ action: "Paramètres mis à jour" });
  });
  it("enregistre l’identité de l’entreprise destinée aux factures", async () => {
    const caller = commerceRouter.createCaller(adminContext());
    await caller.settings.save({ defaultSalesAgentId: null, defaultCashierId: null, requireSalesAgent: false, requireCashier: false, currency: "XOF", companyName: "Bati Pro", companyLogoUrl: "/manus-storage/company/logo.png", companyAgreementLabel: "Bon pour accord signé", companySignatureAlignment: "center", companyAddress: "Ouagadougou, Koulouba", companyPhone: "+226 70 00 00 00", companyEmail: "contact@batipro.test", companyFooter: "NIF : BF-TEST" });
    expect(inserts.find(item => item.table === saleSettings)?.values).toMatchObject({ companyName: "Bati Pro", companyLogoUrl: "/manus-storage/company/logo.png", companyAgreementLabel: "Bon pour accord signé", companySignatureAlignment: "center", companyAddress: "Ouagadougou, Koulouba", companyPhone: "+226 70 00 00 00", companyEmail: "contact@batipro.test", companyFooter: "NIF : BF-TEST" });
  });
  it("envoie et persiste un logo d’entreprise valide", async () => {
    vi.mocked(storagePut).mockResolvedValue({ key: "company/logo.png", url: "/manus-storage/company/logo.png" });
    const caller = commerceRouter.createCaller(adminContext());
    await expect(caller.settings.uploadLogo({ dataUrl: "data:image/png;base64,iVBORw0KGgo=", filename: "logo.png" })).resolves.toEqual({ url: "/manus-storage/company/logo.png" });
    expect(storagePut).toHaveBeenCalledWith(expect.stringContaining("company/1/logo.png"), expect.any(Buffer), "image/png");
    expect(inserts.find(item => item.table === saleSettings)?.values).toMatchObject({ companyLogoUrl: "/manus-storage/company/logo.png", updatedByUserId: 1 });
  });
  it("envoie et persiste une signature ou un cachet valide", async () => {
    vi.mocked(storagePut).mockResolvedValue({ key: "company/signature.png", url: "/manus-storage/company/signature.png" });
    const caller = commerceRouter.createCaller(adminContext());
    await expect(caller.settings.uploadSignature({ dataUrl: "data:image/png;base64,iVBORw0KGgo=", filename: "cachet.png" })).resolves.toEqual({ url: "/manus-storage/company/signature.png" });
    expect(storagePut).toHaveBeenCalledWith(expect.stringContaining("company/1/signature.png"), expect.any(Buffer), "image/png");
    expect(inserts.find(item => item.table === saleSettings)?.values).toMatchObject({ companySignatureUrl: "/manus-storage/company/signature.png", updatedByUserId: 1 });
  });
});
