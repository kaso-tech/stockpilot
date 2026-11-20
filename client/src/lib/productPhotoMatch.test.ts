import { describe, expect, it } from "vitest";
import { matchPhotosToProducts, normalizeForMatch } from "./productPhotoMatch";

const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });
const products = [
  { id: 1, reference: "PRD-101", name: "Huile 5 L", imageUrl: null },
  {
    id: 2,
    reference: "PRD-102",
    name: "Sucre 1 kg",
    imageUrl: "/manus-storage/x.webp",
  },
  { id: 3, reference: "PRD-103", name: "Lait concentré", imageUrl: null },
  { id: 4, reference: "PRD-104", name: "Lait concentré", imageUrl: null },
  { id: 5, reference: "PRD-105", name: "Lait concentré", imageUrl: null },
];

describe("association des photos aux produits", () => {
  it("compare sans extension, casse, accents ni ponctuation", () => {
    expect(normalizeForMatch("PRD-101.JPG")).toBe("prd101");
    expect(normalizeForMatch("Café moulu 250 g.webp")).toBe("cafemoulu250g");
  });

  it("associe par référence puis par nom", () => {
    const [byRef, byName, none] = matchPhotosToProducts(
      [file("prd_101.jpg"), file("sucre 1kg.png"), file("inconnu.jpg")],
      products
    );
    expect(byRef.product?.id).toBe(1);
    expect(byRef.matchedBy).toBe("reference");
    expect(byName.product?.id).toBe(2);
    expect(byName.matchedBy).toBe("name");
    expect(byName.replaces).toBe(true);
    expect(none.product).toBeNull();
  });

  it("refuse un nom ambigu et signale les doublons", () => {
    const [ambiguous, first, second] = matchPhotosToProducts(
      [file("Lait concentré.jpg"), file("PRD-103.jpg"), file("prd103.png")],
      products
    );
    expect(ambiguous.product).toBeNull();
    expect(first.duplicate).toBe(false);
    expect(second.product?.id).toBe(3);
    expect(second.duplicate).toBe(true);
  });
});
