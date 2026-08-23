import {
  agentPayments, agents, auditLogs, backupArchives, customers, inventoryItems,
  inventorySessions, products, remunerationProfiles, saleCommissions, saleItems,
  saleSettings, sales, sellerCredentials, stockAlerts, stockMovements, suppliers, users,
} from "../drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { companyScope } from "./companyScope";
import { getDb } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";

type Trigger = "manual" | "scheduled";
type SnapshotSource = { name: string; table: any };

const snapshotSources: SnapshotSource[] = [
  { name: "users", table: users }, { name: "sellerCredentials", table: sellerCredentials },
  { name: "suppliers", table: suppliers }, { name: "products", table: products },
  { name: "customers", table: customers }, { name: "agents", table: agents },
  { name: "remunerationProfiles", table: remunerationProfiles }, { name: "saleSettings", table: saleSettings },
  { name: "sales", table: sales }, { name: "saleItems", table: saleItems },
  { name: "saleCommissions", table: saleCommissions }, { name: "agentPayments", table: agentPayments },
  { name: "inventorySessions", table: inventorySessions }, { name: "inventoryItems", table: inventoryItems },
  { name: "stockMovements", table: stockMovements }, { name: "stockAlerts", table: stockAlerts },
  { name: "auditLogs", table: auditLogs },
];

const restoreDeleteOrder = [...snapshotSources].reverse();

export type BackupPayload = {
  schemaVersion: 1;
  exportedAt: string;
  source: "StockPilot";
  companyId?: number | null;
  tables: Record<string, unknown[]>;
};

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  return db;
}

