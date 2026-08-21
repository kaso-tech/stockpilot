import { describe, expect, it } from "vitest";
import { readPreference, writePreference } from "../client/src/lib/preferenceStorage";

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
});
