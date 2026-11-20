import { describe, expect, it } from "vitest";
import { findConfiguredAdmin } from "./adminFallbackSeed";

describe("findConfiguredAdmin", () => {
  it("trouve l’administrateur malgré la casse ou les espaces de l’e-mail configuré", () => {
    const admin = findConfiguredAdmin([{ id: 1, openId: "admin_1", email: "  admin@example.com ", name: "Admin" }], "ADMIN@example.com");
    expect(admin?.openId).toBe("admin_1");
  });

  it("ignore les comptes dont l’e-mail ne correspond pas", () => {
    expect(findConfiguredAdmin([{ id: 1, openId: "admin_1", email: "admin@example.com", name: "Admin" }], "other@example.com")).toBeUndefined();
  });
});
