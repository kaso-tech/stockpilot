import { createHash } from "node:crypto";
import {
  agentPayments, agents, auditLogs, backupArchives, customers, expenseBudgets, expenses,
  inventoryItems, inventorySessions, paymentDueBeneficiaryGroupMembers,
  paymentDueBeneficiaryGroups, paymentDueOccurrences, paymentDueReminderEvents,
  paymentDueSchedules, paymentDueSettlements, paymentDueTemplates, productCategories,
  productPriceTiers, productUnits, products, purchaseOrderItems, purchaseOrders,
  remunerationProfiles, saleCommissions, saleItems, salePayments, saleSettings, saleReturns, saleReturnItems, documentSequences, cashClosures,
  sales, salesAgentWarehouseAssignments, sellerCredentials, sellerWarehouseAssignments,
  stockAlerts, stockLots, stockMovements, stockTransferItems, stockTransfers, suppliers,
  supportRequests, userDashboardPreferences, userWarehousePreferences, users,
  vatRatePresets, warehouseReorderThresholds, warehouseStockAlerts, warehouseStocks,
  warehouses,
} from "../drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { companyScope } from "./companyScope";
import { getDb } from "./db";
import { storageDelete, storageGetSignedUrl, storagePut } from "./storage";

type Trigger = "manual" | "scheduled";
type SnapshotSource = { name: string; table: any };

