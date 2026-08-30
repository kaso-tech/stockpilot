import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, select, update, transaction, getDb } = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({ getDb }));

import { parseVerifiedYengaPayWebhook, receiveYengaPayWebhook } from "./yengaPayWebhookReceiver";

function signedRequest(payload: Record<string, unknown>, eventType = "payment.success") {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = createHmac("sha256", process.env.YENGAPAY_WEBHOOK_SECRET!).update(body).digest("hex");
  return {
    body,
    header: vi.fn((name: string) => name === "x-webhook-hash" ? signature : name === "x-yengapay-event" ? eventType : undefined),
  };
}

function response() {
  const result = {
    status: vi.fn(),
    json: vi.fn(),
  };
  result.status.mockReturnValue(result);
  return result;
}

describe("réception webhook YengaPay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const values = vi.fn().mockResolvedValue([{ insertId: 41 }]);
    insert.mockReturnValue({ values });
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    select.mockReturnValue({ from });
    const updateWhere = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    update.mockReturnValue({ set });
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({ select, update }));
    getDb.mockResolvedValue({ insert, select, update, transaction });
  });

  it("conserve seulement les métadonnées minimales d’un événement PayIn signé", async () => {
    const req = signedRequest({ reference: "SUB-42", customerNumber: "ne-pas-conserver" });
    const res = response();

    await receiveYengaPayWebhook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(insert).toHaveBeenCalledOnce();
    expect(insert.mock.results[0].value.values).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "payment.success",
      providerReference: "SUB-42",
      signatureVerified: true,
      status: "received",
    }));
    expect(JSON.stringify(insert.mock.results[0].value.values.mock.calls)).not.toContain("ne-pas-conserver");
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("refuse les signatures invalides avant toute écriture", async () => {
    const req = signedRequest({ reference: "SUB-42" });
    req.header.mockImplementation((name: string) => name === "x-webhook-hash" ? "f".repeat(64) : name === "x-yengapay-event" ? "payment.success" : undefined);
    const res = response();

    await receiveYengaPayWebhook(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejette un corps non JSON ou un événement sans discriminant", () => {
    expect(parseVerifiedYengaPayWebhook(Buffer.from("not-json"), "payment.success")).toBeNull();
    expect(parseVerifiedYengaPayWebhook(Buffer.from('{"id":"42"}'), undefined)).toBeNull();
  });
});
