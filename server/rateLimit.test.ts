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

  it("ne bloque pas les nouveaux clients quand la table est saturée", () => {
    for (let index = 0; index < 10_000; index += 1) consumeRateLimit(`flood:${index}`, 1, 60_000, 10);
    expect(consumeRateLimit("ip:legitime", 5, 60_000, 20)).toBe(true);
  });
});
