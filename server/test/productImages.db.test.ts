import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ctx,
  realDbUrl,
  resetDatabase,
  seedTenant,
  type SeededTenant,
} from "./realDb";
import { appRouter } from "../routers";

/** Photos de produits sur MySQL et stockage S3 réels (TEST_S3_ENDPOINT). */
const s3Endpoint = process.env.TEST_S3_ENDPOINT;

const webp = (size: number) =>
  `data:image/webp;base64,${Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x10, 0, 0, 0]),
    Buffer.from("WEBPVP8 "),
    Buffer.alloc(size),
  ]).toString("base64")}`;

const product = {
  reference: "PHOTO-1",
  name: "Huile 5 L",
  description: null,
  category: "Épicerie",
  unit: "pièce",
  purchasePriceCents: 100,
  retailPriceCents: 200,
  wholesalePriceCents: 150,
  quantity: 10,
  minimumQuantity: 1,
  supplierId: null,
};

describe.skipIf(!realDbUrl || !s3Endpoint)(
  "Photos de produits (MySQL et S3 réels)",
  () => {
    let a: SeededTenant;
    let b: SeededTenant;

    beforeAll(() => {
      process.env.S3_BUCKET = "stockpilot";
      process.env.S3_ENDPOINT = s3Endpoint;
      process.env.AWS_ACCESS_KEY_ID ??= "test";
      process.env.AWS_SECRET_ACCESS_KEY ??= "test";
    });

    beforeEach(async () => {
      await resetDatabase();
      a = await seedTenant("photo-a");
      b = await seedTenant("photo-b");
    });

    it("enregistre, remplace puis retire la photo en supprimant les anciens fichiers", async () => {
      const { storageRead } = await import("../storage");
      const caller = appRouter.createCaller(ctx(a.admin));
      const created = await caller.products.create(product);
      const first = await caller.products.uploadImage({
        productId: created.id,
        image: webp(2000),
        thumbnail: webp(200),
      });
      expect(first.imageUrl).toMatch(
        new RegExp(
          `^/manus-storage/company/${a.companyId}/products/${created.id}/image_[a-f0-9]{8}\\.webp$`
        )
      );
      const listed = (await caller.products.list()).find(
        item => item.id === created.id
      );
      expect(listed?.imageThumbUrl).toBe(first.imageThumbUrl);
      const firstKey = first.imageUrl.replace("/manus-storage/", "");
      expect((await storageRead(firstKey)).byteLength).toBeGreaterThan(2000);

      const second = await caller.products.uploadImage({
        productId: created.id,
        image: webp(1000),
        thumbnail: webp(100),
      });
      expect(second.imageUrl).not.toBe(first.imageUrl);
      await expect(storageRead(firstKey)).rejects.toThrow();

      await caller.products.removeImage({ productId: created.id });
      const after = (await caller.products.list()).find(
        item => item.id === created.id
      );
      expect(after?.imageUrl).toBeNull();
      await expect(
        storageRead(second.imageUrl.replace("/manus-storage/", ""))
      ).rejects.toThrow();
    });

    it("refuse la photo d'un produit d'une autre entreprise et un vendeur sans droit catalogue", async () => {
      const created = await appRouter
        .createCaller(ctx(a.admin))
        .products.create(product);
      await expect(
        appRouter.createCaller(ctx(b.admin)).products.uploadImage({
          productId: created.id,
          image: webp(100),
          thumbnail: webp(50),
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        appRouter.createCaller(ctx(a.seller)).products.uploadImage({
          productId: created.id,
          image: webp(100),
          thumbnail: webp(50),
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("supprime les fichiers de la photo avec le produit", async () => {
      const { storageRead } = await import("../storage");
      const caller = appRouter.createCaller(ctx(a.admin));
      const created = await caller.products.create(product);
      const stored = await caller.products.uploadImage({
        productId: created.id,
        image: webp(500),
        thumbnail: webp(50),
      });
      await caller.products.remove({ id: created.id });
      await expect(
        storageRead(stored.imageThumbUrl.replace("/manus-storage/", ""))
      ).rejects.toThrow();
    });
  }
);
