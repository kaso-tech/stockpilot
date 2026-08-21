import { describe, expect, it } from "vitest";
import { cronFor } from "./routers/backups";

describe("planification des sauvegardes", () => {
  it("produit des expressions Heartbeat à six champs pour chaque fréquence supportée", () => {
    expect(cronFor(6)).toBe("0 0 */6 * * *");
    expect(cronFor(12)).toBe("0 0 */12 * * *");
    expect(cronFor(24)).toBe("0 0 2 * * *");
    expect(cronFor(48)).toBe("0 0 2 */2 * *");
    expect(cronFor(168)).toBe("0 0 2 * * 1");
  });
});
