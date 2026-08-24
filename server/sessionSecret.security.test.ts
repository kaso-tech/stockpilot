import { describe, expect, it } from "vitest";
import { assertSecureSessionSecret } from "./_core/sdk";

describe("assertSecureSessionSecret", () => {
  it("accepts a sufficiently long, diverse session secret in production", () => {
    expect(() => assertSecureSessionSecret("SecureSessionKey2026Abc", true)).not.toThrow();
  });

  it("rejects a missing, short, or low-diversity session secret in production", () => {
    expect(() => assertSecureSessionSecret("", true)).toThrow(
      "Session secret is not configured securely.",
    );
    expect(() => assertSecureSessionSecret("ShortKey2026Abc", true)).toThrow(
      "Session secret is not configured securely.",
    );
    expect(() => assertSecureSessionSecret("a".repeat(32), true)).toThrow(
      "Session secret is not configured securely.",
    );
  });

  it("preserves development compatibility while requiring a configured secret", () => {
    expect(() => assertSecureSessionSecret("dev-secret", false)).not.toThrow();
    expect(() => assertSecureSessionSecret("", false)).toThrow(
      "Session secret is not configured securely.",
    );
  });
});
