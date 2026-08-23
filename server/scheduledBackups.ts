import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { backupSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { runBackupWithStatus } from "./backups";
import { sdk } from "./_core/sdk";

export async function runScheduledBackup(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "database-unavailable" });
    const settings = (await db.select().from(backupSettings).where(eq(backupSettings.scheduleCronTaskUid, user.taskUid)).limit(1))[0];
    if (!settings || !settings.automaticEnabled) return res.json({ ok: true, skipped: "inactive-or-orphan" });
    const archive = await runBackupWithStatus(settings.updatedByUserId ?? null, "scheduled", settings.retentionCount, settings.companyId);
    res.json({ ok: true, archiveId: archive.id, filename: archive.filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message, timestamp: new Date().toISOString(), context: { path: "/api/scheduled/backup" } });
  }
}
