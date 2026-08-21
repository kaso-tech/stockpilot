import { beforeEach, describe, expect, it, vi } from "vitest";

const downloadUrlMock = vi.hoisted(() => vi.fn());
vi.mock("../backups", async () => {
  const actual = await vi.importActual<typeof import("../backups")>("../backups");
  return { ...actual, getBackupDownloadUrl: downloadUrlMock };
});

import { backupRouter } from "./backups";

const ctx = { user: { id: 1, role: "admin" }, req: { headers: {} }, res: {} } as any;

describe("routes de sauvegarde protégées", () => {
  beforeEach(() => vi.clearAllMocks());

  it("génère un lien de téléchargement signé pour une archive", async () => {
    downloadUrlMock.mockResolvedValue("https://download.example.test/backup.json");
    await expect(backupRouter.createCaller(ctx).download({ id: 12 })).resolves.toEqual({ url: "https://download.example.test/backup.json" });
    expect(downloadUrlMock).toHaveBeenCalledWith(12);
  });

  it("rejette une restauration sans la confirmation RESTAURER", async () => {
    await expect(backupRouter.createCaller(ctx).restore({ dataUrl: "data:application/json;base64,eyJzb3VyY2UiOiJTdG9ja1BpbG90In0=", confirmation: "ANNULER" })).rejects.toThrow("RESTAURER");
  });
});
