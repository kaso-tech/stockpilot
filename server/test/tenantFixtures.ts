import type { TrpcContext } from "../_core/context";
import type { AuthenticatedUser } from "../_core/sdk";

export type TestTenant = {
  companyId: number;
  slug: string;
  admin: AuthenticatedUser;
  seller: AuthenticatedUser;
};

function userFor(companyId: number, id: number, role: "admin" | "seller", slug: string): AuthenticatedUser {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    openId: `test-${slug}-${role}`,
    name: `${role === "admin" ? "Administrateur" : "Vendeur"} ${slug}`,
    email: `${role}@${slug}.example.test`,
    phone: null,
    loginMethod: "password",
    role,
    active: true,
    companyId,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export const tenantA: TestTenant = {
  companyId: 101,
  slug: "tenant-a",
  admin: userFor(101, 1001, "admin", "tenant-a"),
  seller: userFor(101, 1002, "seller", "tenant-a"),
};

export const tenantB: TestTenant = {
  companyId: 202,
  slug: "tenant-b",
  admin: userFor(202, 2001, "admin", "tenant-b"),
  seller: userFor(202, 2002, "seller", "tenant-b"),
};

export function contextFor(user: AuthenticatedUser): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

export function adminContext(tenant: TestTenant) {
  return contextFor(tenant.admin);
}

export function sellerContext(tenant: TestTenant) {
  return contextFor(tenant.seller);
}

export function crossTenantIds() {
  return {
    tenantAProductId: 11001,
    tenantBProductId: 22001,
    tenantAPurchaseOrderId: 11002,
    tenantBPurchaseOrderId: 22002,
    tenantAUserId: tenantA.seller.id,
    tenantBUserId: tenantB.seller.id,
  } as const;
}
