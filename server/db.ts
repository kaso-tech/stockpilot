import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditLogs,
  InsertUser,
  products,
  productPriceTiers,
  stockMovements,
  suppliers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProducts() {
  const db = await getDb();
  if (!db) return [];
  const [rows, tiers] = await Promise.all([db.select().from(products).orderBy(products.name), db.select().from(productPriceTiers)]);
  return rows.map(product => {
    const productTiers = tiers.filter(tier => tier.productId === product.id).sort((left, right) => left.minQuantity - right.minQuantity);
    const retailPriceTiers = productTiers.filter(tier => tier.customerType === "retail");
    const wholesalePriceTiers = productTiers.filter(tier => tier.customerType === "wholesale");
    return { ...product, priceTiers: retailPriceTiers, retailPriceTiers, wholesalePriceTiers };
  });
}

export async function listSuppliers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function listMovements(limit = 100) {
  const db = await getDb();
  if (!db) return [];
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
    .orderBy(desc(stockMovements.occurredAt))
    .limit(limit);
}

export async function listAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
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
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.name);
}
