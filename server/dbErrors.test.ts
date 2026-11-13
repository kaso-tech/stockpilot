import { describe, expect, it } from "vitest";
import { isDuplicateKeyError } from "./dbErrors";

describe("isDuplicateKeyError", () => {
  it("reconnaît une violation d'unicité directe ou enveloppée", () => {
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
    expect(
      isDuplicateKeyError(new Error("wrapper", { cause: { errno: 1062 } }))
    ).toBe(true);
  });

  it("ignore les autres erreurs", () => {
    expect(isDuplicateKeyError(new Error("connexion perdue"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});
