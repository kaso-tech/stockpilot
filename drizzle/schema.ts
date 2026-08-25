import { boolean, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  ownerUserId: int("ownerUserId"),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  onboardingSkippedAt: timestamp("onboardingSkippedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "seller"]).default("seller").notNull(),
  active: boolean("active").notNull().default(true),
  companyId: int("companyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [index("users_company_active_idx").on(table.companyId, table.active)]);

export const userSessions = mysqlTable("userSessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  deviceLabel: varchar("deviceLabel", { length: 160 }).notNull(),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
}, table => [index("user_sessions_user_idx").on(table.userId)]);

export const userDashboardPreferences = mysqlTable("userDashboardPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  preferencesJson: text("preferencesJson").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Entrepôt de travail retenu par un administrateur dans une entreprise. */
export const userWarehousePreferences = mysqlTable("userWarehousePreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyId: int("companyId").notNull(),
  warehouseId: int("warehouseId").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("user_warehouse_preferences_user_company_unique").on(table.userId, table.companyId),
  index("user_warehouse_preferences_company_warehouse_idx").on(table.companyId, table.warehouseId),
]);

export const sellerCredentials = mysqlTable("sellerCredentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const adminFallbackPasswords = mysqlTable("adminFallbackPasswords", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 160 }).notNull().unique(),
  otherReference: varchar("otherReference", { length: 80 }),
  contactName: varchar("contactName", { length: 160 }),
  address: text("address"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  taxNumber: varchar("taxNumber", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchaseOrders = mysqlTable("purchaseOrders", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  orderNumber: varchar("orderNumber", { length: 60 }).notNull().unique(),
  supplierId: int("supplierId").notNull(),
  warehouseId: int("warehouseId"),
  status: mysqlEnum("status", ["draft", "sent", "received", "cancelled"]).notNull().default("draft"),
  subtotalCents: int("subtotalCents").notNull().default(0),
  vatRateBasisPoints: int("vatRateBasisPoints").notNull().default(0),
  vatCents: int("vatCents").notNull().default(0),
  deliveryFeeCents: int("deliveryFeeCents").notNull().default(0),
  totalCents: int("totalCents").notNull().default(0),
  notes: text("notes"),
  expectedDeliveryDate: timestamp("expectedDeliveryDate"),
  cancellationReason: text("cancellationReason"),
  cancelledAt: timestamp("cancelledAt"),
  receivedAt: timestamp("receivedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchaseOrderItems = mysqlTable("purchaseOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  productReference: varchar("productReference", { length: 80 }).notNull(),
  unit: varchar("unit", { length: 30 }).notNull(),
  quantity: int("quantity").notNull(),
  receivedQuantity: int("receivedQuantity").notNull().default(0),
  purchasePriceCents: int("purchasePriceCents").notNull(),
  lineTotalCents: int("lineTotalCents").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  reference: varchar("reference", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
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

/** Entrepôt physique ou point de stockage d'une entreprise. */
export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 40 }).notNull(),
  address: text("address"),
  active: boolean("active").notNull().default(true),
  isDefault: boolean("isDefault").notNull().default(false),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("warehouses_company_code_unique").on(table.companyId, table.code),
  index("warehouses_company_active_idx").on(table.companyId, table.active),
]);

/** Stock porté par un produit dans un entrepôt précis. */
export const warehouseStocks = mysqlTable("warehouseStocks", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  warehouseId: int("warehouseId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("warehouse_stocks_warehouse_product_unique").on(table.warehouseId, table.productId),
  index("warehouse_stocks_company_warehouse_idx").on(table.companyId, table.warehouseId),
  index("warehouse_stocks_company_product_idx").on(table.companyId, table.productId),
]);

/** Les transferts internes sont expédiés puis reçus dans une transaction distincte. */
export const stockTransfers = mysqlTable("stockTransfers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  transferNumber: varchar("transferNumber", { length: 60 }).notNull().unique(),
  sourceWarehouseId: int("sourceWarehouseId").notNull(),
  destinationWarehouseId: int("destinationWarehouseId").notNull(),
  status: mysqlEnum("status", ["draft", "in_transit", "received", "cancelled"]).notNull().default("draft"),
  notes: text("notes"),
  cancellationReason: text("cancellationReason"),
  createdByUserId: int("createdByUserId").notNull(),
  dispatchedByUserId: int("dispatchedByUserId"),
  receivedByUserId: int("receivedByUserId"),
  cancelledByUserId: int("cancelledByUserId"),
  dispatchedAt: timestamp("dispatchedAt"),
  receivedAt: timestamp("receivedAt"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("stock_transfers_company_status_idx").on(table.companyId, table.status),
  index("stock_transfers_company_created_idx").on(table.companyId, table.createdAt),
  index("stock_transfers_source_idx").on(table.sourceWarehouseId),
  index("stock_transfers_destination_idx").on(table.destinationWarehouseId),
]);

export const stockTransferItems = mysqlTable("stockTransferItems", {
  id: int("id").autoincrement().primaryKey(),
  stockTransferId: int("stockTransferId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  productReference: varchar("productReference", { length: 80 }).notNull(),
  unit: varchar("unit", { length: 30 }).notNull(),
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("stock_transfer_items_transfer_product_unique").on(table.stockTransferId, table.productId),
  index("stock_transfer_items_transfer_idx").on(table.stockTransferId),
]);

export const productPriceTiers = mysqlTable("productPriceTiers", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  customerType: mysqlEnum("customerType", ["retail", "wholesale"]).notNull().default("retail"),
  minQuantity: int("minQuantity").notNull(),
  unitPriceCents: int("unitPriceCents").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productCategories = mysqlTable("productCategories", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 100 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productUnits = mysqlTable("productUnits", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 30 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 180 }).notNull(),
  otherReference: varchar("otherReference", { length: 80 }),
  type: mysqlEnum("type", ["ordinary", "wholesale"]).notNull().default("ordinary"),
  contactName: varchar("contactName", { length: 160 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  taxNumber: varchar("taxNumber", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
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
  companyId: int("companyId"),
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
  companyId: int("companyId"),
  defaultSalesAgentId: int("defaultSalesAgentId"),
  defaultCashierId: int("defaultCashierId"),
  requireSalesAgent: boolean("requireSalesAgent").notNull().default(false),
  requireCashier: boolean("requireCashier").notNull().default(false),
  currency: mysqlEnum("currency", ["USD", "EUR", "XOF"]).notNull().default("XOF"),
  primaryColor: varchar("primaryColor", { length: 7 }).notNull().default("#007B8B"),
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
  printerName: varchar("printerName", { length: 120 }).notNull().default("Imprimante système"),
  printerType: mysqlEnum("printerType", ["browser", "thermal"]).notNull().default("browser"),
  invoiceTemplate: mysqlEnum("invoiceTemplate", ["classic", "modern", "minimal"]).notNull().default("classic"),
  invoiceShowLogo: boolean("invoiceShowLogo").notNull().default(true),
  invoiceShowSignature: boolean("invoiceShowSignature").notNull().default(true),
  invoiceShowPaymentDetails: boolean("invoiceShowPaymentDetails").notNull().default(true),
  invoiceShowDelivery: boolean("invoiceShowDelivery").notNull().default(true),
  paymentCashEnabled: boolean("paymentCashEnabled").notNull().default(true),
  paymentCardEnabled: boolean("paymentCardEnabled").notNull().default(true),
  paymentMobileMoneyEnabled: boolean("paymentMobileMoneyEnabled").notNull().default(true),
  paymentBankTransferEnabled: boolean("paymentBankTransferEnabled").notNull().default(true),
  paymentCreditEnabled: boolean("paymentCreditEnabled").notNull().default(true),
  sellerCanOverridePrice: boolean("sellerCanOverridePrice").notNull().default(false),
  sellerCanSellBelowPrice: boolean("sellerCanSellBelowPrice").notNull().default(false),
  sellerMaxDiscountPercent: int("sellerMaxDiscountPercent").notNull().default(0),
  sellerCanToggleVat: boolean("sellerCanToggleVat").notNull().default(false),
  sellerCanLineDiscount: boolean("sellerCanLineDiscount").notNull().default(false),
  sellerMaxLineDiscountPercent: int("sellerMaxLineDiscountPercent").notNull().default(0),
  sellerCanInvoiceDiscount: boolean("sellerCanInvoiceDiscount").notNull().default(false),
  sellerMaxInvoiceDiscountPercent: int("sellerMaxInvoiceDiscountPercent").notNull().default(0),
  sellerCanCartDiscount: boolean("sellerCanCartDiscount").notNull().default(false),
  sellerMaxCartDiscountPercent: int("sellerMaxCartDiscountPercent").notNull().default(0),
  sellerCanEditInvoiceItemPrice: boolean("sellerCanEditInvoiceItemPrice").notNull().default(false),
  sellerMaxInvoiceItemPriceChangePercent: int("sellerMaxInvoiceItemPriceChangePercent").notNull().default(0),
  sellerCanEditCartItemPrice: boolean("sellerCanEditCartItemPrice").notNull().default(false),
  sellerMaxCartItemPriceChangePercent: int("sellerMaxCartItemPriceChangePercent").notNull().default(0),
  sellerCanCancelInvoice: boolean("sellerCanCancelInvoice").notNull().default(false),
  sellerCanRefund: boolean("sellerCanRefund").notNull().default(false),
  sellerCanCorrectStock: boolean("sellerCanCorrectStock").notNull().default(false),
  sellerCanEditPurchasePrice: boolean("sellerCanEditPurchasePrice").notNull().default(false),
  vatEnabled: boolean("vatEnabled").notNull().default(false),
  vatRateBasisPoints: int("vatRateBasisPoints").notNull().default(0),
  defaultDeliveryFeeCents: int("defaultDeliveryFeeCents").notNull().default(0),
  customerSuggestionsEnabled: boolean("customerSuggestionsEnabled").notNull().default(true),
  customerSuggestionsLimit: int("customerSuggestionsLimit").notNull().default(4),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const vatRatePresets = mysqlTable("vatRatePresets", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  rateBasisPoints: int("rateBasisPoints").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("vat_rate_presets_company_rate_idx").on(table.companyId, table.rateBasisPoints)]);

export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  invoiceNumber: varchar("invoiceNumber", { length: 60 }).notNull().unique(),
  offlineOperationId: varchar("offlineOperationId", { length: 80 }).unique(),
  channel: mysqlEnum("channel", ["pos", "invoice", "quote"]).notNull().default("invoice"),
  customerId: int("customerId"),
  warehouseId: int("warehouseId"),
  sellerUserId: int("sellerUserId").notNull(),
  salesAgentId: int("salesAgentId"),
  cashierId: int("cashierId"),
  status: mysqlEnum("status", ["draft", "partial", "paid", "void"]).notNull().default("draft"),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "card", "mobile_money", "bank_transfer", "credit"]).notNull().default("cash"),
  amountPaidCents: int("amountPaidCents").notNull().default(0),
  subtotalCents: int("subtotalCents").notNull(),
  vatRateBasisPoints: int("vatRateBasisPoints").notNull().default(0),
  vatCents: int("vatCents").notNull().default(0),
  deliveryFeeCents: int("deliveryFeeCents").notNull().default(0),
  invoiceDiscountType: mysqlEnum("invoiceDiscountType", ["none", "percent", "fixed"]).notNull().default("none"),
  invoiceDiscountValue: int("invoiceDiscountValue").notNull().default(0),
  invoiceDiscountCents: int("invoiceDiscountCents").notNull().default(0),
  totalCents: int("totalCents").notNull(),
  totalCostCents: int("totalCostCents").notNull(),
  netProfitCents: int("netProfitCents").notNull(),
  note: text("note"),
  deliveryAddress: text("deliveryAddress"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  voidedAt: timestamp("voidedAt"),
}, table => [index("sales_company_created_idx").on(table.companyId, table.createdAt), index("sales_company_status_idx").on(table.companyId, table.status), index("sales_offline_user_idx").on(table.offlineOperationId, table.sellerUserId)]);

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  warehouseId: int("warehouseId"),
  category: mysqlEnum("category", ["rent", "energy", "connection", "salary", "marketing", "supplies", "taxes", "other"]).notNull(),
  description: varchar("description", { length: 300 }).notNull(),
  amountCents: int("amountCents").notNull(),
  spentAt: timestamp("spentAt").notNull().defaultNow(),
  receiptUrl: text("receiptUrl"),
  receiptName: varchar("receiptName", { length: 180 }),
  receiptMimeType: varchar("receiptMimeType", { length: 80 }),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("expenses_company_warehouse_spent_idx").on(table.companyId, table.warehouseId, table.spentAt)]);

export const expenseBudgets = mysqlTable("expenseBudgets", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  warehouseId: int("warehouseId"),
  yearMonth: varchar("yearMonth", { length: 7 }).notNull(),
  amountCents: int("amountCents").notNull(),
  warningPercent: int("warningPercent").notNull().default(80),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("expense_budgets_company_warehouse_month_unique").on(table.companyId, table.warehouseId, table.yearMonth)]);

export const salePayments = mysqlTable("salePayments", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  offlineOperationId: varchar("offlineOperationId", { length: 80 }).unique(),
  method: mysqlEnum("method", ["cash", "card", "mobile_money", "bank_transfer", "credit"]).notNull(),
  amountCents: int("amountCents").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("sale_payments_sale_idx").on(table.saleId), index("sale_payments_offline_idx").on(table.offlineOperationId)]);

export const saleItems = mysqlTable("saleItems", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 200 }).notNull(),
  productReference: varchar("productReference", { length: 80 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPriceCents: int("unitPriceCents").notNull(),
  purchasePriceCents: int("purchasePriceCents").notNull(),
  discountType: mysqlEnum("discountType", ["none", "percent", "fixed"]).notNull().default("none"),
  discountValue: int("discountValue").notNull().default(0),
  discountCents: int("discountCents").notNull().default(0),
  lineSubtotalCents: int("lineSubtotalCents").notNull().default(0),
  lineTotalCents: int("lineTotalCents").notNull(),
  lineCostCents: int("lineCostCents").notNull(),
}, table => [index("sale_items_sale_idx").on(table.saleId), index("sale_items_product_idx").on(table.productId)]);

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
  companyId: int("companyId"),
  warehouseId: int("warehouseId"),
  beneficiaryType: mysqlEnum("beneficiaryType", ["user", "agent"]).notNull(),
  beneficiaryId: int("beneficiaryId").notNull(),
  amountCents: int("amountCents").notNull(),
  paidAt: timestamp("paidAt").defaultNow().notNull(),
  periodLabel: varchar("periodLabel", { length: 40 }),
  note: text("note"),
  receiptUrl: varchar("receiptUrl", { length: 1024 }),
  receiptName: varchar("receiptName", { length: 180 }),
  receiptMimeType: varchar("receiptMimeType", { length: 80 }),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("agent_payments_company_warehouse_paid_idx").on(table.companyId, table.warehouseId, table.paidAt)]);

export const inventorySessions = mysqlTable("inventorySessions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 160 }).notNull(),
  warehouseId: int("warehouseId"),
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
  companyId: int("companyId"),
  productId: int("productId").notNull(),
  warehouseId: int("warehouseId"),
  supplierId: int("supplierId"),
  type: mysqlEnum("type", ["entry", "exit", "adjustment"]).notNull(),
  quantity: int("quantity").notNull(),
  previousQuantity: int("previousQuantity").notNull(),
  resultingQuantity: int("resultingQuantity").notNull(),
  reason: varchar("reason", { length: 255 }).notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("stock_movements_company_product_idx").on(table.companyId, table.productId), index("stock_movements_company_occurred_idx").on(table.companyId, table.occurredAt)]);

export const stockAlerts = mysqlTable("stockAlerts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
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
  companyId: int("companyId"),
  actorUserId: int("actorUserId").notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_logs_company_created_idx").on(table.companyId, table.createdAt), index("audit_logs_company_entity_idx").on(table.companyId, table.entityType, table.entityId)]);

export const backupSettings = mysqlTable("backupSettings", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
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
  companyId: int("companyId"),
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
