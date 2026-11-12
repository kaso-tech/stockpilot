import { describe, expect, it, vi } from "vitest";
import {
  resolveCatalogReferences,
  type CatalogKind,
  type CatalogReferenceRepository,
} from "./catalogReferenceRules";

type Entry = { id: number; companyId: number | null; name: string; kind: CatalogKind };
function mockCatalog(seed: Entry[] = []) {
  const entries = [...seed];
  let nextCategoryId = 100;
  let nextUnitId = 200;
  const repository: CatalogReferenceRepository = {
    findById: vi.fn(async (kind, companyId, id) => {
      const entry = entries.find(row => row.id === id && row.companyId === companyId && row.kind === kind);
      return entry ? { id: entry.id, name: entry.name } : undefined;
    }),
    findByName: vi.fn(async (kind, companyId, name) => {
      const entry = entries.find(row => row.companyId === companyId && row.name === name && row.kind === kind);
      return entry?.id;
    }),
    create: vi.fn(async (kind: CatalogKind, companyId, name) => {
      const id = kind === "category" ? nextCategoryId++ : nextUnitId++;
      entries.push({ id, companyId, name, kind });
      return id;
    }),
  };
  return { repository, entries };
}

describe("références de catégories et unités par entreprise", () => {
  it("réutilise les identifiants locaux pour les libellés du formulaire ou du CSV", async () => {
    const { repository } = mockCatalog([
      { id: 10, companyId: 21, name: "Boissons", kind: "category" },
      { id: 60, companyId: 21, name: "Bouteille", kind: "unit" },
    ]);
    const refs = await resolveCatalogReferences(21, { category: "Boissons", unit: "Bouteille" }, repository);
    expect(refs).toEqual({ categoryId: 10, unitId: 60, category: "Boissons", unit: "Bouteille" });
    expect(repository.findByName).toHaveBeenCalledWith("category", 21, "Boissons");
    expect(repository.findByName).toHaveBeenCalledWith("unit", 21, "Bouteille");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("ajoute au catalogue du tenant les libellés libres importés sans réécrire leurs labels", async () => {
    const { repository, entries } = mockCatalog();
    const labels = { category: "Pièces <spéciales>", unit: "carton" };
    const refs = await resolveCatalogReferences(22, labels, repository);
    expect(refs.category).toBe(labels.category);
    expect(refs.unit).toBe(labels.unit);
    expect(entries).toHaveLength(2);
    expect(entries.every(entry => entry.companyId === 22)).toBe(true);
  });

  it("ne réutilise pas un nom identique appartenant à une autre entreprise", async () => {
    const { repository, entries } = mockCatalog([
      { id: 4, companyId: 21, name: "Boissons", kind: "category" },
      { id: 54, companyId: 21, name: "Bouteille", kind: "unit" },
    ]);
    const refs = await resolveCatalogReferences(22, { category: "Boissons", unit: "Bouteille" }, repository);
    expect(refs.categoryId).not.toBe(4);
    expect(refs.unitId).not.toBe(54);
    expect(entries.slice(2).every(entry => entry.companyId === 22)).toBe(true);
    expect(repository.findByName).toHaveBeenCalledWith("category", 22, "Boissons");
    expect(repository.findByName).toHaveBeenCalledWith("unit", 22, "Bouteille");
  });

  it("refuse un identifiant d’un autre tenant ou dont le libellé diffère", async () => {
    const { repository } = mockCatalog([{ id: 10, companyId: 21, name: "Boissons", kind: "category" }]);
    await expect(resolveCatalogReferences(22, { category: "Boissons", unit: "pièce" }, repository, { categoryId: 10 }))
      .rejects.toThrow("catégorie est invalide");
    await expect(resolveCatalogReferences(21, { category: "Autre", unit: "pièce" }, repository, { categoryId: 10 }))
      .rejects.toThrow("catégorie est invalide");
  });
});
