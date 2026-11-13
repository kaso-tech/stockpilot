import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), getDb: vi.fn(), read: vi.fn(), sign: vi.fn() }));
vi.mock("./sdk", () => ({ sdk: { authenticateRequest: mocks.auth } }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../storage", () => ({ storageRead: mocks.read, storageGetSignedUrl: mocks.sign, storageDelete: vi.fn() }));
import { registerStorageProxy } from "./storageProxy";
const validKey = "company/41/products/7/thumb_1234abcd.png";
let attached: boolean;
beforeEach(() => {
  vi.clearAllMocks(); attached = true;
  mocks.auth.mockResolvedValue({ companyId: 41, role: "seller", isCron: false });
  mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => attached ? [{ id: 7 }] : [] }) }) }) });
  mocks.read.mockResolvedValue(Buffer.from("synthetic"));
});
async function request(key = validKey) {
  let handler: any;
  registerStorageProxy({ get: (_: string, fn: any) => { handler = fn; } } as any);
  const response: any = { statusCode: 200, headers: {}, body: null };
  response.status = (status: number) => { response.statusCode = status; return response; };
  response.set = (name: unknown, value?: unknown) => { if (typeof name === "string") response.headers[name] = value; else Object.assign(response.headers, name); return response; };
  response.send = (body: unknown) => { response.body = body; return response; };
  response.redirect = vi.fn();
  await handler({ params: { key: key.split("/") } }, response);
  return response;
}
describe("relais privé de photos produit", () => {
  it("sert la photo attachée avec contenu raster et sans URL signée publique", async () => {
    const res = await request(); expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/png");
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(mocks.read).toHaveBeenCalledWith(validKey); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("refuse une requête sans session et une photo d’un autre tenant", async () => {
    mocks.auth.mockRejectedValueOnce(new Error("no session")); expect((await request()).statusCode).toBe(401);
    expect((await request(validKey.replace("company/41/", "company/42/"))).statusCode).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("refuse une ancienne photo détachée même si les octets existent toujours sur Forge", async () => {
    attached = false; expect((await request()).statusCode).toBe(404); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("ne renvoie aucune URL signée pour une clé produit ambiguë ou non conforme", async () => {
    expect((await request("company/41/products/7/thumb.png")).statusCode).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
});
