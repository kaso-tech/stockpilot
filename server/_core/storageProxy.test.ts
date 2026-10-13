import { describe, expect, it } from "vitest";
import { canReadStorageKey } from "./storageProxy";

const as =
  (companyId: number | null, role = "admin") =>
  async () => ({ companyId, role });
const anonymous = async () => {
  throw new Error("no session");
};

describe("accès aux fichiers stockés", () => {
  it("laisse publics les logos et signatures", async () => {
    expect(await canReadStorageKey("company/5/logo_ab12.png", anonymous)).toBe(
      true
    );
  });

  it("réserve les sauvegardes aux administrateurs de l'entreprise", async () => {
    const key = "company/5/backups/stockpilot-backup_ab12.json";
    expect(await canReadStorageKey(key, anonymous)).toBe(false);
    expect(await canReadStorageKey(key, as(6))).toBe(false);
    expect(await canReadStorageKey(key, as(5, "seller"))).toBe(false);
    expect(await canReadStorageKey(key, as(5))).toBe(true);
  });

  it("réserve les justificatifs aux membres de l'entreprise", async () => {
    expect(
      await canReadStorageKey("company/5/expenses/x.pdf", as(5, "seller"))
    ).toBe(true);
    expect(
      await canReadStorageKey("company/5/payroll/x.pdf", as(9, "admin"))
    ).toBe(false);
  });
});
