import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = mocks.send;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

const originalEnv = {
  bucket: process.env.S3_BUCKET,
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forgeUrl: process.env.BUILT_IN_FORGE_API_URL,
  forgeKey: process.env.BUILT_IN_FORGE_API_KEY,
};

async function loadStorage() {
  vi.resetModules();
  return import("./storage");
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.S3_BUCKET;
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_REGION;
  delete process.env.BUILT_IN_FORGE_API_URL;
  delete process.env.BUILT_IN_FORGE_API_KEY;
});

afterEach(() => {
  if (originalEnv.bucket === undefined) delete process.env.S3_BUCKET;
  else process.env.S3_BUCKET = originalEnv.bucket;
  if (originalEnv.endpoint === undefined) delete process.env.S3_ENDPOINT;
  else process.env.S3_ENDPOINT = originalEnv.endpoint;
  if (originalEnv.region === undefined) delete process.env.S3_REGION;
  else process.env.S3_REGION = originalEnv.region;
  if (originalEnv.forgeUrl === undefined) delete process.env.BUILT_IN_FORGE_API_URL;
  else process.env.BUILT_IN_FORGE_API_URL = originalEnv.forgeUrl;
  if (originalEnv.forgeKey === undefined) delete process.env.BUILT_IN_FORGE_API_KEY;
  else process.env.BUILT_IN_FORGE_API_KEY = originalEnv.forgeKey;
  vi.unstubAllGlobals();
});

describe("stockage multi-pilote", () => {
  it("utilise S3 pour écrire, signer, lire et supprimer un objet", async () => {
    process.env.S3_BUCKET = "test-bucket";
    process.env.S3_ENDPOINT = "https://s3.mock.invalid";
    process.env.S3_REGION = "test-region";
    mocks.getSignedUrl.mockResolvedValue("https://signed.mock.invalid/object");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("mock bytes")));
    const storage = await loadStorage();

    const stored = await storage.storagePut(
      "company/7/backups/archive.json",
      Buffer.from("archive"),
      "application/json",
    );
    expect(stored.url).toBe(`/manus-storage/${stored.key}`);
    expect(stored.key).toMatch(/^company\/7\/backups\/archive_[a-f0-9]{8}\.json$/);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0]?.[0].input).toMatchObject({
      Bucket: "test-bucket",
      Key: stored.key,
      ContentType: "application/json",
    });

    await storage.storageGetSignedUrl(stored.key);
    expect(mocks.getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ input: { Bucket: "test-bucket", Key: stored.key } }),
      { expiresIn: 300 },
    );
    await expect(storage.storageRead(stored.key)).resolves.toEqual(Buffer.from("mock bytes"));
    await expect(storage.storageDelete(stored.key)).resolves.toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[1]?.[0].input).toEqual({ Bucket: "test-bucket", Key: stored.key });
  });

  it("reste sur Forge par défaut et ne prétend pas pouvoir effacer un objet", async () => {
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.mock.invalid";
    process.env.BUILT_IN_FORGE_API_KEY = "test-only-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ url: "https://upload.mock.invalid" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ url: "https://read.mock.invalid" }))
      .mockResolvedValueOnce(new Response("forge bytes"));
    vi.stubGlobal("fetch", fetchMock);
    const storage = await loadStorage();

    expect(storage.storageDriver()).toBe("forge");
    expect(storage.storageSupportsDelete()).toBe(false);
    const stored = await storage.storagePut("company/9/expenses/receipt.pdf", "content", "application/pdf");
    expect(stored.url).toBe(`/manus-storage/${stored.key}`);
    await expect(storage.storageRead(stored.key)).resolves.toEqual(Buffer.from("forge bytes"));
    await expect(storage.storageDelete(stored.key)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuse les chemins de clé ambigus avant tout accès au pilote", async () => {
    process.env.S3_BUCKET = "test-bucket";
    const storage = await loadStorage();
    await expect(storage.storageGetSignedUrl("company/1/../2/private"))
      .rejects.toThrow("Clé de stockage invalide");
    await expect(storage.storageDelete("/"))
      .rejects.toThrow("Clé de stockage invalide");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