const snapshotSources: SnapshotSource[] = [
  { name: "users", table: users }, { name: "sellerCredentials", table: sellerCredentials },
  { name: "userDashboardPreferences", table: userDashboardPreferences }, { name: "userWarehousePreferences", table: userWarehousePreferences },
  { name: "warehouses", table: warehouses }, { name: "sellerWarehouseAssignments", table: sellerWarehouseAssignments },
  { name: "suppliers", table: suppliers }, { name: "productCategories", table: productCategories }, { name: "productUnits", table: productUnits },
  { name: "products", table: products }, { name: "productPriceTiers", table: productPriceTiers },
  { name: "warehouseStocks", table: warehouseStocks }, { name: "stockLots", table: stockLots }, { name: "warehouseReorderThresholds", table: warehouseReorderThresholds }, { name: "warehouseStockAlerts", table: warehouseStockAlerts },
  { name: "stockTransfers", table: stockTransfers }, { name: "stockTransferItems", table: stockTransferItems },
  { name: "customers", table: customers }, { name: "agents", table: agents }, { name: "salesAgentWarehouseAssignments", table: salesAgentWarehouseAssignments },
  { name: "remunerationProfiles", table: remunerationProfiles }, { name: "saleSettings", table: saleSettings }, { name: "vatRatePresets", table: vatRatePresets },
  { name: "purchaseOrders", table: purchaseOrders }, { name: "purchaseOrderItems", table: purchaseOrderItems },
  { name: "sales", table: sales }, { name: "salePayments", table: salePayments }, { name: "saleItems", table: saleItems }, { name: "saleCommissions", table: saleCommissions }, { name: "saleReturns", table: saleReturns }, { name: "saleReturnItems", table: saleReturnItems }, { name: "documentSequences", table: documentSequences }, { name: "cashClosures", table: cashClosures },
  { name: "expenses", table: expenses }, { name: "expenseBudgets", table: expenseBudgets }, { name: "agentPayments", table: agentPayments },
  { name: "paymentDueTemplates", table: paymentDueTemplates }, { name: "paymentDueBeneficiaryGroups", table: paymentDueBeneficiaryGroups }, { name: "paymentDueBeneficiaryGroupMembers", table: paymentDueBeneficiaryGroupMembers },
  { name: "paymentDueSchedules", table: paymentDueSchedules }, { name: "paymentDueOccurrences", table: paymentDueOccurrences },
  { name: "paymentDueSettlements", table: paymentDueSettlements }, { name: "paymentDueReminderEvents", table: paymentDueReminderEvents },
  { name: "inventorySessions", table: inventorySessions }, { name: "inventoryItems", table: inventoryItems },
  { name: "stockMovements", table: stockMovements }, { name: "stockAlerts", table: stockAlerts },
  { name: "supportRequests", table: supportRequests }, { name: "auditLogs", table: auditLogs },
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
const tablesWithCompanyId = new Set(snapshotSources.filter(source => Boolean(source.table.companyId)).map(source => source.name));

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
  const returnIds = ids("saleReturns");
  const warehouseIds = ids("warehouses");
  const inventoryIds = ids("inventorySessions");
  const productIds = ids("products");
  const categoryIds = ids("productCategories");
  const unitIds = ids("productUnits");
  const purchaseOrderIds = ids("purchaseOrders");
  const transferIds = ids("stockTransfers");
  const groupIds = ids("paymentDueBeneficiaryGroups");
  const scheduleIds = ids("paymentDueSchedules");
  const occurrenceIds = ids("paymentDueOccurrences");
  if (rowsFor("saleReturns").some(row => !saleIds.has(row.saleId as number) || !warehouseIds.has(row.warehouseId as number))) throw new Error("Un retour référence une vente ou un entrepôt absent.");
  if (rowsFor("saleReturnItems").some(row => !returnIds.has(row.returnId as number))) throw new Error("Une ligne de retour référence un retour absent.");
  if (rowsFor("stockLots").some(row => !warehouseIds.has(row.warehouseId as number) || !productIds.has(row.productId as number) || !Number.isInteger(row.quantity) || Number(row.quantity) < 0)) throw new Error("Un lot référence un stock invalide.");
  // Archives antérieures au catalogue par ID ne contiennent pas ces champs.
  if (rowsFor("products").some(row => row.categoryId != null && (typeof row.categoryId !== "number" || !categoryIds.has(row.categoryId)))) throw new Error("Un produit référence une catégorie absente de la sauvegarde.");
  if (rowsFor("products").some(row => row.unitId != null && (typeof row.unitId !== "number" || !unitIds.has(row.unitId)))) throw new Error("Un produit référence une unité absente de la sauvegarde.");
  if (rowsFor("sellerCredentials").some(row => typeof row.userId !== "number" || !userIds.has(row.userId))) throw new Error("Une identification vendeur référence un utilisateur absent de la sauvegarde.");
  if (rowsFor("userDashboardPreferences").some(row => typeof row.userId !== "number" || !userIds.has(row.userId))) throw new Error("Une préférence de tableau de bord référence un utilisateur absent de la sauvegarde.");
  if (rowsFor("productPriceTiers").some(row => typeof row.productId !== "number" || !productIds.has(row.productId))) throw new Error("Un palier de prix référence un produit absent de la sauvegarde.");
  if (rowsFor("purchaseOrderItems").some(row => typeof row.purchaseOrderId !== "number" || !purchaseOrderIds.has(row.purchaseOrderId))) throw new Error("Une ligne de commande référence une commande absente de la sauvegarde.");
  if (rowsFor("stockTransferItems").some(row => typeof row.stockTransferId !== "number" || !transferIds.has(row.stockTransferId))) throw new Error("Une ligne de transfert référence un transfert absent de la sauvegarde.");
  if (rowsFor("saleItems").some(row => typeof row.saleId !== "number" || !saleIds.has(row.saleId))) throw new Error("Une ligne de vente référence une vente absente de la sauvegarde.");
  if (rowsFor("salePayments").some(row => typeof row.saleId !== "number" || !saleIds.has(row.saleId))) throw new Error("Un paiement de vente référence une vente absente de la sauvegarde.");
  if (rowsFor("saleCommissions").some(row => typeof row.saleId !== "number" || !saleIds.has(row.saleId))) throw new Error("Une commission référence une vente absente de la sauvegarde.");
  if (rowsFor("inventoryItems").some(row => typeof row.inventorySessionId !== "number" || !inventoryIds.has(row.inventorySessionId))) throw new Error("Une ligne d’inventaire référence une session absente de la sauvegarde.");
  if (rowsFor("paymentDueBeneficiaryGroupMembers").some(row => typeof row.groupId !== "number" || !groupIds.has(row.groupId))) throw new Error("Un membre de groupe référence un groupe absent de la sauvegarde.");
  if (rowsFor("paymentDueOccurrences").some(row => typeof row.scheduleId !== "number" || !scheduleIds.has(row.scheduleId))) throw new Error("Une occurrence référence un échéancier absent de la sauvegarde.");
  if (rowsFor("paymentDueSettlements").some(row => typeof row.occurrenceId !== "number" || !occurrenceIds.has(row.occurrenceId))) throw new Error("Un règlement référence une occurrence absente de la sauvegarde.");
  if (rowsFor("paymentDueReminderEvents").some(row => typeof row.occurrenceId !== "number" || !occurrenceIds.has(row.occurrenceId))) throw new Error("Un rappel référence une occurrence absente de la sauvegarde.");
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

export function backupContentSha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export function summarizeBackupPayload(payload: BackupPayload) {
  const counts = Object.fromEntries(Object.entries(payload.tables).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0]));
  return {
    schemaVersion: payload.schemaVersion,
    exportedAt: payload.exportedAt,
    counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

async function collectCompanySnapshot(db: any, scopedCompanyId: number) {
  const selectCompanyRows = async (table: any) => db.select().from(table).where(companyScope(table.companyId, scopedCompanyId));
  const selectChildren = async (table: any, foreignKey: any, parentIds: number[]) => parentIds.length
    ? db.select().from(table).where(inArray(foreignKey, parentIds))
    : [];

  const companySources = snapshotSources.filter(source => Boolean(source.table.companyId));
  const companyRows = await Promise.all(companySources.map(async source => [source.name, await selectCompanyRows(source.table)] as const));
  const tables = Object.fromEntries(companyRows) as Record<string, unknown[]>;
  const rowsFor = (name: string) => tables[name] ?? [];
  const getIds = (name: string) => rowsFor(name).map((row: any) => row.id).filter((id: unknown): id is number => typeof id === "number");
  const userIds = getIds("users");
  const saleIds = getIds("sales");
  const inventoryIds = getIds("inventorySessions");
  const productIds = getIds("products");
  const purchaseOrderIds = getIds("purchaseOrders");
  const transferIds = getIds("stockTransfers");
  const groupIds = getIds("paymentDueBeneficiaryGroups");
  const occurrenceIds = getIds("paymentDueOccurrences");
  const [credentialRows, dashboardPreferenceRows, priceTierRows, purchaseOrderItemRows, transferItemRows, salePaymentRows, saleItemRows, commissionRows, groupMemberRows, settlementRows, reminderRows, inventoryItemRows] = await Promise.all([
    selectChildren(sellerCredentials, sellerCredentials.userId, userIds),
    selectChildren(userDashboardPreferences, userDashboardPreferences.userId, userIds),
    selectChildren(productPriceTiers, productPriceTiers.productId, productIds),
    selectChildren(purchaseOrderItems, purchaseOrderItems.purchaseOrderId, purchaseOrderIds),
    selectChildren(stockTransferItems, stockTransferItems.stockTransferId, transferIds),
    selectChildren(salePayments, salePayments.saleId, saleIds),
    selectChildren(saleItems, saleItems.saleId, saleIds),
    selectChildren(saleCommissions, saleCommissions.saleId, saleIds),
    selectChildren(paymentDueBeneficiaryGroupMembers, paymentDueBeneficiaryGroupMembers.groupId, groupIds),
    selectChildren(paymentDueSettlements, paymentDueSettlements.occurrenceId, occurrenceIds),
    selectChildren(paymentDueReminderEvents, paymentDueReminderEvents.occurrenceId, occurrenceIds),
    selectChildren(inventoryItems, inventoryItems.inventorySessionId, inventoryIds),
  ]);
  Object.assign(tables, {
    sellerCredentials: credentialRows, userDashboardPreferences: dashboardPreferenceRows, productPriceTiers: priceTierRows,
    purchaseOrderItems: purchaseOrderItemRows, stockTransferItems: transferItemRows, salePayments: salePaymentRows,
    saleItems: saleItemRows, saleCommissions: commissionRows, paymentDueBeneficiaryGroupMembers: groupMemberRows,
    paymentDueSettlements: settlementRows, paymentDueReminderEvents: reminderRows, inventoryItems: inventoryItemRows,
  });
  tables.saleReturnItems = await selectChildren(saleReturnItems, saleReturnItems.returnId, getIds("saleReturns"));
  return tables;
}

export async function createBackupSnapshot(actorUserId: number | null, trigger: Trigger, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  const db = await dbOrThrow();
  const tables = await collectCompanySnapshot(db, scopedCompanyId);
  return persistSnapshot(db, actorUserId, trigger, scopedCompanyId, tables);
}

const exportSecretField = /password|hash|token|secret|credential|refresh|session|openid|api.?key/i;
function redactExportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactExportValue);
  if (typeof value !== "object" || value === null || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !exportSecretField.test(key))
    .map(([key, child]) => [key, redactExportValue(child)]));
}

