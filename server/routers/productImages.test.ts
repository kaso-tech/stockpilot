import { beforeEach, describe, expect, it, vi } from "vitest";
import { companies, products } from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), storagePut: vi.fn(), storageDelete: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../storage", () => ({ storagePut: mocks.storagePut, storageDelete: mocks.storageDelete }));

import { productImagesRouter } from "./productImages";

function paramsOf(condition: any): Record<string, unknown[]> {
  const found: Record<string, unknown[]> = {};
  const visit = (chunk: any): void => {
    if (!chunk || typeof chunk !== "object") return;
    if (Array.isArray(chunk)) { chunk.forEach(visit); return; }
    if ("value" in chunk && "encoder" in chunk && typeof chunk.encoder?.name === "string") {
      (found[chunk.encoder.name] ??= []).push(chunk.value);
      return;
    }
    if (Array.isArray(chunk.queryChunks)) chunk.queryChunks.forEach(visit);
  };
  visit(condition);
  return found;
}
function dataUrl(buffer: Buffer, advertised = "webp") { return `data:image/${advertised};base64,${buffer.toString("base64")}`; }
function validWebp(size = 64) { return Buffer.concat([Buffer.from("RIFF"), Buffer.from([size & 255, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(size)]); }
function user(id: number, companyId: number, role: "admin" | "manager" | "seller" = "admin") { const now = new Date(); return { id, companyId, role, openId: `test-${id}`, name: "Test", email: null, loginMethod: "test", active: true, createdAt: now, updatedAt: now, lastSignedIn: now }; }

type Product = { id: number; companyId: number; name: string; imageUrl: string | null; imageThumbUrl: string | null };
let product: Product | null;
let insertedAudit: any[];
function mockDb() {
  const db: any = {};
  db.select = () => ({ from: (table: any) => {
    let condition: any;
    const query: any = { where(value: any) { condition = value; return query; }, limit: async () => {
      if (table === companies) {
        const companyId = paramsOf(condition).id?.[0];
        return [{ status: companyId === 41 || companyId === 42 ? "active" : "active" }];
      }
      if (table === products) {
        const p = paramsOf(condition);
        const requestedId = p.id?.[0];
        const companyId = p.companyId?.[0];
        return product && product.id === requestedId && product.companyId === companyId ? [{ ...product }] : [];
      }
      return [];
    }, for() { return query; } };
    return query;
  } });
  db.transaction = async (callback: (tx: any) => Promise<unknown>) => callback(db);
  db.update = (table: any) => ({ set: (changes: Partial<Product>) => ({ where: async (condition: any) => {
    if (table === products && product) {
      const p = paramsOf(condition);
      if (p.id?.[0] === product.id && p.companyId?.[0] === product.companyId) product = { ...product, ...changes };
    }
  } }) });
  db.insert = (table: any) => ({ values: async (value: any) => { insertedAudit.push(value); return [{ insertId: insertedAudit.length }]; } });
  return db;
}
const imageInput = { productId: 7, image: dataUrl(validWebp(200)), thumbnail: dataUrl(validWebp(100)) };

beforeEach(() => {
  product = { id: 7, companyId: 41, name: "Huile", imageUrl: null, imageThumbUrl: null };
  insertedAudit = [];
  mocks.getDb.mockReset().mockResolvedValue(mockDb());
  mocks.storagePut.mockReset().mockImplementation(async (key: string) => ({ key: `${key.replace(/\.(webp|png|jpg)$/, "")}_a1b2c3d4.webp`, url: `/manus-storage/${key.replace(/\.(webp|png|jpg)$/, "")}_a1b2c3d4.webp` }));
  mocks.storageDelete.mockReset().mockResolvedValue(false);
});

describe("routes photo produit tenant-scopées", () => {
  it("autorise un gestionnaire du tenant propriétaire à charger une photo", async () => {
    const result = await productImagesRouter.createCaller({ user: user(1, 41, "manager"), req: {} as any, res: {} as any }).uploadImage(imageInput);
    expect(result.imageUrl).toMatch(/^\/manus-storage\/company\/41\/products\/7\/image_[a-f0-9]{8}\.webp$/);
    expect(product?.imageUrl).toBe(result.imageUrl);
    expect(product?.imageThumbUrl).toBe(result.imageThumbUrl);
    expect(mocks.storagePut).toHaveBeenCalledTimes(2);
    expect(insertedAudit).toHaveLength(1);
  });

  it("refuse un produit d’une autre entreprise sans écriture stockage", async () => {
    const result = productImagesRouter.createCaller({ user: user(2, 42, "admin"), req: {} as any, res: {} as any }).uploadImage(imageInput);
    await expect(result).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("refuse le vendeur même s’il appartient au tenant du produit", async () => {
    const result = productImagesRouter.createCaller({ user: user(3, 41, "seller"), req: {} as any, res: {} as any }).uploadImage(imageInput);
    await expect(result).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("détache les deux URL lors du retrait et tente uniquement leur suppression", async () => {
    product = { ...product!, imageUrl: "/manus-storage/company/41/products/7/image_a1b2c3d4.webp", imageThumbUrl: "/manus-storage/company/41/products/7/thumb_b2c3d4e5.webp" };
    const result = await productImagesRouter.createCaller({ user: user(1, 41, "admin"), req: {} as any, res: {} as any }).removeImage({ productId: 7 });
    expect(result).toEqual({ success: true });
    expect(product?.imageUrl).toBeNull();
    expect(product?.imageThumbUrl).toBeNull();
    expect(mocks.storageDelete).toHaveBeenCalledTimes(2);
    expect(mocks.storageDelete).toHaveBeenCalledWith("company/41/products/7/image_a1b2c3d4.webp");
  });

  it("détecte un remplacement concurrent avant de toucher les pointeurs précédents", async () => {
    const original = "/manus-storage/company/41/products/7/image_11111111.webp";
    product = { ...product!, imageUrl: original, imageThumbUrl: "/manus-storage/company/41/products/7/thumb_22222222.webp" };
    const db = mockDb();
    const realTransaction = db.transaction;
    db.transaction = async (callback: any) => { product = { ...product!, imageUrl: "/manus-storage/company/41/products/7/image_33333333.webp" }; return realTransaction(callback); };
    mocks.getDb.mockResolvedValue(db);
    await expect(productImagesRouter.createCaller({ user: user(1, 41, "admin"), req: {} as any, res: {} as any }).uploadImage(imageInput)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(product?.imageUrl).toBe("/manus-storage/company/41/products/7/image_33333333.webp");
    expect(mocks.storageDelete).toHaveBeenCalledTimes(2);
  });
});
