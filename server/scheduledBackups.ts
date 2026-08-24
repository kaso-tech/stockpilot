import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { backupSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { runBackupWithStatus } from "./backups";
import { sdk } from "./_core/sdk";

function isValidCompanyId(companyId: number | null): companyId is number { const normalized = typeof companyId === "number" ? companyId : Number.NaN; return Number.isInteger(normalized) && normalized > 0; }

export async function runScheduledBackup(req: Request, res: Response) {
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });

  const correlationId = randomUUID();
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "service-unavailable", correlationId });
    const settings = (await db.select().from(backupSettings).where(eq(backupSettings.scheduleCronTaskUid, user.taskUid)).limit(1))[0];
    if (!settings || !settings.automaticEnabled) return res.json({ ok: true, skipped: "inactive-or-orphan" });
    const companyId = settings.companyId;
    if (!isValidCompanyId(companyId)) return res.status(409).json({ error: "invalid-schedule-scope", correlationId });
    const archive = await runBackupWithStatus(settings.updatedByUserId ?? null, "scheduled", settings.retentionCount, companyId);
    return res.json({ ok: true, archiveId: archive.id, filename: archive.filename });
  } catch (error) {
    console.error("[ScheduledBackup] execution failed", { correlationId, error });
    return res.status(500).json({ error: "scheduled-backup-failed", correlationId, timestamp: new Date().toISOString() });
  }
}
