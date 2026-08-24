import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb: getDbMock }));

import { getBackupDownloadUrl } from "./backups";

const suite = process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY ? describe : describe.skip;

suite("lien signé réel de sauvegarde (requires Forge storage)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("demande au stockage un lien signé pour une archive persistée", async () => {
    const archive = { id: 41, storageKey: "backups/stockpilot-integration-download.json" };
    const db = { select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([archive]) })) })) })) };
    getDbMock.mockResolvedValue(db);
    const url = await getBackupDownloadUrl(41);
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain("stockpilot-integration-download");
  });
});
