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
  companyId: number;
  tables: Record<string, unknown[]>;
};

const snapshotTableNames = new Set(snapshotSources.map(source => source.name));
const tablesWithCompanyId = new Set(["users", "suppliers", "products", "customers", "agents", "remunerationProfiles", "saleSettings", "sales", "agentPayments", "inventorySessions", "stockMovements", "stockAlerts", "auditLogs"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBackupTables(tables: unknown, companyId: number) {
  if (!isRecord(tables)) throw new Error("Les tables de la sauvegarde sont invalides.");
  for (const [tableName, rows] of Object.entries(tables)) {
    if (!snapshotTableNames.has(tableName)) throw new Error(`Table de sauvegarde non autorisée : ${tableName}.`);
    if (!Array.isArray(rows) || rows.some(row => !isRecord(row))) throw new Error(`Les lignes de la table ${tableName} sont invalides.`);
    if (tablesWithCompanyId.has(tableName) && rows.some(row => row.companyId !== companyId)) {
      throw new Error(`La table ${tableName} contient une ligne hors de l’entreprise.`);
    }
  }
  const rowsFor = (name: string) => Array.isArray(tables[name]) ? tables[name] : [];
  const ids = (name: string) => new Set(rowsFor(name).map(row => row.id).filter((id): id is number => typeof id === "number" && Number.isInteger(id)));
  const userIds = ids("users");
  const saleIds = ids("sales");
  const inventoryIds = ids("inventorySessions");
  if (rowsFor("sellerCredentials").some(row => typeof row.userId !== "number" || !userIds.has(row.userId))) throw new Error("Une identification vendeur référence un utilisateur absent de la sauvegarde.");
  if (rowsFor("saleItems").some(row => typeof row.saleId !== "number" || !saleIds.has(row.saleId))) throw new Error("Une ligne de vente référence une vente absente de la sauvegarde.");
  if (rowsFor("saleCommissions").some(row => typeof row.saleId !== "number" || !saleIds.has(row.saleId))) throw new Error("Une commission référence une vente absente de la sauvegarde.");
  if (rowsFor("inventoryItems").some(row => typeof row.inventorySessionId !== "number" || !inventoryIds.has(row.inventorySessionId))) throw new Error("Une ligne d’inventaire référence une session absente de la sauvegarde.");
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  return db;
}

function requireBackupCompanyId(companyId: number | null | undefined): number {
  const normalized = typeof companyId === "number" ? companyId : Number.NaN;
  if (!Number.isInteger(normalized) || normalized <= 0) throw new Error("Une sauvegarde doit appartenir à une entreprise explicite.");
  return normalized;
}

function backupFilename(now = new Date()) {
  return `stockpilot-backup-${now.toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function createBackupSnapshot(actorUserId: number | null, trigger: Trigger, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  const db = await dbOrThrow();
  const selectCompanyRows = async (table: any) => db.select().from(table).where(companyScope(table.companyId, scopedCompanyId));
  const selectChildren = async (table: any, foreignKey: any, parentIds: number[]) => parentIds.length
    ? db.select().from(table).where(inArray(foreignKey, parentIds))
    : [];

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
  return persistSnapshot(db, actorUserId, trigger, scopedCompanyId, tables);
}

async function persistSnapshot(db: any, actorUserId: number | null, trigger: Trigger, companyId: number, tables: Record<string, unknown[]>) {
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
  const scopedCompanyId = requireBackupCompanyId(companyId);
  const db = await dbOrThrow();
  const archive = (await db.select().from(backupArchives).where(and(eq(backupArchives.id, archiveId), companyScope(backupArchives.companyId, scopedCompanyId))).limit(1))[0];
  if (!archive?.storageKey) throw new Error("Archive introuvable.");
  return storageGetSignedUrl(archive.storageKey);
}

export async function listBackups(limit = 30, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
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
  }).from(backupArchives).leftJoin(users, eq(backupArchives.createdByUserId, users.id)).where(companyScope(backupArchives.companyId, scopedCompanyId)).orderBy(desc(backupArchives.createdAt)).limit(limit);
}

export async function applyRetentionPolicy<T extends { id: number }>(archives: T[], retentionCount: number, remove: (id: number) => Promise<void>) {
  for (const stale of archives.slice(retentionCount)) await remove(stale.id);
}

export function assertRestoreConfirmation(confirmation: string) {
  if (confirmation !== "RESTAURER") throw new Error("La confirmation RESTAURER est requise pour restaurer une archive.");
}

export function assertBackupCompany(payload: BackupPayload, companyId: number | null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  if (payload.companyId !== scopedCompanyId) throw new Error("Cette archive appartient à une autre entreprise.");
}

export async function runBackupWithStatus(actorUserId: number | null, trigger: Trigger, retentionCount = 14, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  const db = await dbOrThrow();
  try {
    const archive = await createBackupSnapshot(actorUserId, trigger, scopedCompanyId);
    const { backupSettings } = await import("../drizzle/schema");
    const settings = (await db.select().from(backupSettings).where(companyScope(backupSettings.companyId, scopedCompanyId)).limit(1))[0];
    if (settings) await db.update(backupSettings).set({ lastBackupAt: new Date(), lastBackupStatus: "success", lastBackupError: null }).where(eq(backupSettings.id, settings.id));
    if (settings?.googleDriveRefreshTokenEncrypted) await (await import("./googleDrive")).syncArchiveToGoogleDrive(archive.id, scopedCompanyId);
    const archives = await listBackups(Math.max(retentionCount + 20, 50), scopedCompanyId);
    await applyRetentionPolicy(archives, retentionCount, async id => { await db.delete(backupArchives).where(and(eq(backupArchives.id, id), companyScope(backupArchives.companyId, scopedCompanyId))); });
    return archive;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec inconnu de la sauvegarde.";
    const { backupSettings } = await import("../drizzle/schema");
    const settings = (await db.select().from(backupSettings).where(companyScope(backupSettings.companyId, scopedCompanyId)).limit(1))[0];
    if (settings) await db.update(backupSettings).set({ lastBackupStatus: "failed", lastBackupError: message }).where(eq(backupSettings.id, settings.id));
    await db.insert(backupArchives).values({ companyId: scopedCompanyId, filename: backupFilename(), trigger, status: "failed", createdByUserId: actorUserId, error: message });
    throw error;
  }
}

export function parseBackupPayload(dataUrl: string): BackupPayload {
  const match = dataUrl.match(/^data:application\/json;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Le fichier de sauvegarde doit être un JSON StockPilot valide.");
  let payload: unknown;
  try {
    const content = Buffer.from(match[1], "base64").toString("utf8");
    payload = JSON.parse(content);
  } catch {
    throw new Error("Le fichier de sauvegarde contient un JSON invalide.");
  }
  if (!isRecord(payload) || payload.schemaVersion !== 1 || payload.source !== "StockPilot" || typeof payload.exportedAt !== "string" || !Number.isInteger(payload.companyId) || Number(payload.companyId) <= 0) {
    throw new Error("La structure de la sauvegarde est invalide ou non prise en charge.");
  }
  const companyId = requireBackupCompanyId(typeof payload.companyId === "number" ? payload.companyId : null);
  validateBackupTables(payload.tables, companyId);
  return payload as unknown as BackupPayload;
}

export async function restoreBackupPayload(payload: BackupPayload, actorUserId: number, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  assertBackupCompany(payload, scopedCompanyId);
  validateBackupTables(payload.tables, scopedCompanyId);
  const db = await dbOrThrow();
  await db.transaction(async tx => {
    const [userRows, saleRows, inventoryRows] = await Promise.all([
      tx.select({ id: users.id }).from(users).where(companyScope(users.companyId, scopedCompanyId)),
      tx.select({ id: sales.id }).from(sales).where(companyScope(sales.companyId, scopedCompanyId)),
      tx.select({ id: inventorySessions.id }).from(inventorySessions).where(companyScope(inventorySessions.companyId, scopedCompanyId)),
    ]);
    const userIds = userRows.map((row: { id: number }) => row.id);
    const saleIds = saleRows.map((row: { id: number }) => row.id);
    const inventoryIds = inventoryRows.map((row: { id: number }) => row.id);
    if (userIds.length) await tx.delete(sellerCredentials).where(inArray(sellerCredentials.userId, userIds));
    if (saleIds.length) {
      await tx.delete(saleCommissions).where(inArray(saleCommissions.saleId, saleIds));
      await tx.delete(saleItems).where(inArray(saleItems.saleId, saleIds));
    }
    if (inventoryIds.length) await tx.delete(inventoryItems).where(inArray(inventoryItems.inventorySessionId, inventoryIds));
    for (const source of restoreDeleteOrder) {
      if (source.table.companyId) await tx.delete(source.table).where(companyScope(source.table.companyId, scopedCompanyId));
    }
    for (const source of snapshotSources) {
      const rows = payload.tables[source.name] ?? [];
      if (rows.length > 0) await tx.insert(source.table).values(rows as any);
    }
  });
  const restoredCount = Object.values(payload.tables).reduce((sum, rows) => sum + rows.length, 0);
  await db.insert(auditLogs).values({ companyId: scopedCompanyId, actorUserId, action: "Restauration", entityType: "Sauvegarde", entityId: null, detail: `Sauvegarde ${payload.exportedAt} restaurée (${restoredCount} enregistrements)` });
  return { restoredCount };
}
