import { desc, eq, inArray, sql } from "drizzle-orm";
import mysql, { type Pool } from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import {
  auditLogs,
  products,
  productPriceTiers,
  stockMovements,
  suppliers,
  userSessions,
  users,
} from "../drizzle/schema";
import { companyScope } from "./companyScope";

let _db: MySql2Database & { $client: Pool } | null = null;

/**
 * Pool MySQL partagé (P5). Taille réglable par DB_POOL_SIZE ; connexions maintenues
 * actives pour éviter les coupures silencieuses derrière un équilibreur.
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: Number(process.env.DB_POOL_SIZE) || 10, waitForConnections: true, enableKeepAlive: true, keepAliveInitialDelay: 10_000, connectTimeout: 10_000 });
      _db = drizzle(pool);
    } catch (error) {
      console.error("[Database] Configuration de connexion invalide :", error instanceof Error ? error.message : error);
      _db = null;
    }
  }
  return _db;
}

/** Variante stricte pour les lectures : une base indisponible doit produire une erreur, jamais une liste vide trompeuse. */
async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  return db;
}

export async function pingDatabase() {
  const db = await getDb();
  if (!db) return false;
  try { await db.execute(sql`SELECT 1`); return true; } catch { return false; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserSessionById(sessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(userSessions).where(eq(userSessions.id, sessionId)).limit(1))[0];
}

export async function recordUserActivity(sessionId: string, userId: number, at = new Date()) {
  const db = await getDb();
  if (!db) return;
  await Promise.all([
    db.update(userSessions).set({ lastSeenAt: at }).where(eq(userSessions.id, sessionId)),
    db.update(users).set({ lastSignedIn: at }).where(eq(users.id, userId)), // tenant-scope-ok: utilisateur authentifié
  ]);
}

export async function listProducts(companyId: number | null) {
  const db = await requireDb();
  const rows = await db.select().from(products).where(companyScope(products.companyId, companyId)).orderBy(products.name);
  // Seuls les paliers des produits de l'entreprise sont chargés (P3), puis indexés par produit.
  const tiers = rows.length ? await db.select().from(productPriceTiers).where(inArray(productPriceTiers.productId, rows.map(product => product.id))) : [];
  const tiersByProduct = new Map<number, typeof tiers>();
  for (const tier of tiers) tiersByProduct.set(tier.productId, [...(tiersByProduct.get(tier.productId) ?? []), tier]);
  return rows.map(product => {
    const productTiers = (tiersByProduct.get(product.id) ?? []).sort((left, right) => left.minQuantity - right.minQuantity);
    const retailPriceTiers = productTiers.filter(tier => tier.customerType === "retail");
    const wholesalePriceTiers = productTiers.filter(tier => tier.customerType === "wholesale");
    return { ...product, priceTiers: retailPriceTiers, retailPriceTiers, wholesalePriceTiers };
  });
}

export async function listSuppliers(companyId: number | null) {
  const db = await requireDb();
  return db.select().from(suppliers).where(companyScope(suppliers.companyId, companyId)).orderBy(suppliers.name);
}

export async function listMovements(companyId: number | null, limit = 100) {
  const db = await requireDb();
  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      previousQuantity: stockMovements.previousQuantity,
      resultingQuantity: stockMovements.resultingQuantity,
      reason: stockMovements.reason,
      occurredAt: stockMovements.occurredAt,
      productId: products.id,
      supplierId: stockMovements.supplierId,
      productName: products.name,
      productReference: products.reference,
      supplierName: suppliers.name,
      operatorName: users.name,
    })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .leftJoin(suppliers, eq(stockMovements.supplierId, suppliers.id))
    .leftJoin(users, eq(stockMovements.createdByUserId, users.id))
    .where(companyScope(stockMovements.companyId, companyId))
    .orderBy(desc(stockMovements.occurredAt))
    .limit(limit);
}

export async function listAuditLogs(companyId: number | null, limit = 100) {
  const db = await requireDb();
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      detail: auditLogs.detail,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(companyScope(auditLogs.companyId, companyId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
