import { and, desc, eq } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { backupArchives, backupSettings, auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { assertBackupCompany, assertRestoreConfirmation, getBackupDownloadUrl, listBackups, parseBackupPayload, restoreBackupPayload, runBackupWithStatus } from "../backups";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { googleDriveConfigured } from "../googleDrive";
import { companyScope } from "../companyScope";

const frequencyHours = z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(48), z.literal(168)]);
const configurationInput = z.object({ automaticEnabled: z.boolean(), frequencyHours, retentionCount: z.number().int().min(3).max(90), googleDriveFolderId: z.string().trim().max(180).nullable() });

export function cronFor(hours: number) {
  if (hours === 6) return "0 0 */6 * * *";
  if (hours === 12) return "0 0 */12 * * *";
  if (hours === 48) return "0 0 2 */2 * *";
  if (hours === 168) return "0 0 2 * * 1";
  return "0 0 2 * * *";
}

async function dbOrThrow() { const db = await getDb(); if (!db) throw new Error("Base de données indisponible."); return db; }
async function getOrCreateSettings(companyId: number | null) { const db = await dbOrThrow(); const current = (await db.select().from(backupSettings).where(companyScope(backupSettings.companyId, companyId)).limit(1))[0]; if (current) return current; const result = await db.insert(backupSettings).values({ companyId }); return (await db.select().from(backupSettings).where(eq(backupSettings.id, Number(result[0].insertId))).limit(1))[0]!; }

export const backupRouter = router({
  get: adminProcedure.query(async ({ ctx }) => { const settings = await getOrCreateSettings(ctx.user.companyId); const archives = await listBackups(30, ctx.user.companyId); return { settings: { automaticEnabled: settings.automaticEnabled, frequencyHours: settings.frequencyHours, retentionCount: settings.retentionCount, googleDriveFolderId: settings.googleDriveFolderId, googleDriveConfigured: googleDriveConfigured(), googleDriveConnected: Boolean(settings.googleDriveRefreshTokenEncrypted), scheduleNextAt: settings.scheduleNextAt, lastBackupAt: settings.lastBackupAt, lastBackupStatus: settings.lastBackupStatus, lastBackupError: settings.lastBackupError }, archives }; }),
  saveConfiguration: adminProcedure.input(configurationInput).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); const current = await getOrCreateSettings(ctx.user.companyId); const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? ""; let taskUid = current.scheduleCronTaskUid; let nextExecutionAt: string | null = current.scheduleNextAt?.toISOString() ?? null;
    if (input.automaticEnabled) {
      if (taskUid) nextExecutionAt = (await updateHeartbeatJob(taskUid, { cron: cronFor(input.frequencyHours), path: "/api/scheduled/backup", method: "POST", description: "Sauvegarde automatique StockPilot", enable: true }, sessionToken)).nextExecutionAt ?? null;
      else { const job = await createHeartbeatJob({ name: "stockpilot-automatic-backup", cron: cronFor(input.frequencyHours), path: "/api/scheduled/backup", method: "POST", description: "Sauvegarde automatique StockPilot" }, sessionToken); taskUid = job.taskUid; nextExecutionAt = job.nextExecutionAt ?? null; }
    } else if (taskUid) nextExecutionAt = (await updateHeartbeatJob(taskUid, { enable: false }, sessionToken)).nextExecutionAt ?? null;
    await db.update(backupSettings).set({ ...input, scheduleCronTaskUid: taskUid, scheduleNextAt: nextExecutionAt ? new Date(nextExecutionAt) : null, updatedByUserId: ctx.user.id }).where(eq(backupSettings.id, current.id));
    await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Sauvegarde configurée", entityType: "Sauvegarde", entityId: String(current.id), detail: input.automaticEnabled ? `Sauvegarde automatique toutes les ${input.frequencyHours} h activée` : "Sauvegarde automatique suspendue" });
    return { success: true, nextExecutionAt };
  }),
  runNow: protectedProcedure.mutation(async ({ ctx }) => { const settings = await getOrCreateSettings(ctx.user.companyId); const archive = await runBackupWithStatus(ctx.user.id, "manual", settings.retentionCount, ctx.user.companyId); const db = await dbOrThrow(); await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Sauvegarde créée", entityType: "Sauvegarde", entityId: String(archive.id), detail: `Archive locale ${archive.filename} créée` }); return archive; }),
  download: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => ({ url: await getBackupDownloadUrl(input.id, ctx.user.companyId) })),
  previewRestore: adminProcedure.input(z.object({ dataUrl: z.string().min(40).max(30_000_000) })).mutation(async ({ ctx, input }) => { const payload = parseBackupPayload(input.dataUrl); assertBackupCompany(payload, ctx.user.companyId); const counts = Object.fromEntries(Object.entries(payload.tables).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0])); return { exportedAt: payload.exportedAt, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) }; }),
  restore: adminProcedure.input(z.object({ dataUrl: z.string().min(40).max(30_000_000), confirmation: z.string().max(30) })).mutation(async ({ ctx, input }) => { assertRestoreConfirmation(input.confirmation); const payload = parseBackupPayload(input.dataUrl); assertBackupCompany(payload, ctx.user.companyId); return restoreBackupPayload(payload, ctx.user.id); }),
  removeArchive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await dbOrThrow(); await db.delete(backupArchives).where(and(eq(backupArchives.id, input.id), companyScope(backupArchives.companyId, ctx.user.companyId))); await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "Archive supprimée", entityType: "Sauvegarde", entityId: String(input.id), detail: "Archive retirée de l’historique" }); return { success: true }; }),
});
