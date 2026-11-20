export type CatalogKind = "category" | "unit";

export type CatalogReferenceRepository = {
  findById: (
    kind: CatalogKind,
    companyId: number | null,
    id: number,
  ) => Promise<{ id: number; name: string } | undefined>;
  findByName: (
    kind: CatalogKind,
    companyId: number | null,
    name: string,
  ) => Promise<number | undefined>;
  create: (
    kind: CatalogKind,
    companyId: number | null,
    name: string,
  ) => Promise<number>;
};

/**
 * Resolve historical/imported free-text labels to catalog IDs without ever
 * looking outside the authenticated company's scope. The original label stays
 * on the product for display and backward compatibility.
 */
export async function resolveCatalogReferences(
  companyId: number | null,
  labels: { category: string; unit: string },
  repository: CatalogReferenceRepository,
  selectedIds?: { categoryId?: number; unitId?: number },
) {
  const [category, unit] = await Promise.all([
    resolveOne("category", companyId, labels.category, repository, selectedIds?.categoryId),
    resolveOne("unit", companyId, labels.unit, repository, selectedIds?.unitId),
  ]);
  return { categoryId: category.id, unitId: unit.id, category: category.name, unit: unit.name };
}

async function resolveOne(
  kind: CatalogKind,
  companyId: number | null,
  name: string,
  repository: CatalogReferenceRepository,
  selectedId?: number,
) {
  if (selectedId !== undefined) {
    const tenantScopedRecord = await repository.findById(kind, companyId, selectedId);
    if (tenantScopedRecord === undefined || tenantScopedRecord.name !== name) {
      throw new Error(`La référence de ${kind === "category" ? "catégorie" : "unité"} est invalide.`);
    }
    return tenantScopedRecord;
  }
  const existing = await repository.findByName(kind, companyId, name);
  if (existing !== undefined) return { id: existing, name };
  try {
    return { id: await repository.create(kind, companyId, name), name };
  } catch (error) {
    // Concurrent imports may create the same tenant-local label. Re-read only
    // inside the same tenant instead of making a duplicate or changing labels.
    const createdByConcurrentRequest = await repository.findByName(
      kind,
      companyId,
      name,
    );
    if (createdByConcurrentRequest !== undefined) return { id: createdByConcurrentRequest, name };
    throw error;
  }
}
