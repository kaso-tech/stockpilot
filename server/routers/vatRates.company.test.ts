import { describe, expect, it, vi } from "vitest";
import { createdVatRateId, isActiveVatDuplicate, resolveVatCompanyId } from "./vatRates";

describe("résolution d'entreprise des taux TVA", () => {
  it("réassocie strictement un administrateur hérité à l'entreprise dont il est propriétaire", async () => {
    const bind = vi.fn().mockResolvedValue(undefined);
    await expect(resolveVatCompanyId({ id: 42, companyId: null }, async ownerId => ownerId === 42 ? 7 : null, bind)).resolves.toBe(7);
    expect(bind).toHaveBeenCalledWith(42, 7);
  });

  it("refuse un compte sans entreprise propriétaire au lieu de choisir une entreprise arbitraire", async () => {
    await expect(resolveVatCompanyId({ id: 42, companyId: null }, async () => null, async () => undefined)).rejects.toThrow("Aucune entreprise active");
  });

  it("retourne l’identifiant relu plutôt que de dépendre du format du résultat d’insertion", () => {
    expect(createdVatRateId({ id: 15 })).toBe(15);
    expect(() => createdVatRateId(undefined)).toThrow("n’a pas pu être relu");
  });

  it("ne traite pas un taux archivé comme un doublon actif", () => {
    expect(isActiveVatDuplicate({ active: false })).toBe(false);
    expect(isActiveVatDuplicate({ active: true })).toBe(true);
    expect(isActiveVatDuplicate(undefined)).toBe(false);
  });
});
