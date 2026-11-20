import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, products } from "../../drizzle/schema";
import { companyScope } from "../companyScope";
import { getDb } from "../db";
import { permissionProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { RemoteImageError, fetchRemoteImage } from "../remoteImage";
import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_THUMB_MAX_BYTES, decodeProductImage, deleteProductImageFiles, productImageKey } from "../productImages";

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  return db;
}
function notFound() { return new TRPCError({ code: "NOT_FOUND", message: "Produit introuvable." }); }


export const productImagesRouter = router({
  /** Import CSV (colonne photo_url) : le serveur télécharge la photo (adresses publiques https uniquement), le navigateur la compresse ensuite. */
  fetchRemoteImage: permissionProcedure("catalog.manage")
    .input(z.object({ url: z.string().trim().min(8).max(2000) }))
    .mutation(async ({ input }) => {
      try { return await fetchRemoteImage(input.url); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof RemoteImageError ? error.message : "photo inaccessible" }); }
    }),
  uploadImage: permissionProcedure("catalog.manage")
    .input(z.object({ productId: z.number().int().positive(), image: z.string().min(32).max(850_000), thumbnail: z.string().min(32).max(180_000) }))
    .mutation(async ({ ctx, input }) => {
      const image = decodeProductImage(input.image, PRODUCT_IMAGE_MAX_BYTES, "Photo");
      const thumbnail = decodeProductImage(input.thumbnail, PRODUCT_THUMB_MAX_BYTES, "Miniature");
      const db = await dbOrThrow();
      const scope = and(eq(products.id, input.productId), companyScope(products.companyId, ctx.user.companyId));
      const initial = (await db.select({ id: products.id, name: products.name, imageUrl: products.imageUrl, imageThumbUrl: products.imageThumbUrl }).from(products).where(scope).limit(1))[0];
      if (!initial) throw notFound();
      const stored: string[] = [];
      try {
        const full = await storagePut(productImageKey(ctx.user.companyId, input.productId, "image", image.extension), image.buffer, image.mimeType);
        stored.push(full.url);
        const thumb = await storagePut(productImageKey(ctx.user.companyId, input.productId, "thumb", thumbnail.extension), thumbnail.buffer, thumbnail.mimeType);
        stored.push(thumb.url);
        await db.transaction(async (tx: any) => {
          const current = (await tx.select({ id: products.id, imageUrl: products.imageUrl, imageThumbUrl: products.imageThumbUrl }).from(products).where(scope).for("update").limit(1))[0];
          if (!current) throw notFound();
          if (current.imageUrl !== initial.imageUrl || current.imageThumbUrl !== initial.imageThumbUrl) throw new TRPCError({ code: "CONFLICT", message: "La photo du produit a été modifiée simultanément. Rechargez la fiche avant de réessayer." });
          await tx.update(products).set({ imageUrl: full.url, imageThumbUrl: thumb.url }).where(scope);
          await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Modification", entityType: "Produit", entityId: String(input.productId), detail: `Photo de ${initial.name} mise à jour` });
        });
        await deleteProductImageFiles([initial.imageUrl, initial.imageThumbUrl]);
        return { imageUrl: full.url, imageThumbUrl: thumb.url };
      } catch (error) {
        await deleteProductImageFiles(stored);
        throw error;
      }
    }),
  removeImage: permissionProcedure("catalog.manage")
    .input(z.object({ productId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const scope = and(eq(products.id, input.productId), companyScope(products.companyId, ctx.user.companyId));
      let previous: { name: string; imageUrl: string | null; imageThumbUrl: string | null } | undefined;
      await db.transaction(async (tx: any) => {
        previous = (await tx.select({ name: products.name, imageUrl: products.imageUrl, imageThumbUrl: products.imageThumbUrl }).from(products).where(scope).for("update").limit(1))[0];
        if (!previous) throw notFound();
        await tx.update(products).set({ imageUrl: null, imageThumbUrl: null }).where(scope);
        await tx.insert(auditLogs).values({ companyId: ctx.user.companyId, actorUserId: ctx.user.id, action: "Modification", entityType: "Produit", entityId: String(input.productId), detail: `Photo de ${previous.name} retirée` });
      });
      await deleteProductImageFiles([previous!.imageUrl, previous!.imageThumbUrl]);
      return { success: true };
    }),
});
