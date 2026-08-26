export type BackupHealth = "healthy" | "stale" | "failed" | "not_configured";
export type SyncHealth = "healthy" | "pending" | "failed" | "offline" | "stale" | "not_reported";

type BackupHealthInput = {
  automaticEnabled: boolean | null | undefined;
  frequencyHours: number | null | undefined;
  lastBackupAt: Date | null | undefined;
  lastBackupStatus: "idle" | "success" | "failed" | null | undefined;
};

export function resolveBackupHealth(input: BackupHealthInput, now = new Date()): BackupHealth {
  if (!input.automaticEnabled || !input.lastBackupAt) return "not_configured";
  if (input.lastBackupStatus === "failed") return "failed";

  const frequencyHours = Math.max(input.frequencyHours ?? 24, 1);
  const staleAfter = frequencyHours * 2 * 60 * 60 * 1000;
  return now.getTime() - input.lastBackupAt.getTime() > staleAfter ? "stale" : "healthy";
}

export function resolveSyncHealth(input: { status: "healthy" | "pending" | "failed" | "offline" | null | undefined; updatedAt: Date | null | undefined }, now = new Date()): SyncHealth {
  if (!input.updatedAt || !input.status) return "not_reported";
  if (now.getTime() - input.updatedAt.getTime() > 72 * 60 * 60 * 1000) return "stale";
  return input.status;
}

export function resolveCompanyHealth(input: BackupHealthInput & { platformStatus: "active" | "suspended"; openSupportCount: number; syncStatus?: "healthy" | "pending" | "failed" | "offline" | null; syncUpdatedAt?: Date | null }, now = new Date()) {
  const backupHealth = resolveBackupHealth(input, now);
  const syncHealth = resolveSyncHealth({ status: input.syncStatus, updatedAt: input.syncUpdatedAt }, now);
  const attentionRequired = input.platformStatus === "suspended" || backupHealth === "failed" || backupHealth === "stale" || ["failed", "offline", "stale"].includes(syncHealth) || input.openSupportCount > 0;
  return { backupHealth, syncHealth, attentionRequired };
}