function backupFilename(now = new Date()) {
  return `stockpilot-backup-${now.toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function createBackupSnapshot(actorUserId: number | null, trigger: Trigger, companyId: number | null = null) {
  const db = await dbOrThrow();
  const selectCompanyRows = async (table: any) => companyId === null
    ? db.select().from(table)
    : db.select().from(table).where(companyScope(table.companyId, companyId));
  const selectChildren = async (table: any, foreignKey: any, parentIds: number[]) => parentIds.length
    ? db.select().from(table).where(inArray(foreignKey, parentIds))
    : [];

  if (companyId === null) {
    const tableEntries = await Promise.all(snapshotSources.map(async source => [source.name, await db.select().from(source.table)] as const));
    const tables = Object.fromEntries(tableEntries) as Record<string, unknown[]>;
    return persistSnapshot(db, actorUserId, trigger, companyId, tables);
  }

  const [userRows, supplierRows, productRows, customerRows, agentRows, remunerationRows, saleSettingRows, saleRows, agentPaymentRows, inventoryRows, movementRows, alertRows, auditRows] = await Promise.all([
    selectCompanyRows(users), selectCompanyRows(suppliers), selectCompanyRows(products), selectCompanyRows(customers),
    selectCompanyRows(agents), selectCompanyRows(remunerationProfiles), selectCompanyRows(saleSettings), selectCompanyRows(sales),
    selectCompanyRows(agentPayments), selectCompanyRows(inventorySessions), selectCompanyRows(stockMovements), selectCompanyRows(stockAlerts), selectCompanyRows(auditLogs),
  ]);
  const userIds = userRows.map((row: any) => row.id);
  const saleIds = saleRows.map((row: any) => row.id);
  const inventoryIds = inventoryRows.map((row: any) => row.id);
  const [credentialRows, saleItemRows, commissionRows, inventoryItemRows] = await Promise.all([
    selectChildren(sellerCredentials, sellerCredentials.userId, userIds),
    selectChildren(saleItems, saleItems.saleId, saleIds),
    selectChildren(saleCommissions, saleCommissions.saleId, saleIds),
    selectChildren(inventoryItems, inventoryItems.inventorySessionId, inventoryIds),
  ]);
  const tables: Record<string, unknown[]> = {
    users: userRows, sellerCredentials: credentialRows, suppliers: supplierRows, products: productRows,
    customers: customerRows, agents: agentRows, remunerationProfiles: remunerationRows, saleSettings: saleSettingRows,
    sales: saleRows, saleItems: saleItemRows, saleCommissions: commissionRows, agentPayments: agentPaymentRows,
    inventorySessions: inventoryRows, inventoryItems: inventoryItemRows, stockMovements: movementRows,
    stockAlerts: alertRows, auditLogs: auditRows,
  };
  return persistSnapshot(db, actorUserId, trigger, companyId, tables);
}

async function persistSnapshot(db: any, actorUserId: number | null, trigger: Trigger, companyId: number | null, tables: Record<string, unknown[]>) {
  const payload: BackupPayload = { schemaVersion: 1, exportedAt: new Date().toISOString(), source: "StockPilot", companyId, tables };
  const content = JSON.stringify(payload, null, 2);
  const buffer = Buffer.from(content, "utf8");
  const filename = backupFilename();
  const stored = await storagePut(`company/${companyId ?? "legacy"}/backups/${filename}`, buffer, "application/json");
  const recordCount = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);
  const result = await db.insert(backupArchives).values({ companyId, filename, trigger, storageKey: stored.key, storageUrl: stored.url, sizeBytes: buffer.byteLength, recordCount, createdByUserId: actorUserId });
  return { id: Number(result[0].insertId), filename, storageUrl: stored.url, sizeBytes: buffer.byteLength, recordCount, payload };
}

export async function getBackupDownloadUrl(archiveId: number, companyId: number | null = null) {
  const db = await dbOrThrow();
  const archive = (await db.select().from(backupArchives).where(and(eq(backupArchives.id, archiveId), companyScope(backupArchives.companyId, companyId))).limit(1))[0];
  if (!archive?.storageKey) throw new Error("Archive introuvable.");
  return storageGetSignedUrl(archive.storageKey);
}

export async function listBackups(limit = 30, companyId: number | null = null) {
  const db = await dbOrThrow();
  return db.select({
    id: backupArchives.id,
    filename: backupArchives.filename,
    trigger: backupArchives.trigger,
    status: backupArchives.status,
    storageKey: backupArchives.storageKey,
    storageUrl: backupArchives.storageUrl,
    sizeBytes: backupArchives.sizeBytes,
    recordCount: backupArchives.recordCount,
    googleDriveFileId: backupArchives.googleDriveFileId,
    googleDriveUrl: backupArchives.googleDriveUrl,
    createdByUserId: backupArchives.createdByUserId,
    error: backupArchives.error,
    createdAt: backupArchives.createdAt,
    createdByName: users.name,
    createdByRole: users.role,
  }).from(backupArchives).leftJoin(users, eq(backupArchives.createdByUserId, users.id)).where(companyScope(backupArchives.companyId, companyId)).orderBy(desc(backupArchives.createdAt)).limit(limit);
}

export async function applyRetentionPolicy<T extends { id: number }>(archives: T[], retentionCount: number, remove: (id: number) => Promise<void>) {
  for (const stale of archives.slice(retentionCount)) await remove(stale.id);
}

export function assertRestoreConfirmation(confirmation: string) {
  if (confirmation !== "RESTAURER") throw new Error("La confirmation RESTAURER est requise pour restaurer une archive.");
}

export function assertBackupCompany(payload: BackupPayload, companyId: number | null) {
  if (payload.companyId !== undefined && payload.companyId !== companyId) throw new Error("Cette archive appartient à une autre entreprise.");
}

export async function runBackupWithStatus(actorUserId: number | null, trigger: Trigger, retentionCount = 14, companyId: number | null = null) {
  const db = await dbOrThrow();
  try {
    const archive = await createBackupSnapshot(actorUserId, trigger, companyId);
    const { backupSettings } = await import("../drizzle/schema");
    const settings = (await db.select().from(backupSettings).where(companyScope(backupSettings.companyId, companyId)).limit(1))[0];
    if (settings) await db.update(backupSettings).set({ lastBackupAt: new Date(), lastBackupStatus: "success", lastBackupError: null }).where(eq(backupSettings.id, settings.id));
    if (settings?.googleDriveRefreshTokenEncrypted) await (await import("./googleDrive")).syncArchiveToGoogleDrive(archive.id);
    const archives = await listBackups(Math.max(retentionCount + 20, 50), companyId);
    await applyRetentionPolicy(archives, retentionCount, async id => { await db.delete(backupArchives).where(and(eq(backupArchives.id, id), companyScope(backupArchives.companyId, companyId))); });
    return archive;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec inconnu de la sauvegarde.";
    const { backupSettings } = await import("../drizzle/schema");
    const settings = (await db.select().from(backupSettings).where(companyScope(backupSettings.companyId, companyId)).limit(1))[0];
    if (settings) await db.update(backupSettings).set({ lastBackupStatus: "failed", lastBackupError: message }).where(eq(backupSettings.id, settings.id));
    await db.insert(backupArchives).values({ companyId, filename: backupFilename(), trigger, status: "failed", createdByUserId: actorUserId, error: message });
    throw error;
  }
}

export function parseBackupPayload(dataUrl: string): BackupPayload {
  const match = dataUrl.match(/^data:application\/json;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Le fichier de sauvegarde doit être un JSON StockPilot valide.");
  const content = Buffer.from(match[1], "base64").toString("utf8");
  const payload = JSON.parse(content) as BackupPayload;
  if (payload.schemaVersion !== 1 || payload.source !== "StockPilot" || !payload.tables || typeof payload.tables !== "object") {
    throw new Error("La structure de la sauvegarde est invalide ou non prise en charge.");
  }
  return payload;
}

export async function restoreBackupPayload(payload: BackupPayload, actorUserId: number) {
  const db = await dbOrThrow();
  await db.transaction(async tx => {
    for (const source of restoreDeleteOrder) await tx.delete(source.table);
    for (const source of snapshotSources) {
      const rows = payload.tables[source.name];
      if (Array.isArray(rows) && rows.length > 0) await tx.insert(source.table).values(rows as any);
    }
  });
  const restoredCount = Object.values(payload.tables).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
  await db.insert(auditLogs).values({ actorUserId, action: "Restauration", entityType: "Sauvegarde", entityId: null, detail: `Sauvegarde ${payload.exportedAt} restaurée (${restoredCount} enregistrements)` });
  return { restoredCount };
}
