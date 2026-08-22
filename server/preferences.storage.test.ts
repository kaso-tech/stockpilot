import { describe, expect, it } from "vitest";
import { readPreference, writePreference } from "../client/src/lib/preferenceStorage";
import { normalizePrimaryColor, primaryForeground } from "../client/src/lib/primaryColor";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("persistance des préférences", () => {
  it("conserve les choix valides de thème et de devise après relecture", () => {
    const storage = memoryStorage();
    writePreference(storage as Storage, "theme", "light");
    writePreference(storage as Storage, "stockpilot_currency", "USD");
    expect(readPreference(storage as Storage, "theme", ["light", "dark"], "dark")).toBe("light");
    expect(readPreference(storage as Storage, "stockpilot_currency", ["USD", "EUR", "XOF"], "XOF")).toBe("USD");
  });

  it("écarte les préférences inconnues au profit de valeurs sûres", () => {
    const storage = memoryStorage();
    writePreference(storage as Storage, "theme", "violet");
    expect(readPreference(storage as Storage, "theme", ["light", "dark"], "dark")).toBe("dark");
  });
  it("normalise une couleur principale et préserve le contraste du texte", () => {
    expect(normalizePrimaryColor("#6d28d9")).toBe("#6D28D9");
    expect(normalizePrimaryColor("violet")).toBe("#007B8B");
    expect(primaryForeground("#FDE047")).toBe("#102030");
    expect(primaryForeground("#007B8B")).toBe("#FFFFFF");
  });
});