/** Owner-only callers receive tenant rows without credentials, token material or hashes; no archive is persisted. */
export async function exportCompanyData(companyId: number | null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  const db = await dbOrThrow();
  const rawTables = await collectCompanySnapshot(db, scopedCompanyId);
  const tables = Object.fromEntries(Object.entries(rawTables)
    .filter(([tableName]) => tableName !== "sellerCredentials")
    .map(([tableName, rows]) => [tableName, redactExportValue(rows) as unknown[]]));
  return {
    schemaVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    source: "StockPilot" as const,
    companyId: scopedCompanyId,
    tables,
  };
}

/** A deletion preview is intentionally non-destructive and does not claim legal/restore readiness. */
export async function previewCompanyDeletion(companyId: number | null) {
  const payload = await exportCompanyData(companyId);
  const counts = Object.fromEntries(Object.entries(payload.tables).map(([name, rows]) => [name, rows.length]));
  return {
    companyId: payload.companyId,
    previewedAt: payload.exportedAt,
    counts,
    totalRecords: Object.values(counts).reduce((sum, count) => sum + count, 0),
    deletionEnabled: false as const,
    blockers: ["Validation juridique et des délais de conservation non confirmée.", "Vérification d’une sauvegarde restaurable non confirmée."],
  };
}

async function persistSnapshot(db: any, actorUserId: number | null, trigger: Trigger, companyId: number, tables: Record<string, unknown[]>) {
  const payload: BackupPayload = { schemaVersion: 1, exportedAt: new Date().toISOString(), source: "StockPilot", companyId, tables };
  const content = JSON.stringify(payload, null, 2);
  const buffer = Buffer.from(content, "utf8");
  const filename = backupFilename();
  const stored = await storagePut(`company/${companyId ?? "legacy"}/backups/${filename}`, buffer, "application/json");
  const recordCount = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);
  const contentSha256 = backupContentSha256(buffer);
  const result = await db.insert(backupArchives).values({ companyId, filename, trigger, storageKey: stored.key, storageUrl: stored.url, sizeBytes: buffer.byteLength, recordCount, contentSha256, createdByUserId: actorUserId });
  return { id: Number(result[0].insertId), filename, storageUrl: stored.url, sizeBytes: buffer.byteLength, recordCount, contentSha256, payload };
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
    contentSha256: backupArchives.contentSha256,
    encryptionVersion: backupArchives.encryptionVersion,
    googleDriveFileId: backupArchives.googleDriveFileId,
    googleDriveUrl: backupArchives.googleDriveUrl,
    createdByUserId: backupArchives.createdByUserId,
    error: backupArchives.error,
    createdAt: backupArchives.createdAt,
    createdByName: users.name,
    createdByRole: users.role,
  }).from(backupArchives).leftJoin(users, eq(backupArchives.createdByUserId, users.id)).where(companyScope(backupArchives.companyId, scopedCompanyId)).orderBy(desc(backupArchives.createdAt)).limit(limit);
}

