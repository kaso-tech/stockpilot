import { describe, expect, it } from "vitest";
import { dataUrlBytes, fitWithin } from "./productImage";

describe("compression des photos de produits", () => {
  it("ramène le plus grand côté à la taille cible sans agrandir", () => {
    expect(fitWithin(4000, 3000, 600)).toEqual({ width: 600, height: 450 });
    expect(fitWithin(1080, 1920, 160)).toEqual({ width: 90, height: 160 });
    expect(fitWithin(120, 80, 600)).toEqual({ width: 120, height: 80 });
  });

  it("mesure la taille réelle d'une data URL", () => {
    const bytes = Buffer.alloc(1000, 7);
    expect(
      dataUrlBytes(`data:image/webp;base64,${bytes.toString("base64")}`)
    ).toBe(1000);
  });
});
