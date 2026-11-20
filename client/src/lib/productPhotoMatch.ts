// Association d'un lot de photos aux produits d'après le nom des fichiers :
// « PRD-101.jpg » → référence PRD-101, ou « Huile 5 L.png » → produit nommé « Huile 5 L ».

type MatchableProduct = {
  id: number;
  reference: string;
  name: string;
  imageUrl?: string | null;
};

/** Forme comparable : sans extension, accents, casse ni ponctuation. */
export function normalizeForMatch(value: string) {
  return value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export type PhotoMatch<P extends MatchableProduct> = {
  file: File;
  product: P | null;
  /** Le produit a déjà une photo : elle sera remplacée. */
  replaces: boolean;
  /** Un autre fichier du lot vise déjà ce produit : celui-ci est ignoré. */
  duplicate: boolean;
  matchedBy: "reference" | "name" | null;
};

export function matchPhotosToProducts<P extends MatchableProduct>(
  files: File[],
  products: P[]
): PhotoMatch<P>[] {
  const byReference = new Map<string, P>();
  const byName = new Map<string, P>();
  // Plusieurs produits au même nom : l'association par nom serait ambiguë.
  const ambiguousNames = new Set<string>();
  for (const product of products) {
    byReference.set(normalizeForMatch(product.reference), product);
    const name = normalizeForMatch(product.name);
    if (ambiguousNames.has(name)) continue;
    if (byName.has(name)) {
      byName.delete(name);
      ambiguousNames.add(name);
    } else byName.set(name, product);
  }
  const taken = new Set<number>();
  return files.map(file => {
    const key = normalizeForMatch(file.name);
    const fromReference = key ? byReference.get(key) : undefined;
    const product =
      fromReference ?? (key ? byName.get(key) : undefined) ?? null;
    const duplicate = product ? taken.has(product.id) : false;
    if (product) taken.add(product.id);
    return {
      file,
      product,
      replaces: Boolean(product?.imageUrl),
      duplicate,
      matchedBy: product ? (fromReference ? "reference" : "name") : null,
    };
  });
}
