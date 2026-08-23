import { describe, expect, it } from "vitest";
import { readNotificationIds, unreadNotificationCount, writeNotificationIds } from "./notificationReadState";

describe("état de lecture des notifications", () => {
  it("conserve les notifications lues par compte et calcule les non lues", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 } as Storage;
    writeNotificationIds(9, ["stock", "stock", "budget"], storage);
    expect(readNotificationIds(9, storage)).toEqual(["stock", "budget"]);
    expect(unreadNotificationCount(["stock", "budget", "backup"], readNotificationIds(9, storage))).toBe(1);
  });
});
