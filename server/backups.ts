import {
  adminFallbackPasswords, agentPayments, agents, auditLogs, backupArchives, backupSettings, customers, expenseBudgets, expenses,
  inventoryItems, inventorySessions, productCategories, productPriceTiers, productUnits, products, purchaseOrderItems, purchaseOrders,
  remunerationProfiles, saleCommissions, saleItems, salePayments, saleSettings, sales, sellerCredentials, stockAlerts, stockMovements,
  suppliers, userDashboardPreferences, users,
} from "../drizzle/schema";
import { and, desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { companyScope } from "./companyScope";
import { getDb } from "./db";
import { openBuffer, parseKey, sealBuffer } from "./secretBox";
import { storageGetSignedUrl, storagePut } from "./storage";

type Trigger = "manual" | "scheduled";
type AnyTable = any;
type Row = Record<string, unknown>;

/** Table rattachée directement à une entreprise par sa colonne `companyId`. */
type CompanySource = { name: string; table: AnyTable; kind: "company" };
/** Table enfant, rattachée à l'entreprise via la clé `foreignKey` vers `parent`. */
type ChildSource = { name: string; table: AnyTable; kind: "child"; parent: string; foreignKey: string; parentKey?: string };
type SnapshotSource = CompanySource | ChildSource;

/**
 * Ordre d'insertion : parents avant enfants. La suppression se fait dans l'ordre inverse.
 * Version 2 : toutes les données métier de l'entreprise (E14). Les tables
 * opérationnelles (sessions, archives et réglages de sauvegarde, entreprise) ne sont pas restaurées.
 */
const snapshotSources: SnapshotSource[] = [
  { name: "users", table: users, kind: "company" },
  { name: "adminFallbackPasswords", table: adminFallbackPasswords, kind: "child", parent: "users", foreignKey: "ownerOpenId", parentKey: "openId" },
  { name: "sellerCredentials", table: sellerCredentials, kind: "child", parent: "users", foreignKey: "userId" },
  { name: "userDashboardPreferences", table: userDashboardPreferences, kind: "child", parent: "users", foreignKey: "userId" },
  { name: "suppliers", table: suppliers, kind: "company" },
  { name: "productCategories", table: productCategories, kind: "company" },
  { name: "productUnits", table: productUnits, kind: "company" },
  { name: "products", table: products, kind: "company" },
  { name: "productPriceTiers", table: productPriceTiers, kind: "child", parent: "products", foreignKey: "productId" },
  { name: "customers", table: customers, kind: "company" },
  { name: "agents", table: agents, kind: "company" },
  { name: "remunerationProfiles", table: remunerationProfiles, kind: "company" },
  { name: "saleSettings", table: saleSettings, kind: "company" },
  { name: "sales", table: sales, kind: "company" },
  { name: "saleItems", table: saleItems, kind: "child", parent: "sales", foreignKey: "saleId" },
  { name: "salePayments", table: salePayments, kind: "child", parent: "sales", foreignKey: "saleId" },
  { name: "saleCommissions", table: saleCommissions, kind: "child", parent: "sales", foreignKey: "saleId" },
  { name: "agentPayments", table: agentPayments, kind: "company" },
  { name: "purchaseOrders", table: purchaseOrders, kind: "company" },
  { name: "purchaseOrderItems", table: purchaseOrderItems, kind: "child", parent: "purchaseOrders", foreignKey: "purchaseOrderId" },
  { name: "expenses", table: expenses, kind: "company" },
  { name: "expenseBudgets", table: expenseBudgets, kind: "company" },
  { name: "inventorySessions", table: inventorySessions, kind: "company" },
  { name: "inventoryItems", table: inventoryItems, kind: "child", parent: "inventorySessions", foreignKey: "inventorySessionId" },
  { name: "stockMovements", table: stockMovements, kind: "company" },
  { name: "stockAlerts", table: stockAlerts, kind: "company" },
  { name: "auditLogs", table: auditLogs, kind: "company" },
];
const sourcesByName = new Map(snapshotSources.map(source => [source.name, source]));
/** Tables présentes dans les archives de format 1 (avant l'audit). */
const VERSION_1_TABLES = new Set(["users", "sellerCredentials", "suppliers", "products", "customers", "agents", "remunerationProfiles", "saleSettings", "sales", "saleItems", "saleCommissions", "agentPayments", "inventorySessions", "inventoryItems", "stockMovements", "stockAlerts", "auditLogs"]);

/**
 * Références à vérifier à l'intérieur de l'archive (S6) : une ligne ne peut pas
 * pointer vers une donnée absente de l'archive, donc vers une autre entreprise.
 * `nullable` : la valeur peut être nulle.
 */
const references: Array<{ table: string; column: string; target: string; nullable?: boolean }> = [
  { table: "products", column: "supplierId", target: "suppliers", nullable: true },
  { table: "productPriceTiers", column: "productId", target: "products" },
  { table: "sales", column: "customerId", target: "customers", nullable: true },
  { table: "sales", column: "sellerUserId", target: "users" },
  { table: "sales", column: "salesAgentId", target: "agents", nullable: true },
  { table: "sales", column: "cashierId", target: "agents", nullable: true },
  { table: "saleItems", column: "productId", target: "products" },
  { table: "purchaseOrders", column: "supplierId", target: "suppliers" },
  { table: "purchaseOrderItems", column: "productId", target: "products" },
  { table: "inventoryItems", column: "productId", target: "products" },
  { table: "stockMovements", column: "productId", target: "products" },
  { table: "stockMovements", column: "supplierId", target: "suppliers", nullable: true },
  { table: "stockAlerts", column: "productId", target: "products" },
  { table: "saleSettings", column: "defaultSalesAgentId", target: "agents", nullable: true },
  { table: "saleSettings", column: "defaultCashierId", target: "agents", nullable: true },
];

export type BackupPayload = {
  schemaVersion: 1 | 2;
  exportedAt: string;
  source: "StockPilot";
  companyId: number;
  tables: Record<string, Row[]>;
};

const ENCRYPTED_FORMAT = "stockpilot-backup-encrypted";

function backupKey() {
  return parseKey(process.env.BACKUP_ENCRYPTION_KEY, "BACKUP_ENCRYPTION_KEY");
}

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function parentKeyOf(source: ChildSource) {
  return source.parentKey ?? "id";
}

/** Lit toutes les données de l'entreprise, tables enfants comprises. */
async function readCompanyTables(db: any, companyId: number) {
  const tables: Record<string, Row[]> = {};
  for (const source of snapshotSources) {
    if (source.kind === "company") {
      tables[source.name] = await db.select().from(source.table).where(companyScope(source.table.companyId, companyId));
    } else {
      const parentValues = (tables[source.parent] ?? []).map(row => row[parentKeyOf(source)]).filter(value => value !== null && value !== undefined);
      tables[source.name] = parentValues.length ? await db.select().from(source.table).where(inArray(source.table[source.foreignKey], parentValues)) : [];
    }
  }
  return tables;
}

export async function createBackupSnapshot(actorUserId: number | null, trigger: Trigger, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  const db = await dbOrThrow();
  const tables = await readCompanyTables(db, scopedCompanyId);
  return persistSnapshot(db, actorUserId, trigger, scopedCompanyId, tables);
}

/** Sérialise l'archive, chiffrée si BACKUP_ENCRYPTION_KEY est configurée (B2). */
export function serializeBackup(payload: BackupPayload) {
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const key = backupKey();
  if (!key) return plain;
  return Buffer.from(JSON.stringify({ format: ENCRYPTED_FORMAT, version: 1, companyId: payload.companyId, exportedAt: payload.exportedAt, ...sealBuffer(key, plain) }), "utf8");
}

async function persistSnapshot(db: any, actorUserId: number | null, trigger: Trigger, companyId: number, tables: Record<string, Row[]>) {
  const payload: BackupPayload = { schemaVersion: 2, exportedAt: new Date().toISOString(), source: "StockPilot", companyId, tables };
  const buffer = serializeBackup(payload);
  const filename = backupFilename();
  const stored = await storagePut(`company/${companyId}/backups/${filename}`, buffer, "application/json");
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

async function updateBackupStatus(db: any, companyId: number, values: Record<string, unknown>) {
  await db.update(backupSettings).set(values).where(companyScope(backupSettings.companyId, companyId));
}

export async function runBackupWithStatus(actorUserId: number | null, trigger: Trigger, retentionCount = 14, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  const db = await dbOrThrow();
  let archive: Awaited<ReturnType<typeof createBackupSnapshot>>;
  try {
    archive = await createBackupSnapshot(actorUserId, trigger, scopedCompanyId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec inconnu de la sauvegarde.";
    await updateBackupStatus(db, scopedCompanyId, { lastBackupStatus: "failed", lastBackupError: message });
    await db.insert(backupArchives).values({ companyId: scopedCompanyId, filename: backupFilename(), trigger, status: "failed", createdByUserId: actorUserId, error: message });
    throw error;
  }
  // L'archive locale existe : un échec de la copie Drive ne doit pas la faire
  // passer pour une sauvegarde ratée (B5). On le signale séparément.
  let driveError: string | null = null;
  const settings = (await db.select().from(backupSettings).where(companyScope(backupSettings.companyId, scopedCompanyId)).limit(1))[0];
  if (settings?.googleDriveRefreshTokenEncrypted) {
    try {
      await (await import("./googleDrive")).syncArchiveToGoogleDrive(archive.id, scopedCompanyId);
    } catch (error) {
      driveError = `Archive créée, mais la copie Google Drive a échoué : ${error instanceof Error ? error.message : "erreur inconnue"}`;
      await db.update(backupArchives).set({ error: driveError }).where(and(eq(backupArchives.id, archive.id), companyScope(backupArchives.companyId, scopedCompanyId)));
    }
  }
  await updateBackupStatus(db, scopedCompanyId, { lastBackupAt: new Date(), lastBackupStatus: "success", lastBackupError: driveError });
  const archives = (await listBackups(Math.max(retentionCount + 20, 50), scopedCompanyId)).filter(item => item.status !== "failed");
  // Les fichiers déjà stockés ne peuvent pas être supprimés via l'API de stockage
  // actuelle : ils restent chiffrés lorsque BACKUP_ENCRYPTION_KEY est configurée.
  await applyRetentionPolicy(archives, retentionCount, async id => { await db.delete(backupArchives).where(and(eq(backupArchives.id, id), companyScope(backupArchives.companyId, scopedCompanyId))); });
  return archive;
}

/** Déchiffre une archive chiffrée ; renvoie le texte JSON en clair. */
function decodeArchiveContent(content: string) {
  let envelope: unknown;
  try { envelope = JSON.parse(content); } catch { throw new Error("Le fichier de sauvegarde contient un JSON invalide."); }
  if (!isRecord(envelope) || envelope.format !== ENCRYPTED_FORMAT) return envelope;
  const key = backupKey();
  if (!key) throw new Error("Cette archive est chiffrée : BACKUP_ENCRYPTION_KEY doit être configurée pour la restaurer.");
  try {
    return JSON.parse(openBuffer(key, { iv: String(envelope.iv), tag: String(envelope.tag), data: String(envelope.data) }).toString("utf8"));
  } catch {
    throw new Error("Impossible de déchiffrer l’archive : clé incorrecte ou fichier altéré.");
  }
}

function coerceRow(source: SnapshotSource, row: Row, tableName: string): Row {
  const columns = getTableColumns(source.table) as Record<string, { dataType: string; notNull: boolean }>;
  const coerced: Row = {};
  for (const [key, value] of Object.entries(row)) {
    const column = columns[key];
    if (!column) throw new Error(`Colonne inconnue « ${key} » dans la table ${tableName}.`);
    if (value === null || value === undefined) { coerced[key] = null; continue; }
    if (column.dataType === "date") {
      const date = new Date(value as string);
      if (Number.isNaN(date.getTime())) throw new Error(`Date invalide dans la table ${tableName} (${key}).`);
      coerced[key] = date;
    } else if (column.dataType === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Nombre invalide dans la table ${tableName} (${key}).`);
      coerced[key] = value;
    } else if (column.dataType === "boolean") {
      if (typeof value !== "boolean" && value !== 0 && value !== 1) throw new Error(`Booléen invalide dans la table ${tableName} (${key}).`);
      coerced[key] = Boolean(value);
    } else {
      if (typeof value !== "string") throw new Error(`Texte invalide dans la table ${tableName} (${key}).`);
      coerced[key] = value;
    }
  }
  return coerced;
}

/** Valide la structure, l'appartenance et la cohérence interne de l'archive (S6). */
function validateBackupTables(tables: unknown, companyId: number): Record<string, Row[]> {
  if (!isRecord(tables)) throw new Error("Les tables de la sauvegarde sont invalides.");
  const validated: Record<string, Row[]> = {};
  for (const [tableName, rows] of Object.entries(tables)) {
    const source = sourcesByName.get(tableName);
    if (!source) throw new Error(`Table de sauvegarde non autorisée : ${tableName}.`);
    if (!Array.isArray(rows) || rows.some(row => !isRecord(row))) throw new Error(`Les lignes de la table ${tableName} sont invalides.`);
    if (source.kind === "company" && rows.some(row => row.companyId !== companyId)) throw new Error(`La table ${tableName} contient une ligne hors de l’entreprise.`);
    validated[tableName] = rows.map(row => coerceRow(source, row as Row, tableName));
  }
  const rowsFor = (name: string) => validated[name] ?? [];
  const valuesOf = (name: string, key = "id") => new Set(rowsFor(name).map(row => row[key]));
  for (const source of snapshotSources) {
    if (source.kind !== "child") continue;
    const parents = valuesOf(source.parent, parentKeyOf(source));
    if (rowsFor(source.name).some(row => !parents.has(row[source.foreignKey]))) throw new Error(`La table ${source.name} référence une ligne absente de la sauvegarde (${source.parent}).`);
  }
  for (const reference of references) {
    if (!validated[reference.table] || !validated[reference.target]) continue;
    const targets = valuesOf(reference.target);
    if (rowsFor(reference.table).some(row => { const value = row[reference.column]; return value === null || value === undefined ? !reference.nullable : !targets.has(value); })) {
      throw new Error(`La table ${reference.table} (${reference.column}) référence une donnée absente de la sauvegarde.`);
    }
  }
  return validated;
}

export function parseBackupPayload(dataUrl: string): BackupPayload {
  const match = dataUrl.match(/^data:application\/json;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Le fichier de sauvegarde doit être un JSON StockPilot valide.");
  const payload = decodeArchiveContent(Buffer.from(match[1], "base64").toString("utf8"));
  if (!isRecord(payload) || (payload.schemaVersion !== 1 && payload.schemaVersion !== 2) || payload.source !== "StockPilot" || typeof payload.exportedAt !== "string" || !Number.isInteger(payload.companyId) || Number(payload.companyId) <= 0) {
    throw new Error("La structure de la sauvegarde est invalide ou non prise en charge.");
  }
  const companyId = requireBackupCompanyId(typeof payload.companyId === "number" ? payload.companyId : null);
  const tables = validateBackupTables(payload.tables, companyId);
  if (payload.schemaVersion === 1 && Object.keys(tables).some(name => !VERSION_1_TABLES.has(name))) throw new Error("La structure de la sauvegarde est invalide ou non prise en charge.");
  return { schemaVersion: payload.schemaVersion, exportedAt: payload.exportedAt, source: "StockPilot", companyId, tables };
}

/** Tables remplacées par la restauration : toutes en version 2, uniquement celles de l'époque en version 1. */
function restoredSources(payload: BackupPayload) {
  return snapshotSources.filter(source => payload.schemaVersion === 2 || VERSION_1_TABLES.has(source.name));
}

export async function restoreBackupPayload(payload: BackupPayload, actorUserId: number, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  assertBackupCompany(payload, scopedCompanyId);
  const tables = validateBackupTables(payload.tables, scopedCompanyId);
  // Empêche l'administrateur de se verrouiller hors de son entreprise.
  if (!(tables.users ?? []).some(row => row.id === actorUserId && row.role === "admin" && row.active !== false)) {
    throw new Error("Cette archive ne contient pas votre compte administrateur actif : la restauration vous déconnecterait définitivement.");
  }
  const sources = restoredSources(payload);
  const db = await dbOrThrow();
  await db.transaction(async tx => {
    const current = await readCompanyTables(tx, scopedCompanyId);
    for (const source of [...sources].reverse()) {
      if (source.kind === "company") {
        await tx.delete(source.table).where(companyScope(source.table.companyId, scopedCompanyId));
      } else {
        const parentValues = (current[source.parent] ?? []).map(row => row[parentKeyOf(source)]).filter(value => value !== null && value !== undefined);
        if (parentValues.length) await tx.delete(source.table).where(inArray(source.table[source.foreignKey], parentValues));
      }
    }
    for (const source of sources) {
      const rows = tables[source.name] ?? [];
      for (let index = 0; index < rows.length; index += 500) await tx.insert(source.table).values(rows.slice(index, index + 500) as any);
    }
  });
  const restoredCount = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);
  await db.insert(auditLogs).values({ companyId: scopedCompanyId, actorUserId, action: "Restauration", entityType: "Sauvegarde", entityId: null, detail: `Sauvegarde ${payload.exportedAt} restaurée (${restoredCount} enregistrements)` });
  return { restoredCount };
}
