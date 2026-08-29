import { describe, expect, it } from "vitest";
import { didApplyExactlyOneStateTransition } from "./transactionRules";

describe("optimistic state transitions", () => {
  it("accepts exactly one updated row", () => {
    expect(didApplyExactlyOneStateTransition([{ affectedRows: 1 }])).toBe(true);
  });

  it("rejects a stale or ambiguous transition", () => {
    expect(didApplyExactlyOneStateTransition([{ affectedRows: 0 }])).toBe(false);
    expect(didApplyExactlyOneStateTransition([{ affectedRows: 2 }])).toBe(false);
    expect(didApplyExactlyOneStateTransition(undefined)).toBe(false);
  });
});
