import { describe, expect, it } from "vitest";
import { paymentDueSettlementInput } from "./routers/paymentDues";

describe("payment due settlement input", () => {
  const valid = {
    occurrenceId: 17,
    operationId: "due-9b4baef9-ec0d-4597-83d2-5f0469d5d5e2",
    amountCents: 25_000,
    settledAt: new Date("2026-08-29T12:00:00.000Z"),
    note: null,
  };

  it("accepts a settlement request with a durable operation key", () => {
    expect(paymentDueSettlementInput.parse(valid)).toMatchObject({ occurrenceId: 17, amountCents: 25_000, operationId: valid.operationId });
  });

  it("rejects a settlement without an idempotency key", () => {
    const { operationId: _operationId, ...withoutOperationId } = valid;
    expect(() => paymentDueSettlementInput.parse(withoutOperationId)).toThrow();
  });
});
