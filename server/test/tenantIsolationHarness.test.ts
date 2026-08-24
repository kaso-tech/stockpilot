import { describe, expect, it } from "vitest";
import { adminContext, crossTenantIds, sellerContext, tenantA, tenantB } from "./tenantFixtures";

function expectRowsOwnedBy<T extends { companyId?: number | null }>(rows: T[], companyId: number) {
  expect(rows.every(row => row.companyId === companyId)).toBe(true);
}

describe("tenant isolation test harness", () => {
  it("provides two deterministic tenants with disjoint identities", () => {
    expect(tenantA.companyId).not.toBe(tenantB.companyId);
    expect(tenantA.admin.id).not.toBe(tenantB.admin.id);
    expect(tenantA.seller.id).not.toBe(tenantB.seller.id);
    expect(tenantA.admin.companyId).toBe(tenantA.companyId);
    expect(tenantB.admin.companyId).toBe(tenantB.companyId);
  });

  it("builds contexts whose authenticated scope matches the tenant", () => {
    expect(adminContext(tenantA).user).toMatchObject({ companyId: tenantA.companyId, role: "admin" });
    expect(sellerContext(tenantA).user).toMatchObject({ companyId: tenantA.companyId, role: "seller" });
    expect(adminContext(tenantB).user).toMatchObject({ companyId: tenantB.companyId, role: "admin" });
    expect(sellerContext(tenantB).user).toMatchObject({ companyId: tenantB.companyId, role: "seller" });
  });

  it("exposes stable cross-tenant identifiers for route tests", () => {
    const ids = crossTenantIds();
    expect(ids.tenantAProductId).not.toBe(ids.tenantBProductId);
    expect(ids.tenantAPurchaseOrderId).not.toBe(ids.tenantBPurchaseOrderId);
    expect(ids.tenantAUserId).not.toBe(ids.tenantBUserId);
  });

  it("provides a reusable ownership assertion for future repository tests", () => {
    expectRowsOwnedBy([{ companyId: tenantA.companyId }, { companyId: tenantA.companyId }], tenantA.companyId);
    expectRowsOwnedBy([{ companyId: tenantB.companyId }], tenantB.companyId);
  });
});
