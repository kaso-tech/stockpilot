import { beforeAll, describe, expect, it } from "vitest";
import { realDbUrl, resetDatabase, seedTenant } from "./realDb";

/**
 * Stockage S3 réel (S3Mock ou MinIO) : activé si TEST_S3_ENDPOINT est défini,
 * par exemple TEST_S3_ENDPOINT=http://127.0.0.1:9090 avec le compartiment « stockpilot ».
 */
const s3Endpoint = process.env.TEST_S3_ENDPOINT;

describe.skipIf(!realDbUrl || !s3Endpoint)(
  "Lot 9.10 — stockage S3 (réel)",
  () => {
    beforeAll(() => {
      process.env.S3_BUCKET = "stockpilot";
      process.env.S3_ENDPOINT = s3Endpoint;
      process.env.AWS_ACCESS_KEY_ID ??= "test";
      process.env.AWS_SECRET_ACCESS_KEY ??= "test";
    });

    it("écrit, relit puis supprime définitivement un fichier", async () => {
      const { storageDelete, storagePut, storageRead } = await import(
        "../storage"
      );
      const stored = await storagePut(
        "company/1/expenses/recu.pdf",
        Buffer.from("contenu"),
        "application/pdf"
      );
      expect(stored.url).toBe(`/manus-storage/${stored.key}`);
      expect((await storageRead(stored.key)).toString()).toBe("contenu");
      expect(await storageDelete(stored.key)).toBe(true);
      await expect(storageRead(stored.key)).rejects.toThrow();
    });

    it("B2 — la rétention supprime réellement les fichiers d'archives périmés", async () => {
      const { runBackupWithStatus, listBackups } = await import("../backups");
      const { storageRead } = await import("../storage");
      await resetDatabase();
      const tenant = await seedTenant("s3");
      const first = await runBackupWithStatus(
        tenant.admin.id,
        "manual",
        1,
        tenant.companyId
      );
      const firstKey = (await listBackups(10, tenant.companyId)).find(
        item => item.id === first.id
      )!.storageKey!;
      expect((await storageRead(firstKey)).length).toBeGreaterThan(0);
      await new Promise(resolve => setTimeout(resolve, 1100));
      await runBackupWithStatus(tenant.admin.id, "manual", 1, tenant.companyId);
      expect(await listBackups(10, tenant.companyId)).toHaveLength(1);
      await expect(storageRead(firstKey)).rejects.toThrow();
    });
  }
);
