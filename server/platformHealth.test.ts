import { describe, expect, it } from "vitest";
import { resolveBackupHealth, resolveCompanyHealth, resolveSyncHealth } from "./platformHealth";

const now = new Date("2026-08-26T12:00:00.000Z");

describe("platform health", () => {
  it("classifies backup health without exposing business records", () => {
    expect(resolveBackupHealth({ automaticEnabled: false, frequencyHours: 24, lastBackupAt: null, lastBackupStatus: "idle" }, now)).toBe("not_configured");
    expect(resolveBackupHealth({ automaticEnabled: true, frequencyHours: 24, lastBackupAt: new Date("2026-08-26T08:00:00.000Z"), lastBackupStatus: "success" }, now)).toBe("healthy");
    expect(resolveBackupHealth({ automaticEnabled: true, frequencyHours: 24, lastBackupAt: new Date("2026-08-23T08:00:00.000Z"), lastBackupStatus: "success" }, now)).toBe("stale");
    expect(resolveBackupHealth({ automaticEnabled: true, frequencyHours: 24, lastBackupAt: new Date("2026-08-26T08:00:00.000Z"), lastBackupStatus: "failed" }, now)).toBe("failed");
  });

  it("requires attention for a suspended company, an unhealthy backup or open support", () => {
    expect(resolveCompanyHealth({ platformStatus: "active", automaticEnabled: true, frequencyHours: 24, lastBackupAt: new Date("2026-08-26T08:00:00.000Z"), lastBackupStatus: "success", openSupportCount: 0 }, now).attentionRequired).toBe(false);
    expect(resolveCompanyHealth({ platformStatus: "active", automaticEnabled: true, frequencyHours: 24, lastBackupAt: new Date("2026-08-26T08:00:00.000Z"), lastBackupStatus: "success", openSupportCount: 1 }, now).attentionRequired).toBe(true);
  });

  it("marks missing or stale synchronization reports without storing operation details", () => {
    expect(resolveSyncHealth({ status: null, updatedAt: null }, now)).toBe("not_reported");
    expect(resolveSyncHealth({ status: "healthy", updatedAt: new Date("2026-08-20T12:00:00.000Z") }, now)).toBe("stale");
    expect(resolveCompanyHealth({ platformStatus: "active", automaticEnabled: true, frequencyHours: 24, lastBackupAt: new Date("2026-08-26T08:00:00.000Z"), lastBackupStatus: "success", openSupportCount: 0, syncStatus: "failed", syncUpdatedAt: now }, now).attentionRequired).toBe(true);
  });
});
