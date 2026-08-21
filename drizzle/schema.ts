import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "seller"]).default("seller").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sellerCredentials = mysqlTable("sellerCredentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  contactName: varchar("contactName", { length: 160 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  unit: varchar("unit", { length: 30 }).notNull().default("unité"),
  purchasePriceCents: int("purchasePriceCents").notNull().default(0),
  retailPriceCents: int("retailPriceCents").notNull().default(0),
  wholesalePriceCents: int("wholesalePriceCents").notNull().default(0),
  quantity: int("quantity").notNull().default(0),
  minimumQuantity: int("minimumQuantity").notNull().default(0),
  supplierId: int("supplierId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  type: mysqlEnum("type", ["ordinary", "wholesale"]).notNull().default("ordinary"),
  contactName: varchar("contactName", { length: 160 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  type: mysqlEnum("type", ["sales_agent", "cashier"]).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const remunerationProfiles = mysqlTable("remunerationProfiles", {
  id: int("id").autoincrement().primaryKey(),
  beneficiaryType: mysqlEnum("beneficiaryType", ["user", "agent"]).notNull(),
  beneficiaryId: int("beneficiaryId").notNull(),
  remunerationMode: mysqlEnum("remunerationMode", ["fixed", "commission", "fixed_plus_commission"]).notNull().default("commission"),
  fixedMonthlyCents: int("fixedMonthlyCents").notNull().default(0),
  commissionBasis: mysqlEnum("commissionBasis", ["revenue", "net_profit"]).notNull().default("revenue"),
  rateBasisPoints: int("rateBasisPoints").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const saleSettings = mysqlTable("saleSettings", {
  id: int("id").autoincrement().primaryKey(),
  defaultSalesAgentId: int("defaultSalesAgentId"),
  defaultCashierId: int("defaultCashierId"),
  requireSalesAgent: boolean("requireSalesAgent").notNull().default(false),
  requireCashier: boolean("requireCashier").notNull().default(false),
  currency: mysqlEnum("currency", ["USD", "EUR", "XOF"]).notNull().default("XOF"),
  companyName: varchar("companyName", { length: 200 }).notNull().default("StockPilot"),
  companyLogoUrl: text("companyLogoUrl"),
  companySignatureUrl: text("companySignatureUrl"),
  companySignatureLabel: varchar("companySignatureLabel", { length: 120 }).notNull().default("Signature & cachet"),
  companyAgreementLabel: varchar("companyAgreementLabel", { length: 120 }).notNull().default("Bon pour accord"),
  companySignatureAlignment: mysqlEnum("companySignatureAlignment", ["left", "center", "right"]).notNull().default("right"),
  companyAddress: text("companyAddress"),
  companyPhone: varchar("companyPhone", { length: 50 }),
  companyEmail: varchar("companyEmail", { length: 320 }),
  companyFooter: text("companyFooter"),
  ticketHeader: varchar("ticketHeader", { length: 160 }).notNull().default("Merci de votre achat"),
  ticketFooter: varchar("ticketFooter", { length: 240 }).notNull().default("À bientôt"),
  ticketWidthMm: mysqlEnum("ticketWidthMm", ["58", "80"]).notNull().default("80"),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 60 }).notNull().unique(),
  customerId: int("customerId").notNull(),
  sellerUserId: int("sellerUserId").notNull(),
  salesAgentId: int("salesAgentId"),
  cashierId: int("cashierId"),
  status: mysqlEnum("status", ["paid", "void"]).notNull().default("paid"),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "mobile_money", "bank_transfer", "credit"]).notNull().default("cash"),
  subtotalCents: int("subtotalCents").notNull(),
  totalCents: int("totalCents").notNull(),
  totalCostCents: int("totalCostCents").notNull(),
  netProfitCents: int("netProfitCents").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  voidedAt: timestamp("voidedAt"),
});

export const saleItems = mysqlTable("saleItems", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  productReference: varchar("productReference", { length: 80 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPriceCents: int("unitPriceCents").notNull(),
  purchasePriceCents: int("purchasePriceCents").notNull(),
  lineTotalCents: int("lineTotalCents").notNull(),
  lineCostCents: int("lineCostCents").notNull(),
});

export const saleCommissions = mysqlTable("saleCommissions", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  beneficiaryType: mysqlEnum("beneficiaryType", ["user", "agent"]).notNull(),
  beneficiaryId: int("beneficiaryId").notNull(),
  commissionBasis: mysqlEnum("commissionBasis", ["revenue", "net_profit"]).notNull(),
  rateBasisPoints: int("rateBasisPoints").notNull(),
  commissionCents: int("commissionCents").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const agentPayments = mysqlTable("agentPayments", {
  id: int("id").autoincrement().primaryKey(),
  beneficiaryType: mysqlEnum("beneficiaryType", ["user", "agent"]).notNull(),
  beneficiaryId: int("beneficiaryId").notNull(),
  amountCents: int("amountCents").notNull(),
  paidAt: timestamp("paidAt").defaultNow().notNull(),
  periodLabel: varchar("periodLabel", { length: 40 }),
  note: text("note"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const inventorySessions = mysqlTable("inventorySessions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["draft", "validated"]).notNull().default("draft"),
  createdByUserId: int("createdByUserId").notNull(),
  validatedByUserId: int("validatedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  validatedAt: timestamp("validatedAt"),
});

export const inventoryItems = mysqlTable("inventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  inventorySessionId: int("inventorySessionId").notNull(),
  productId: int("productId").notNull(),
  expectedQuantity: int("expectedQuantity").notNull(),
  countedQuantity: int("countedQuantity"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  supplierId: int("supplierId"),
  type: mysqlEnum("type", ["entry", "exit", "adjustment"]).notNull(),
  quantity: int("quantity").notNull(),
  previousQuantity: int("previousQuantity").notNull(),
  resultingQuantity: int("resultingQuantity").notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const stockAlerts = mysqlTable("stockAlerts", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().unique(),
  threshold: int("threshold").notNull(),
  observedQuantity: int("observedQuantity").notNull(),
  status: mysqlEnum("status", ["active", "resolved"]).notNull().default("active"),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const backupSettings = mysqlTable("backupSettings", {
  id: int("id").autoincrement().primaryKey(),
  automaticEnabled: boolean("automaticEnabled").notNull().default(true),
  frequencyHours: int("frequencyHours").notNull().default(24),
  retentionCount: int("retentionCount").notNull().default(14),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  scheduleNextAt: timestamp("scheduleNextAt"),
  googleDriveFolderId: varchar("googleDriveFolderId", { length: 180 }),
  googleDriveAccessTokenEncrypted: text("googleDriveAccessTokenEncrypted"),
  googleDriveRefreshTokenEncrypted: text("googleDriveRefreshTokenEncrypted"),
  googleDriveTokenExpiresAt: timestamp("googleDriveTokenExpiresAt"),
  googleDriveOauthState: varchar("googleDriveOauthState", { length: 120 }),
  lastBackupAt: timestamp("lastBackupAt"),
  lastBackupStatus: mysqlEnum("lastBackupStatus", ["idle", "success", "failed"]).notNull().default("idle"),
  lastBackupError: text("lastBackupError"),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const backupArchives = mysqlTable("backupArchives", {
  id: int("id").autoincrement().primaryKey(),
  filename: varchar("filename", { length: 220 }).notNull(),
  trigger: mysqlEnum("trigger", ["manual", "scheduled"]).notNull(),
  status: mysqlEnum("status", ["completed", "failed"]).notNull().default("completed"),
  storageKey: text("storageKey"),
  storageUrl: text("storageUrl"),
  sizeBytes: int("sizeBytes").notNull().default(0),
  recordCount: int("recordCount").notNull().default(0),
  googleDriveFileId: varchar("googleDriveFileId", { length: 180 }),
  googleDriveUrl: text("googleDriveUrl"),
  createdByUserId: int("createdByUserId"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