/** Efface archive et objet distant pour un seul tenant, seulement si le pilote le permet. */
export async function deleteBackupArchive(archiveId: number, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  const db = await dbOrThrow();
  const archive = (await db.select().from(backupArchives).where(and(
    eq(backupArchives.id, archiveId),
    companyScope(backupArchives.companyId, scopedCompanyId),
  )).limit(1))[0];
  if (!archive) throw new Error("Archive introuvable.");
  if (archive.storageKey && !(await storageDelete(archive.storageKey))) {
    throw new Error("Ce stockage ne permet pas la suppression définitive des archives.");
  }
  await db.delete(backupArchives).where(and(
    eq(backupArchives.id, archiveId),
    companyScope(backupArchives.companyId, scopedCompanyId),
  ));
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
    await applyRetentionPolicy(archives, retentionCount, async id => {
      const stale = archives.find(item => item.id === id);
      let objectRemoved = true;
      if (stale?.storageKey) {
        try {
          objectRemoved = await storageDelete(stale.storageKey);
        } catch {
          objectRemoved = false;
        }
      }
      if (objectRemoved) {
        await db.delete(backupArchives).where(and(eq(backupArchives.id, id), companyScope(backupArchives.companyId, scopedCompanyId)));
      }
    });
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

export function previewBackupRestore(dataUrl: string, companyId: number | null) {
  const payload = parseBackupPayload(dataUrl);
  assertBackupCompany(payload, companyId);
  return { ...summarizeBackupPayload(payload), integrity: { valid: true, algorithm: "sha256", suppliedArchiveChecksum: backupContentSha256(Buffer.from(dataUrl)) } };
}

export async function restoreBackupPayload(payload: BackupPayload, actorUserId: number, companyId: number | null = null) {
  const scopedCompanyId = requireBackupCompanyId(companyId);
  assertBackupCompany(payload, scopedCompanyId);
  validateBackupTables(payload.tables, scopedCompanyId);
  const db = await dbOrThrow();
  await db.transaction(async tx => {
    const [userRows, saleRows, inventoryRows, productRows, purchaseOrderRows, transferRows, groupRows, occurrenceRows] = await Promise.all([
      tx.select({ id: users.id }).from(users).where(companyScope(users.companyId, scopedCompanyId)),
      tx.select({ id: sales.id }).from(sales).where(companyScope(sales.companyId, scopedCompanyId)),
      tx.select({ id: inventorySessions.id }).from(inventorySessions).where(companyScope(inventorySessions.companyId, scopedCompanyId)),
      tx.select({ id: products.id }).from(products).where(companyScope(products.companyId, scopedCompanyId)),
      tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(companyScope(purchaseOrders.companyId, scopedCompanyId)),
      tx.select({ id: stockTransfers.id }).from(stockTransfers).where(companyScope(stockTransfers.companyId, scopedCompanyId)),
      tx.select({ id: paymentDueBeneficiaryGroups.id }).from(paymentDueBeneficiaryGroups).where(companyScope(paymentDueBeneficiaryGroups.companyId, scopedCompanyId)),
      tx.select({ id: paymentDueOccurrences.id }).from(paymentDueOccurrences).where(companyScope(paymentDueOccurrences.companyId, scopedCompanyId)),
    ]);
    const userIds = userRows.map((row: { id: number }) => row.id);
    const saleIds = saleRows.map((row: { id: number }) => row.id);
    const inventoryIds = inventoryRows.map((row: { id: number }) => row.id);
    const productIds = productRows.map((row: { id: number }) => row.id);
    const purchaseOrderIds = purchaseOrderRows.map((row: { id: number }) => row.id);
    const transferIds = transferRows.map((row: { id: number }) => row.id);
    const groupIds = groupRows.map((row: { id: number }) => row.id);
    const occurrenceIds = occurrenceRows.map((row: { id: number }) => row.id);
    if (userIds.length) {
      await tx.delete(sellerCredentials).where(inArray(sellerCredentials.userId, userIds));
      await tx.delete(userDashboardPreferences).where(inArray(userDashboardPreferences.userId, userIds));
    }
    if (productIds.length) await tx.delete(productPriceTiers).where(inArray(productPriceTiers.productId, productIds));
    if (purchaseOrderIds.length) await tx.delete(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, purchaseOrderIds));
    if (transferIds.length) await tx.delete(stockTransferItems).where(inArray(stockTransferItems.stockTransferId, transferIds));
    if (saleIds.length) {
      await tx.delete(salePayments).where(inArray(salePayments.saleId, saleIds));
      await tx.delete(saleCommissions).where(inArray(saleCommissions.saleId, saleIds));
      await tx.delete(saleItems).where(inArray(saleItems.saleId, saleIds));
    }
    if (groupIds.length) await tx.delete(paymentDueBeneficiaryGroupMembers).where(inArray(paymentDueBeneficiaryGroupMembers.groupId, groupIds));
    if (occurrenceIds.length) {
      await tx.delete(paymentDueReminderEvents).where(inArray(paymentDueReminderEvents.occurrenceId, occurrenceIds));
      await tx.delete(paymentDueSettlements).where(inArray(paymentDueSettlements.occurrenceId, occurrenceIds));
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
