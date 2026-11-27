import { describe, expect, it } from "vitest";
import { CHECKOUT_LOCK_TTL_MS, formatQueueNumber, lockedByOther, queueNumberFor } from "./posQueueRules";

describe("circuit vendeur → caisse", () => {
  const now = new Date("2026-11-27T10:00:00Z");
  it("verrouille le ticket pour les autres pendant 2 minutes", () => {
    expect(lockedByOther(7, new Date(now.getTime() - 30_000), 9, now)).toBe(true);
    expect(lockedByOther(7, new Date(now.getTime() - 30_000), 7, now)).toBe(false);
    expect(lockedByOther(7, new Date(now.getTime() - CHECKOUT_LOCK_TTL_MS - 1), 9, now)).toBe(false);
    expect(lockedByOther(null, null, 9, now)).toBe(false);
  });
  it("numérote les tickets du jour et garde le numéro d’un ticket renvoyé le même jour", () => {
    expect(queueNumberFor(null, "2026-11-27", null)).toBe(1);
    expect(queueNumberFor(null, "2026-11-27", 11)).toBe(12);
    expect(queueNumberFor({ queueNumber: 5, queueDay: "2026-11-27" }, "2026-11-27", 11)).toBe(5);
    expect(queueNumberFor({ queueNumber: 5, queueDay: "2026-11-26" }, "2026-11-27", 2)).toBe(3);
    expect(formatQueueNumber(12)).toBe("012");
  });
});
