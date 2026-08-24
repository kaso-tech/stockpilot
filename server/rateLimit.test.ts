import { beforeEach, describe, expect, it } from "vitest";
import { clearRateLimitsForTests, consumeRateLimit } from "./rateLimit";

describe("limiteur de débit d’authentification", () => {
  beforeEach(() => clearRateLimitsForTests());

  it("autorise la fenêtre puis refuse au-delà de la limite", () => {
    expect(consumeRateLimit("ip:test", 2, 1_000, 10)).toBe(true);
    expect(consumeRateLimit("ip:test", 2, 1_000, 20)).toBe(true);
    expect(consumeRateLimit("ip:test", 2, 1_000, 30)).toBe(false);
  });

  it("réinitialise le compteur après expiration", () => {
    expect(consumeRateLimit("ip:test", 1, 1_000, 10)).toBe(true);
    expect(consumeRateLimit("ip:test", 1, 1_000, 1_011)).toBe(true);
  });
});
