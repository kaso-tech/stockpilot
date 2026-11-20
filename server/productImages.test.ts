import { beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ storageDelete: vi.fn() }));
vi.mock("./storage", () => ({ storageDelete: storage.storageDelete }));
import { decodeProductImage, detectImageType, deleteProductImageFiles, productImageKey, storageKeyFromUrl } from "./productImages";
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([16, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const dataUrl = (type: string, buffer: Buffer) => `data:${type};base64,${buffer.toString("base64")}`;
beforeEach(() => storage.storageDelete.mockReset().mockResolvedValue(false));
describe("validation serveur des photos produit", () => {
  it("reconnaît le format raster réellement reçu", () => {
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(Buffer.from([255, 216, 255, 224, 0, 16]))).toBe("image/jpeg");
    expect(detectImageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe("image/png");
    expect(detectImageType(Buffer.from('<svg onload="alert(1)">'))).toBeNull();
  });
  it("rejette scripts, SVG et URLs exécutables malgré leur annonce image", () => {
    expect(() => decodeProductImage(dataUrl("image/png", Buffer.from("<script>alert(1)</script>")), 1024, "Photo")).toThrow();
    expect(() => decodeProductImage(dataUrl("image/svg+xml", Buffer.from("<svg/>")), 1024, "Photo")).toThrow();
    expect(() => decodeProductImage("javascript:alert(1)", 1024, "Photo")).toThrow();
  });
  it("respecte le plafond et ne fait pas confiance au type déclaré", () => {
    expect(() => decodeProductImage(dataUrl("image/webp", webp), 4, "Photo")).toThrow();
    expect(decodeProductImage(dataUrl("image/jpeg", webp), 1024, "Photo").mimeType).toBe("image/webp");
  });
  it("limite les pointeurs aux chemins locaux entreprise-produit attendus", () => {
    expect(productImageKey(12, 7, "thumb", "webp")).toBe("company/12/products/7/thumb.webp");
    expect(storageKeyFromUrl("/manus-storage/company/12/products/7/thumb_1234abcd.webp")).toBe("company/12/products/7/thumb_1234abcd.webp");
    expect(storageKeyFromUrl("https://exemple.test/a.webp")).toBeNull();
    expect(storageKeyFromUrl("/manus-storage/company/12/products/../secret")).toBeNull();
    expect(storageKeyFromUrl("/manus-storage/company/12/products/7/thumb.webp")).toBeNull();
  });
  it("signale honnêtement les fichiers retenus par un pilote sans DeleteObject", async () => {
    const url = "/manus-storage/company/12/products/7/thumb_1234abcd.webp";
    expect(await deleteProductImageFiles([url, url, "https://autre.test/secret"])).toEqual({ removed: 0, retained: 1 });
    expect(storage.storageDelete).toHaveBeenCalledTimes(1);
  });
});
