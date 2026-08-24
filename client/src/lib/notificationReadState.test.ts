import { describe, expect, it } from "vitest";
import { readNotificationIds, unreadNotificationCount, writeNotificationIds } from "./notificationReadState";

describe("état de lecture des notifications", () => {
  it("conserve les notifications lues par compte et calcule les non lues", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 } as Storage;
    writeNotificationIds(3, 9, ["stock", "stock", "budget"], storage);
    expect(readNotificationIds(3, 9, storage)).toEqual(["stock", "budget"]);
    expect(unreadNotificationCount(["stock", "budget", "backup"], readNotificationIds(3, 9, storage))).toBe(1);
  });

  it("ne réutilise pas les lectures d’un même utilisateur dans une autre entreprise", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 } as Storage;
    writeNotificationIds(3, 9, ["stock"], storage);
    expect(readNotificationIds(4, 9, storage)).toEqual([]);
  });
});
