import { describe, expect, it } from "vitest";
import {
  decodeProductImage,
  detectImageType,
  productImageKey,
  storageKeyFromUrl,
} from "./productImages";

const webp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x10, 0, 0, 0]),
  Buffer.from("WEBPVP8 "),
]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const dataUrl = (type: string, buffer: Buffer) =>
  `data:${type};base64,${buffer.toString("base64")}`;

describe("images de produits", () => {
  it("reconnaît le format à partir du contenu", () => {
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(jpeg)).toBe("image/jpeg");
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });

  it("refuse un fichier déguisé en image", () => {
    expect(() =>
      decodeProductImage(
        dataUrl("image/png", Buffer.from("<script>alert(1)</script>")),
        1024,
        "Photo"
      )
    ).toThrow(/WEBP, JPEG ou PNG/);
    expect(() =>
      decodeProductImage("javascript:alert(1)", 1024, "Photo")
    ).toThrow(/format/);
  });

  it("applique la taille maximale et retient le type réel", () => {
    expect(() =>
      decodeProductImage(dataUrl("image/webp", webp), 4, "Photo")
    ).toThrow(/trop lourde/);
    const decoded = decodeProductImage(
      dataUrl("image/jpeg", webp),
      1024,
      "Photo"
    );
    expect(decoded.mimeType).toBe("image/webp");
    expect(decoded.extension).toBe("webp");
  });

  it("range les fichiers dans le dossier de l'entreprise", () => {
    expect(productImageKey(12, 7, "thumb", "webp")).toBe(
      "company/12/products/7/thumb.webp"
    );
    expect(
      storageKeyFromUrl("/manus-storage/company/12/products/7/a.webp")
    ).toBe("company/12/products/7/a.webp");
    expect(storageKeyFromUrl("https://exemple.test/a.webp")).toBeNull();
    expect(storageKeyFromUrl("/manus-storage/../secret")).toBeNull();
  });
});
