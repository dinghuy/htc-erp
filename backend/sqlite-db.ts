import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { normalizeGender } from './gender';

let db: Database;
let dbInitialized = false;

export async function initDb() {
  if (dbInitialized && db) {
    return;
  }

  const envPath = process.env.DB_PATH?.trim();
  const dbPath = envPath ? path.resolve(envPath) : path.join(__dirname, 'crm.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    throw new Error(`DB_PATH directory does not exist: ${dbDir}`);
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.run('PRAGMA foreign_keys = ON');
  await db.run('PRAGMA journal_mode = WAL');

  // ========== CREATE TABLES ==========

  // 1. Account (Dùng chung cho Customer và Supplier)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Account (
      id TEXT PRIMARY KEY,
      companyName TEXT,
      region TEXT,
      industry TEXT,
      website TEXT,
      taxCode TEXT,
      address TEXT,
      assignedTo TEXT,
      status TEXT,
      accountType TEXT DEFAULT 'Customer',
      code TEXT,
      shortName TEXT,
      description TEXT,
      tag TEXT,
      country TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assignedTo) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // 2. Contact
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Contact (
      id TEXT PRIMARY KEY,
      accountId TEXT,
      lastName TEXT,
      firstName TEXT,
      department TEXT,
      jobTitle TEXT,
      gender TEXT,
      email TEXT,
      phone TEXT,
      isPrimaryContact INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE CASCADE
    )
  `);

  // 3. Lead
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Lead (
      id TEXT PRIMARY KEY,
      companyName TEXT,
      contactName TEXT,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'New',
      source TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Product
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Product (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE,
      name TEXT,
      category TEXT,
      unit TEXT DEFAULT 'Chiếc',
      basePrice REAL,
      currency TEXT DEFAULT 'USD',
      specifications TEXT,
      technicalSpecs TEXT,
      media TEXT,
      qbuData TEXT,
      qbuUpdatedAt DATETIME,
      status TEXT DEFAULT 'available',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4b. ExchangeRate
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ExchangeRate (
      id TEXT PRIMARY KEY,
      baseCurrency TEXT NOT NULL,
      quoteCurrency TEXT NOT NULL,
      effectiveDate TEXT NOT NULL,
      rateValue REAL NOT NULL,
      source TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_exrate_pair_date
    ON ExchangeRate (baseCurrency, quoteCurrency, effectiveDate)
  `);

  // 11. Project
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Project (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      managerId TEXT,
      accountId TEXT,
      projectStage TEXT DEFAULT 'new',
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (managerId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // 12. Task
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Task (
      id TEXT PRIMARY KEY,
      projectId TEXT,
      name TEXT NOT NULL,
      description TEXT,
      assigneeId TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      startDate TEXT,
      dueDate TEXT,
      completionPct INTEGER DEFAULT 0,
      notes TEXT,
      accountId TEXT,
      leadId TEXT,
      quotationId TEXT,
      taskType TEXT,
      department TEXT,
      blockedReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY (assigneeId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // ========== INDEXES ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS SupplierQuote (
      id TEXT PRIMARY KEY,
      supplierId TEXT,
      projectId TEXT,
      linkedQuotationId TEXT,
      category TEXT,
      quoteDate DATETIME,
      validUntil DATETIME,
      items TEXT,
      attachments TEXT,
      changeReason TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplierId) REFERENCES Account(id) ON DELETE CASCADE,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE SET NULL,
      FOREIGN KEY(linkedQuotationId) REFERENCES Quotation(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Quotation (
      id TEXT PRIMARY KEY,
      quoteNumber TEXT UNIQUE,
      quoteDate TEXT,
      subject TEXT,
      accountId TEXT,
      contactId TEXT,
      projectId TEXT,
      salesperson TEXT,
      salespersonPhone TEXT,
      currency TEXT DEFAULT 'VND',
      opportunityId TEXT,
      revisionNo INTEGER DEFAULT 1,
      revisionLabel TEXT,
      parentQuotationId TEXT,
      changeReason TEXT,
      isWinningVersion INTEGER DEFAULT 0,
      items TEXT,
      financialParams TEXT,
      terms TEXT,
      subtotal REAL,
      taxTotal REAL,
      grandTotal REAL,
      status TEXT DEFAULT 'draft',
      validUntil DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE SET NULL,
      FOREIGN KEY(contactId) REFERENCES Contact(id) ON DELETE SET NULL,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE SET NULL,
      FOREIGN KEY(parentQuotationId) REFERENCES Quotation(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Activity (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      category TEXT,
      icon TEXT,
      color TEXT,
      iconColor TEXT,
      entityId TEXT,
      entityType TEXT,
      link TEXT,
      actorUserId TEXT,
      actorRoles TEXT,
      actingCapability TEXT,
      action TEXT,
      timestamp TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ApprovalRequest (
      id TEXT PRIMARY KEY,
      projectId TEXT,
      quotationId TEXT,
      pricingQuotationId TEXT,
      requestType TEXT,
      title TEXT,
      department TEXT,
      requestedBy TEXT,
      approverRole TEXT,
      approverUserId TEXT,
      status TEXT DEFAULT 'pending',
      dueDate TEXT,
      note TEXT,
      decidedAt TEXT,
      decidedBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY(approverUserId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectDocument (
      id TEXT PRIMARY KEY,
      projectId TEXT,
      quotationId TEXT,
      documentCode TEXT,
      documentName TEXT,
      category TEXT,
      department TEXT,
      status TEXT DEFAULT 'missing',
      requiredAtStage TEXT,
      note TEXT,
      receivedAt TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectContract (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      quotationId TEXT,
      contractNumber TEXT,
      title TEXT,
      signedDate TEXT,
      effectiveDate TEXT,
      status TEXT DEFAULT 'draft',
      currency TEXT DEFAULT 'VND',
      totalValue REAL DEFAULT 0,
      summary TEXT,
      lineItems TEXT DEFAULT '[]',
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectContractAppendix (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      contractId TEXT NOT NULL,
      appendixNumber TEXT,
      title TEXT,
      signedDate TEXT,
      effectiveDate TEXT,
      status TEXT DEFAULT 'draft',
      totalDeltaValue REAL DEFAULT 0,
      summary TEXT,
      lineItems TEXT DEFAULT '[]',
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(contractId) REFERENCES ProjectContract(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectExecutionBaseline (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      baselineNo INTEGER DEFAULT 1,
      title TEXT,
      effectiveDate TEXT,
      currency TEXT DEFAULT 'VND',
      totalValue REAL DEFAULT 0,
      lineItems TEXT DEFAULT '[]',
      isCurrent INTEGER DEFAULT 0,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectProcurementLine (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      baselineId TEXT,
      sourceLineKey TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      supersededAt TEXT,
      supersededByBaselineId TEXT,
      itemCode TEXT,
      itemName TEXT,
      description TEXT,
      unit TEXT,
      contractQty REAL DEFAULT 0,
      orderedQty REAL DEFAULT 0,
      receivedQty REAL DEFAULT 0,
      deliveredQty REAL DEFAULT 0,
      shortageQty REAL DEFAULT 0,
      shortageStatus TEXT DEFAULT 'pending',
      supplierId TEXT,
      poNumber TEXT,
      etaDate TEXT,
      committedDeliveryDate TEXT,
      actualReceivedDate TEXT,
      actualDeliveryDate TEXT,
      status TEXT DEFAULT 'planned',
      note TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(baselineId) REFERENCES ProjectExecutionBaseline(id) ON DELETE SET NULL,
      FOREIGN KEY(supplierId) REFERENCES Account(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectInboundLine (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      procurementLineId TEXT NOT NULL,
      baselineId TEXT,
      sourceLineKey TEXT,
      receivedQty REAL DEFAULT 0,
      etaDate TEXT,
      actualReceivedDate TEXT,
      status TEXT DEFAULT 'pending',
      receiptRef TEXT,
      note TEXT,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(procurementLineId) REFERENCES ProjectProcurementLine(id) ON DELETE CASCADE,
      FOREIGN KEY(baselineId) REFERENCES ProjectExecutionBaseline(id) ON DELETE SET NULL,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectDeliveryLine (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      procurementLineId TEXT NOT NULL,
      baselineId TEXT,
      sourceLineKey TEXT,
      deliveredQty REAL DEFAULT 0,
      committedDate TEXT,
      actualDeliveryDate TEXT,
      status TEXT DEFAULT 'pending',
      deliveryRef TEXT,
      note TEXT,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(procurementLineId) REFERENCES ProjectProcurementLine(id) ON DELETE CASCADE,
      FOREIGN KEY(baselineId) REFERENCES ProjectExecutionBaseline(id) ON DELETE SET NULL,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectMilestone (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      milestoneType TEXT,
      title TEXT NOT NULL,
      plannedDate TEXT,
      actualDate TEXT,
      status TEXT DEFAULT 'pending',
      note TEXT,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectTimelineEvent (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      eventType TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      eventDate TEXT,
      entityType TEXT,
      entityId TEXT,
      payload TEXT,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_account_type ON Account (accountType);
    CREATE INDEX IF NOT EXISTS idx_account_status ON Account (status);
    CREATE INDEX IF NOT EXISTS idx_contact_account ON Contact (accountId);
    CREATE INDEX IF NOT EXISTS idx_lead_status ON Lead (status);
    CREATE INDEX IF NOT EXISTS idx_lead_source ON Lead (source);
    CREATE INDEX IF NOT EXISTS idx_product_category ON Product (category);
    CREATE INDEX IF NOT EXISTS idx_product_status ON Product (status);
    CREATE INDEX IF NOT EXISTS idx_quotation_status ON Quotation (status);
    CREATE INDEX IF NOT EXISTS idx_quotation_account ON Quotation (accountId);
    CREATE INDEX IF NOT EXISTS idx_quotation_date ON Quotation (quoteDate);
    CREATE INDEX IF NOT EXISTS idx_supplierquote_supplier ON SupplierQuote (supplierId);
    CREATE INDEX IF NOT EXISTS idx_supplierquote_status ON SupplierQuote (status);
    CREATE INDEX IF NOT EXISTS idx_activity_entity ON Activity (entityId, entityType);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON Activity (createdAt);
    CREATE INDEX IF NOT EXISTS idx_project_status ON Project (status);
    CREATE INDEX IF NOT EXISTS idx_project_account ON Project (accountId);
    CREATE INDEX IF NOT EXISTS idx_project_start_date ON Project (startDate);
    CREATE INDEX IF NOT EXISTS idx_project_end_date ON Project (endDate);
    CREATE INDEX IF NOT EXISTS idx_task_project ON Task (projectId);
    CREATE INDEX IF NOT EXISTS idx_task_assignee ON Task (assigneeId);
    CREATE INDEX IF NOT EXISTS idx_task_status ON Task (status);
    CREATE INDEX IF NOT EXISTS idx_task_account ON Task (accountId);
    CREATE INDEX IF NOT EXISTS idx_task_start_date ON Task (startDate);
    CREATE INDEX IF NOT EXISTS idx_task_due_date ON Task (dueDate);
    CREATE INDEX IF NOT EXISTS idx_project_contract_project ON ProjectContract (projectId, effectiveDate);
    CREATE INDEX IF NOT EXISTS idx_project_appendix_project ON ProjectContractAppendix (projectId, contractId, effectiveDate);
    CREATE INDEX IF NOT EXISTS idx_project_baseline_project ON ProjectExecutionBaseline (projectId, isCurrent, baselineNo);
    CREATE INDEX IF NOT EXISTS idx_project_procurement_project ON ProjectProcurementLine (projectId, sourceLineKey);
    CREATE INDEX IF NOT EXISTS idx_project_inbound_project ON ProjectInboundLine (projectId, procurementLineId);
    CREATE INDEX IF NOT EXISTS idx_project_delivery_project ON ProjectDeliveryLine (projectId, procurementLineId);
    CREATE INDEX IF NOT EXISTS idx_project_milestone_project ON ProjectMilestone (projectId, plannedDate, actualDate);
    CREATE INDEX IF NOT EXISTS idx_project_timeline_project ON ProjectTimelineEvent (projectId, createdAt);
  `);

  // 5. SupplierQuote
  await db.exec(`
    CREATE TABLE IF NOT EXISTS SupplierQuote (
      id TEXT PRIMARY KEY,
      supplierId TEXT,
      category TEXT,
      quoteDate DATETIME,
      validUntil DATETIME,
      items TEXT,
      attachments TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplierId) REFERENCES Account(id) ON DELETE CASCADE
    )
  `);

  // 6. Quotation (Báo giá đầu ra)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Quotation (
      id TEXT PRIMARY KEY,
      quoteNumber TEXT UNIQUE,
      quoteDate TEXT,
      subject TEXT,
      accountId TEXT,
      contactId TEXT,
      salesperson TEXT,
      salespersonPhone TEXT,
      currency TEXT DEFAULT 'VND',
      opportunityId TEXT,
      items TEXT,
      financialParams TEXT,
      terms TEXT,
      subtotal REAL,
      taxTotal REAL,
      grandTotal REAL,
      status TEXT DEFAULT 'draft',
      validUntil DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE SET NULL,
      FOREIGN KEY(contactId) REFERENCES Contact(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PricingQuotation (
      id TEXT PRIMARY KEY,
      projectId TEXT,
      projectCode TEXT,
      customerName TEXT,
      supplierName TEXT,
      salePerson TEXT,
      changeReason TEXT,
      qbuType TEXT DEFAULT 'INITIAL',
      parentPricingQuotationId TEXT,
      batchNo INTEGER DEFAULT 0,
      qbuWorkflowStage TEXT DEFAULT 'draft',
      qbuSubmittedAt TEXT,
      qbuSubmittedBy TEXT,
      qbuCompletedAt TEXT,
      date TEXT,
      vatRate REAL DEFAULT 0.08,
      discountRate REAL DEFAULT 0,
      citRate REAL DEFAULT 0.2,
      tpcType TEXT,
      tpcRate REAL DEFAULT 0,
      sellFxRate REAL DEFAULT 25500,
      buyFxRate REAL DEFAULT 26300,
      loanInterestDays INTEGER DEFAULT 240,
      loanInterestRate REAL DEFAULT 0.08,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      ,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE SET NULL,
      FOREIGN KEY(parentPricingQuotationId) REFERENCES PricingQuotation(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PricingLineItem (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      section TEXT NOT NULL,
      description TEXT,
      quantityLabel TEXT,
      unitCount INTEGER DEFAULT 1,
      costRoutingType TEXT,
      sellUnitPriceVnd REAL,
      buyUnitPriceVnd REAL,
      buyUnitPriceUsd REAL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quotationId) REFERENCES PricingQuotation(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PricingRentalConfig (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL UNIQUE,
      investmentQty INTEGER DEFAULT 2,
      depreciationMonths INTEGER DEFAULT 60,
      stlPct REAL DEFAULT 0.3,
      stlPeriodMonths INTEGER DEFAULT 24,
      stlRate REAL DEFAULT 0.09,
      stlRateChange REAL DEFAULT 0.05,
      ltlPeriodMonths INTEGER DEFAULT 60,
      ltlRate REAL DEFAULT 0.12,
      ltlRateChange REAL DEFAULT 0.03,
      rentPeriodMonths INTEGER DEFAULT 60,
      downpaymentMonths INTEGER DEFAULT 3,
      paymentDelayDays INTEGER DEFAULT 30,
      expectedProfitPct REAL DEFAULT 0.185,
      contingencyPct REAL DEFAULT 0.03,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quotationId) REFERENCES PricingQuotation(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PricingOperationConfig (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL UNIQUE,
      workingDaysMonth INTEGER DEFAULT 30,
      dailyHours REAL DEFAULT 20,
      movesPerDay REAL DEFAULT 70,
      kmPerMove REAL DEFAULT 1,
      electricityPriceVnd REAL DEFAULT 3000,
      kwhPerKm REAL DEFAULT 2.3,
      driversPerUnit REAL DEFAULT 2,
      driverSalaryVnd REAL DEFAULT 20000000,
      insuranceRate REAL DEFAULT 0.225,
      pmIntervalsHours TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quotationId) REFERENCES PricingQuotation(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PricingMaintenancePart (
      id TEXT PRIMARY KEY,
      quotationId TEXT NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      systemName TEXT,
      itemDescription TEXT,
      modelSpec TEXT,
      unit TEXT,
      qty REAL DEFAULT 0,
      unitPriceVnd REAL DEFAULT 0,
      level500h INTEGER DEFAULT 0,
      level1000h INTEGER DEFAULT 0,
      level2000h INTEGER DEFAULT 0,
      level3000h INTEGER DEFAULT 0,
      level4000h INTEGER DEFAULT 0,
      note TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quotationId) REFERENCES PricingQuotation(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pricing_lineitem_quote ON PricingLineItem (quotationId, sortOrder);
    CREATE INDEX IF NOT EXISTS idx_pricing_rental_quote ON PricingRentalConfig (quotationId);
    CREATE INDEX IF NOT EXISTS idx_pricing_operation_quote ON PricingOperationConfig (quotationId);
    CREATE INDEX IF NOT EXISTS idx_pricing_maintenance_quote ON PricingMaintenancePart (quotationId, sortOrder);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PricingCostEntry (
      id TEXT PRIMARY KEY,
      pricingQuotationId TEXT NOT NULL,
      lineItemId TEXT,
      entryType TEXT NOT NULL,
      amountVnd REAL DEFAULT 0,
      quantity REAL DEFAULT 1,
      note TEXT,
      recordedAt TEXT,
      recordedBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(pricingQuotationId) REFERENCES PricingQuotation(id) ON DELETE CASCADE,
      FOREIGN KEY(lineItemId) REFERENCES PricingLineItem(id) ON DELETE SET NULL
    )
  `);
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pricing_costentry_quote ON PricingCostEntry (pricingQuotationId, entryType, createdAt);
    CREATE INDEX IF NOT EXISTS idx_pricing_costentry_line ON PricingCostEntry (lineItemId, entryType);
  `);

  // 6b. SalesOrder (ERP core - minimal)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS SalesOrder (
      id TEXT PRIMARY KEY,
      orderNumber TEXT,
      quotationId TEXT UNIQUE,
      accountId TEXT,
      status TEXT DEFAULT 'draft',
      currency TEXT,
      items TEXT,
      subtotal REAL,
      taxTotal REAL,
      grandTotal REAL,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE CASCADE
    )
  `);

  // 7. SalesPerson (Phụ lục)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS SalesPerson (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. User (Nhân viên HTG)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      fullName TEXT,
      gender TEXT,
      email TEXT,
      phone TEXT,
      role TEXT,
      department TEXT,
      status TEXT DEFAULT 'Active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8b. ChatMessage
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ChatMessage (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      content TEXT NOT NULL,
      readAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  // 8c. Notification
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Notification (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      content TEXT NOT NULL,
      entityType TEXT,
      entityId TEXT,
      link TEXT,
      readAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  // 8d. SupportTicket
  await db.exec(`
    CREATE TABLE IF NOT EXISTS SupportTicket (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      responseNote TEXT,
      createdBy TEXT NOT NULL,
      updatedBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY(updatedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // 8d. ErpOutbox (reliable ERP sync queue)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ErpOutbox (
      id TEXT PRIMARY KEY,
      dedupeKey TEXT NOT NULL,
      eventType TEXT NOT NULL,
      entityType TEXT,
      entityId TEXT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT,
      nextRunAt DATETIME,
      sentAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chatmessage_user_created ON ChatMessage (userId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_chatmessage_created ON ChatMessage (createdAt);
    CREATE INDEX IF NOT EXISTS idx_notification_user_read_created ON Notification (userId, readAt, createdAt);
    CREATE INDEX IF NOT EXISTS idx_notification_user_created ON Notification (userId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_supportticket_createdby_created ON SupportTicket (createdBy, createdAt);
    CREATE INDEX IF NOT EXISTS idx_supportticket_status_created ON SupportTicket (status, createdAt);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_erpoutbox_dedupe ON ErpOutbox (dedupeKey);
    CREATE INDEX IF NOT EXISTS idx_erpoutbox_status_next ON ErpOutbox (status, nextRunAt, createdAt);
    CREATE INDEX IF NOT EXISTS idx_salesorder_created ON SalesOrder (createdAt);
    CREATE INDEX IF NOT EXISTS idx_salesorder_status ON SalesOrder (status, updatedAt);
  `);

  // 9. Activity (Ghi log event)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Activity (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      category TEXT,
      icon TEXT,
      color TEXT,
      iconColor TEXT,
      entityId TEXT,
      entityType TEXT,
      link TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 10. SystemSetting (Cấu hình hệ thống)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS SystemSetting (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  const ensureColumn = async (table: string, column: string, ddl: string) => {
    const cols = await db.all(`PRAGMA table_info('${table}')`);
    if (!cols.some((c: any) => c.name === column)) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  };

  const canonicalizeGenderColumn = async (table: string, idColumn: string) => {
    if (!(await tableExists(table)) || !(await columnExists(table, 'gender'))) return;

    const rows = await db.all(`SELECT ${idColumn} as id, gender FROM ${table}`);
    for (const row of rows) {
      const next = normalizeGender(row.gender);
      if (row.gender !== next) {
        await db.run(`UPDATE ${table} SET gender = ? WHERE ${idColumn} = ?`, [next, row.id]);
      }
    }
  };

  const normalizeLegacyProductStructuredFields = async () => {
    if (!(await tableExists('Product'))) return;

    const rows = await db.all('SELECT id, specifications, media, qbuData FROM Product');
    for (const row of rows) {
      const updates: string[] = [];
      const params: any[] = [];

      const normalizeObjectString = (raw: unknown, fallback: Record<string, unknown>) => {
        if (typeof raw !== 'string' || !raw.trim()) {
          return JSON.stringify(fallback);
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return JSON.stringify(parsed);
          }
        } catch {
          // fall through to legacy handling
        }
        return JSON.stringify({ text: String(raw).trim() });
      };

      const normalizeArrayString = (raw: unknown) => {
        if (typeof raw !== 'string' || !raw.trim()) {
          return JSON.stringify([]);
        }
        try {
          const parsed = JSON.parse(raw);
          return JSON.stringify(Array.isArray(parsed) ? parsed : []);
        } catch {
          return JSON.stringify([]);
        }
      };

      const nextSpecifications = normalizeObjectString(row.specifications, {});
      const nextMedia = normalizeArrayString(row.media);
      const nextQbuData = normalizeObjectString(row.qbuData, {});

      if ((row.specifications ?? null) !== nextSpecifications) {
        updates.push('specifications = ?');
        params.push(nextSpecifications);
      }
      if ((row.media ?? null) !== nextMedia) {
        updates.push('media = ?');
        params.push(nextMedia);
      }
      if ((row.qbuData ?? null) !== nextQbuData) {
        updates.push('qbuData = ?');
        params.push(nextQbuData);
      }

      if (updates.length) {
        params.push(row.id);
        await db.run(`UPDATE Product SET ${updates.join(', ')} WHERE id = ?`, params);
      }
    }
  };

  const tableExists = async (table: string) => {
    const row = await db.get(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      [table]
    );
    return !!row?.name;
  };

  const columnExists = async (table: string, column: string) => {
    const cols = await db.all(`PRAGMA table_info('${table}')`);
    return cols.some((c: any) => c.name === column);
  };

  const migrateLegacySupplierTable = async () => {
    if (!(await tableExists('Supplier'))) return;

    const cols = await db.all(`PRAGMA table_info('Supplier')`);
    const has = (name: string) => cols.some((c: any) => c.name === name);

    const count = await db.get('SELECT COUNT(*) as c FROM Supplier');
    if (count?.c > 0) {
      const companyExpr = has('company') ? 'company' : 'NULL';
      const codeExpr = has('code') ? 'code' : 'NULL';
      const descExpr = has('description') ? 'description' : 'NULL';
      const tagExpr = has('tag') ? 'tag' : 'NULL';
      const countryExpr = has('country') ? 'country' : 'NULL';
      const statusExpr = has('status') ? 'status' : 'NULL';

      await db.exec(`
        INSERT INTO Account (id, companyName, code, description, tag, country, status, accountType)
        SELECT id, ${companyExpr}, ${codeExpr}, ${descExpr}, ${tagExpr}, ${countryExpr}, ${statusExpr}, 'Supplier'
        FROM Supplier
        WHERE id IS NOT NULL
        ON CONFLICT(id) DO NOTHING
      `);
    }

    await db.exec('DROP TABLE IF EXISTS Supplier');
    console.log('[DB] Legacy Supplier table migrated into Account and dropped.');
  };

  const ensureUniqueIndexIfNoDuplicates = async (table: string, column: string, indexName: string) => {
    const dupes = await db.all(
      `SELECT ${column} as value, COUNT(*) as c
       FROM ${table}
       WHERE ${column} IS NOT NULL AND TRIM(${column}) <> ''
       GROUP BY ${column}
       HAVING c > 1`
    );
    if (dupes.length) {
      console.warn(`[DB] Skip unique index ${indexName}: duplicates found in ${table}.${column}.`);
      return;
    }
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table} (${column})`);
  };

  const nullifyInvalidRefs = async (table: string, column: string, refTable: string, refColumn: string) => {
    if (!(await columnExists(table, column))) return;

    await db.exec(`UPDATE ${table} SET ${column} = NULL WHERE ${column} IS NOT NULL AND TRIM(${column}) = ''`);
    const invalid = await db.all(
      `SELECT DISTINCT ${column} as value
       FROM ${table}
       WHERE ${column} IS NOT NULL
         AND ${column} NOT IN (SELECT ${refColumn} FROM ${refTable})`
    );
    if (invalid.length) {
      await db.exec(
        `UPDATE ${table}
         SET ${column} = NULL
         WHERE ${column} IS NOT NULL
           AND ${column} NOT IN (SELECT ${refColumn} FROM ${refTable})`
      );
      console.warn(`[DB] Cleared ${invalid.length} invalid references in ${table}.${column}.`);
    }
  };

  type ForeignKeyDef = {
    from: string;
    toTable: string;
    toColumn: string;
    onDelete?: string;
  };

  const normalizeFkAction = (value: any) => String(value || '').trim().toUpperCase();

  const shouldRebuildForFks = async (table: string, expected: ForeignKeyDef[]) => {
    const rows = await db.all(`PRAGMA foreign_key_list('${table}')`);
    if (!rows.length && expected.length) return true;
    return expected.some((fk) => {
      const match = rows.find((r: any) => r.from === fk.from && r.table === fk.toTable && r.to === fk.toColumn);
      if (!match) return true;
      return normalizeFkAction(match.on_delete) !== normalizeFkAction(fk.onDelete || '');
    });
  };

  const hasForeignKeyViolations = async (table: string) => {
    const rows = await db.all(`PRAGMA foreign_key_check('${table}')`);
    return rows.length > 0;
  };

  const rebuildTableWithFks = async (
    table: string,
    foreignKeys: ForeignKeyDef[],
    indexes: string[]
  ) => {
    if (await hasForeignKeyViolations(table)) {
      console.warn(`[DB] Skip FK migration for ${table}: foreign key violations detected.`);
      return;
    }

    const cols = await db.all(`PRAGMA table_info('${table}')`);
    if (!cols.length) return;

    const tmpTable = `${table}__tmp`;
    await db.exec(`DROP TABLE IF EXISTS ${tmpTable}`);

    const formatDefault = (value: any) => {
      const raw = String(value).trim();
      if (!raw) return '';
      const upper = raw.toUpperCase();
      if (upper === 'CURRENT_TIMESTAMP' || upper === 'CURRENT_DATE' || upper === 'CURRENT_TIME') {
        return `DEFAULT ${raw}`;
      }
      if (raw.startsWith('(') && raw.endsWith(')')) return `DEFAULT ${raw}`;
      if (raw.startsWith("'") || raw.startsWith('"')) return `DEFAULT ${raw}`;
      if (/^-?\d+(\.\d+)?$/.test(raw)) return `DEFAULT ${raw}`;
      if (raw.includes('(')) return `DEFAULT (${raw})`;
      return `DEFAULT ${raw}`;
    };

    const colDefs = cols.map((c: any) => {
      const parts = [`${c.name} ${c.type || 'TEXT'}`];
      if (c.pk) parts.push('PRIMARY KEY');
      if (c.notnull) parts.push('NOT NULL');
      if (c.dflt_value !== null && c.dflt_value !== undefined) {
        const def = formatDefault(c.dflt_value);
        if (def) parts.push(def);
      }
      return parts.join(' ');
    });

    const fkDefs = foreignKeys.map((fk) => {
      const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '';
      return `FOREIGN KEY(${fk.from}) REFERENCES ${fk.toTable}(${fk.toColumn})${onDelete}`;
    });

    const createSql = `CREATE TABLE ${tmpTable} (${[...colDefs, ...fkDefs].join(', ')})`;
    try {
      await db.exec(createSql);
    } catch (err: any) {
      console.error(`[DB] Failed to create temp table for ${table}.`, createSql);
      throw err;
    }

    const newCols = await db.all(`PRAGMA table_info('${tmpTable}')`);
    const newColNames = newCols.map((c: any) => c.name);
    const oldColSet = new Set(cols.map((c: any) => c.name));
    const commonCols = newColNames.filter((name: string) => oldColSet.has(name));

    if (commonCols.length) {
      const colList = commonCols.map((name: string) => `"${name}"`).join(', ');
      try {
        await db.exec(`INSERT INTO ${tmpTable} (${colList}) SELECT ${colList} FROM ${table}`);
      } catch (err: any) {
        console.error(`[DB] Failed to copy data into ${tmpTable} from ${table}.`, err);
        throw err;
      }
    }

    await db.exec(`DROP TABLE ${table}`);
    await db.exec(`ALTER TABLE ${tmpTable} RENAME TO ${table}`);

    for (const sql of indexes) {
      await db.exec(sql);
    }

    console.log(`[DB] Rebuilt ${table} with updated foreign keys.`);
  };

  await ensureColumn('Product', 'qbuRateSource', 'qbuRateSource TEXT');
  await ensureColumn('Product', 'qbuRateDate', 'qbuRateDate TEXT');
  await ensureColumn('Product', 'qbuRateValue', 'qbuRateValue REAL');
  await ensureColumn('User', 'username', 'username TEXT');
  await ensureColumn('User', 'passwordHash', 'passwordHash TEXT');
  await ensureColumn('User', 'systemRole', "systemRole TEXT DEFAULT 'viewer'");
  await ensureColumn('User', 'roleCodes', 'roleCodes TEXT');
  await ensureColumn('User', 'employeeCode', 'employeeCode TEXT');
  await ensureColumn('User', 'dateOfBirth', 'dateOfBirth TEXT');
  await ensureColumn('User', 'avatar', 'avatar TEXT');
  await ensureColumn('User', 'address', 'address TEXT');
  await ensureColumn('User', 'startDate', 'startDate TEXT');
  await ensureColumn('User', 'lastLoginAt', 'lastLoginAt TEXT');
  await ensureColumn('User', 'accountStatus', "accountStatus TEXT DEFAULT 'active'");
  await ensureColumn('User', 'mustChangePassword', 'mustChangePassword INTEGER DEFAULT 1');
  await ensureColumn('User', 'language', "language TEXT DEFAULT 'vi'");
  await ensureColumn('Activity', 'actorUserId', 'actorUserId TEXT');
  await ensureColumn('Activity', 'actorRoles', 'actorRoles TEXT');
  await ensureColumn('Activity', 'actingCapability', 'actingCapability TEXT');
  await ensureColumn('Activity', 'action', 'action TEXT');
  await ensureColumn('Activity', 'timestamp', 'timestamp TEXT');
  await ensureColumn('Task', 'target', 'target TEXT');
  await ensureColumn('Task', 'resultLinks', 'resultLinks TEXT');
  await ensureColumn('Task', 'output', 'output TEXT');
  await ensureColumn('Task', 'reportDate', 'reportDate TEXT');
  await ensureColumn('Task', 'taskType', 'taskType TEXT');
  await ensureColumn('Task', 'department', 'department TEXT');
  await ensureColumn('Task', 'blockedReason', 'blockedReason TEXT');
  await ensureColumn('ApprovalRequest', 'pricingQuotationId', 'pricingQuotationId TEXT');
  await ensureColumn('PricingQuotation', 'projectId', 'projectId TEXT');
  await ensureColumn('PricingQuotation', 'changeReason', 'changeReason TEXT');
  await ensureColumn('PricingQuotation', 'qbuType', "qbuType TEXT DEFAULT 'INITIAL'");
  await ensureColumn('PricingQuotation', 'parentPricingQuotationId', 'parentPricingQuotationId TEXT');
  await ensureColumn('PricingQuotation', 'batchNo', 'batchNo INTEGER DEFAULT 0');
  await ensureColumn('PricingQuotation', 'qbuWorkflowStage', "qbuWorkflowStage TEXT DEFAULT 'draft'");
  await ensureColumn('PricingQuotation', 'qbuSubmittedAt', 'qbuSubmittedAt TEXT');
  await ensureColumn('PricingQuotation', 'qbuSubmittedBy', 'qbuSubmittedBy TEXT');
  await ensureColumn('PricingQuotation', 'qbuCompletedAt', 'qbuCompletedAt TEXT');
  await ensureColumn('PricingLineItem', 'costRoutingType', 'costRoutingType TEXT');
  await ensureColumn('Notification', 'entityType', 'entityType TEXT');
  await ensureColumn('Notification', 'entityId', 'entityId TEXT');
  await ensureColumn('Notification', 'link', 'link TEXT');
  await ensureColumn('SupportTicket', 'category', 'category TEXT');
  await ensureColumn('SupportTicket', 'subject', 'subject TEXT');
  await ensureColumn('SupportTicket', 'description', 'description TEXT');
  await ensureColumn('SupportTicket', 'status', "status TEXT DEFAULT 'open'");
  await ensureColumn('SupportTicket', 'responseNote', 'responseNote TEXT');
  await ensureColumn('SupportTicket', 'createdBy', 'createdBy TEXT');
  await ensureColumn('SupportTicket', 'updatedBy', 'updatedBy TEXT');
  await ensureColumn('SupportTicket', 'createdAt', 'createdAt DATETIME DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('SupportTicket', 'updatedAt', 'updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('Task', 'accountId', 'accountId TEXT');
  await ensureColumn('Task', 'leadId', 'leadId TEXT');
  await ensureColumn('Task', 'quotationId', 'quotationId TEXT');
  await ensureColumn('Project', 'projectStage', "projectStage TEXT DEFAULT 'new'");
  await ensureColumn('Quotation', 'projectId', 'projectId TEXT');
  await ensureColumn('Quotation', 'revisionNo', 'revisionNo INTEGER DEFAULT 1');
  await ensureColumn('Quotation', 'revisionLabel', 'revisionLabel TEXT');
  await ensureColumn('Quotation', 'parentQuotationId', 'parentQuotationId TEXT');
  await ensureColumn('Quotation', 'changeReason', 'changeReason TEXT');
  await ensureColumn('Quotation', 'isWinningVersion', 'isWinningVersion INTEGER DEFAULT 0');
  await ensureColumn('SupplierQuote', 'projectId', 'projectId TEXT');
  await ensureColumn('SupplierQuote', 'linkedQuotationId', 'linkedQuotationId TEXT');
  await ensureColumn('SupplierQuote', 'changeReason', 'changeReason TEXT');
  await ensureColumn('ProjectProcurementLine', 'isActive', 'isActive INTEGER DEFAULT 1');
  await ensureColumn('ProjectProcurementLine', 'supersededAt', 'supersededAt TEXT');
  await ensureColumn('ProjectProcurementLine', 'supersededByBaselineId', 'supersededByBaselineId TEXT');
  await ensureColumn('ApprovalRequest', 'projectId', 'projectId TEXT');
  await ensureColumn('ApprovalRequest', 'quotationId', 'quotationId TEXT');
  await ensureColumn('ApprovalRequest', 'requestType', 'requestType TEXT');
  await ensureColumn('ApprovalRequest', 'title', 'title TEXT');
  await ensureColumn('ApprovalRequest', 'department', 'department TEXT');
  await ensureColumn('ApprovalRequest', 'requestedBy', 'requestedBy TEXT');
  await ensureColumn('ApprovalRequest', 'approverRole', 'approverRole TEXT');
  await ensureColumn('ApprovalRequest', 'approverUserId', 'approverUserId TEXT');
  await ensureColumn('ApprovalRequest', 'status', "status TEXT DEFAULT 'pending'");
  await ensureColumn('ApprovalRequest', 'dueDate', 'dueDate TEXT');
  await ensureColumn('ApprovalRequest', 'note', 'note TEXT');
  await ensureColumn('ApprovalRequest', 'decidedAt', 'decidedAt TEXT');
  await ensureColumn('ApprovalRequest', 'decidedBy', 'decidedBy TEXT');
  await ensureColumn('ProjectDocument', 'projectId', 'projectId TEXT');
  await ensureColumn('ProjectDocument', 'quotationId', 'quotationId TEXT');
  await ensureColumn('ProjectDocument', 'documentCode', 'documentCode TEXT');
  await ensureColumn('ProjectDocument', 'documentName', 'documentName TEXT');
  await ensureColumn('ProjectDocument', 'category', 'category TEXT');
  await ensureColumn('ProjectDocument', 'department', 'department TEXT');
  await ensureColumn('ProjectDocument', 'status', "status TEXT DEFAULT 'missing'");
  await ensureColumn('ProjectDocument', 'requiredAtStage', 'requiredAtStage TEXT');
  await ensureColumn('ProjectDocument', 'note', 'note TEXT');
  await ensureColumn('ProjectDocument', 'receivedAt', 'receivedAt TEXT');

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pricing_quote_project ON PricingQuotation (projectId, batchNo);
    CREATE INDEX IF NOT EXISTS idx_pricing_quote_parent ON PricingQuotation (parentPricingQuotationId, batchNo);
    CREATE INDEX IF NOT EXISTS idx_pricing_quote_stage ON PricingQuotation (qbuWorkflowStage, updatedAt);
  `);

  await migrateLegacySupplierTable();
  await ensureUniqueIndexIfNoDuplicates('User', 'username', 'idx_user_username_unique');
  await nullifyInvalidRefs('Account', 'assignedTo', 'User', 'id');
  await nullifyInvalidRefs('Project', 'managerId', 'User', 'id');
  await nullifyInvalidRefs('Task', 'assigneeId', 'User', 'id');
  await nullifyInvalidRefs('Quotation', 'accountId', 'Account', 'id');
  await nullifyInvalidRefs('Quotation', 'contactId', 'Contact', 'id');
  await nullifyInvalidRefs('Quotation', 'projectId', 'Project', 'id');
  await nullifyInvalidRefs('Quotation', 'parentQuotationId', 'Quotation', 'id');
  await nullifyInvalidRefs('SupplierQuote', 'projectId', 'Project', 'id');
  await nullifyInvalidRefs('SupplierQuote', 'linkedQuotationId', 'Quotation', 'id');
  await nullifyInvalidRefs('ApprovalRequest', 'projectId', 'Project', 'id');
  await nullifyInvalidRefs('ApprovalRequest', 'quotationId', 'Quotation', 'id');
  await nullifyInvalidRefs('ApprovalRequest', 'approverUserId', 'User', 'id');
  await nullifyInvalidRefs('ProjectDocument', 'projectId', 'Project', 'id');
  await nullifyInvalidRefs('ProjectDocument', 'quotationId', 'Quotation', 'id');
  await nullifyInvalidRefs('SalesOrder', 'accountId', 'Account', 'id');
  await nullifyInvalidRefs('SalesOrder', 'quotationId', 'Quotation', 'id');

  const fkTargets: Array<{ table: string; foreignKeys: ForeignKeyDef[]; indexes: string[] }> = [
    {
      table: 'Account',
      foreignKeys: [{ from: 'assignedTo', toTable: 'User', toColumn: 'id', onDelete: 'SET NULL' }],
      indexes: ['CREATE INDEX IF NOT EXISTS idx_account_assigned ON Account (assignedTo)']
    },
    {
      table: 'Contact',
      foreignKeys: [{ from: 'accountId', toTable: 'Account', toColumn: 'id', onDelete: 'CASCADE' }],
      indexes: ['CREATE INDEX IF NOT EXISTS idx_contact_account ON Contact (accountId)']
    },
    {
      table: 'Quotation',
      foreignKeys: [
        { from: 'accountId', toTable: 'Account', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'contactId', toTable: 'Contact', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'parentQuotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' }
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_quotation_status ON Quotation (status)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_account ON Quotation (accountId)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_date ON Quotation (quoteDate)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_project ON Quotation (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_revision ON Quotation (projectId, revisionNo)',
        'CREATE INDEX IF NOT EXISTS idx_quotation_parent ON Quotation (parentQuotationId)'
      ]
    },
    {
      table: 'SupplierQuote',
      foreignKeys: [
        { from: 'supplierId', toTable: 'Account', toColumn: 'id', onDelete: 'CASCADE' },
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'linkedQuotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' }
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_supplierquote_supplier ON SupplierQuote (supplierId)',
        'CREATE INDEX IF NOT EXISTS idx_supplierquote_status ON SupplierQuote (status)',
        'CREATE INDEX IF NOT EXISTS idx_supplierquote_project ON SupplierQuote (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_supplierquote_quotation ON SupplierQuote (linkedQuotationId)'
      ]
    },
    {
      table: 'Project',
      foreignKeys: [{ from: 'managerId', toTable: 'User', toColumn: 'id', onDelete: 'SET NULL' }],
      indexes: ['CREATE INDEX IF NOT EXISTS idx_project_manager ON Project (managerId)']
    },
    {
      table: 'Task',
      foreignKeys: [
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'CASCADE' },
        { from: 'assigneeId', toTable: 'User', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'quotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' }
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_task_project ON Task (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_task_assignee ON Task (assigneeId)',
        'CREATE INDEX IF NOT EXISTS idx_task_status ON Task (status)',
        'CREATE INDEX IF NOT EXISTS idx_task_account ON Task (accountId)',
        'CREATE INDEX IF NOT EXISTS idx_task_start_date ON Task (startDate)',
        'CREATE INDEX IF NOT EXISTS idx_task_due_date ON Task (dueDate)',
        'CREATE INDEX IF NOT EXISTS idx_task_lead ON Task (leadId)',
        'CREATE INDEX IF NOT EXISTS idx_task_quotation ON Task (quotationId)',
        'CREATE INDEX IF NOT EXISTS idx_task_type ON Task (taskType)',
        'CREATE INDEX IF NOT EXISTS idx_task_department ON Task (department)'
      ]
    },
    {
      table: 'SalesOrder',
      foreignKeys: [
        { from: 'quotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'accountId', toTable: 'Account', toColumn: 'id', onDelete: 'CASCADE' }
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_salesorder_created ON SalesOrder (createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_salesorder_status ON SalesOrder (status, updatedAt)'
      ]
    },
    {
      table: 'ApprovalRequest',
      foreignKeys: [
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'CASCADE' },
        { from: 'quotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' },
        { from: 'approverUserId', toTable: 'User', toColumn: 'id', onDelete: 'SET NULL' }
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_approval_project ON ApprovalRequest (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_approval_quote ON ApprovalRequest (quotationId)',
        'CREATE INDEX IF NOT EXISTS idx_approval_status ON ApprovalRequest (status)',
        'CREATE INDEX IF NOT EXISTS idx_approval_department ON ApprovalRequest (department)'
      ]
    },
    {
      table: 'ProjectDocument',
      foreignKeys: [
        { from: 'projectId', toTable: 'Project', toColumn: 'id', onDelete: 'CASCADE' },
        { from: 'quotationId', toTable: 'Quotation', toColumn: 'id', onDelete: 'SET NULL' }
      ],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_project ON ProjectDocument (projectId)',
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_quote ON ProjectDocument (quotationId)',
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_status ON ProjectDocument (status)',
        'CREATE INDEX IF NOT EXISTS idx_projectdocument_department ON ProjectDocument (department)'
      ]
    },
    {
      table: 'ChatMessage',
      foreignKeys: [{ from: 'userId', toTable: 'User', toColumn: 'id', onDelete: 'CASCADE' }],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_chatmessage_user_created ON ChatMessage (userId, createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_chatmessage_created ON ChatMessage (createdAt)'
      ]
    },
    {
      table: 'Notification',
      foreignKeys: [{ from: 'userId', toTable: 'User', toColumn: 'id', onDelete: 'CASCADE' }],
      indexes: [
        'CREATE INDEX IF NOT EXISTS idx_notification_user_read_created ON Notification (userId, readAt, createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_notification_user_created ON Notification (userId, createdAt)'
      ]
    }
  ];

  let fkNeedsMigration = false;
  for (const target of fkTargets) {
    if (await shouldRebuildForFks(target.table, target.foreignKeys)) {
      fkNeedsMigration = true;
      break;
    }
  }

  if (fkNeedsMigration) {
    await db.run('PRAGMA foreign_keys = OFF');
    for (const target of fkTargets) {
      if (await shouldRebuildForFks(target.table, target.foreignKeys)) {
        await rebuildTableWithFks(target.table, target.foreignKeys, target.indexes);
      }
    }
    await db.run('PRAGMA foreign_keys = ON');
    const fkProblems = await db.all('PRAGMA foreign_key_check');
    if (fkProblems.length) {
      console.warn('[DB] Foreign key check found issues after migration.', fkProblems);
    }
  }

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_task_lead ON Task (leadId);
    CREATE INDEX IF NOT EXISTS idx_task_quotation ON Task (quotationId);
  `);
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['vcb_rate_url', '']
  );
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['qbu_variance_threshold_pct', '10']
  );
  await db.run(
    'INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)',
    ['qbu_variance_threshold_vnd', '20000000']
  );

  // Backfill defaults for older DBs where ALTER TABLE added nullable columns.
  await db.run("UPDATE User SET language = 'vi' WHERE language IS NULL OR TRIM(language) = ''");
  await db.run("UPDATE SupportTicket SET status = 'open' WHERE status IS NULL OR TRIM(status) = ''");
  await db.run("UPDATE SupportTicket SET subject = COALESCE(NULLIF(TRIM(subject), ''), 'Support request') WHERE subject IS NULL OR TRIM(subject) = ''");
  await db.run("UPDATE SupportTicket SET updatedAt = COALESCE(updatedAt, createdAt, datetime('now')) WHERE updatedAt IS NULL OR TRIM(updatedAt) = ''");
  await canonicalizeGenderColumn('User', 'id');
  await canonicalizeGenderColumn('Contact', 'id');
  await normalizeLegacyProductStructuredFields();

  // Tạo tài khoản admin mặc định nếu chưa có
  const adminExists = await db.get("SELECT id FROM User WHERE username = 'admin'");
  if (!adminExists) {
    const hash = await bcrypt.hash('admin123', 10);
    await db.run(
      `INSERT INTO User (id, fullName, gender, email, phone, role, department, status, username, passwordHash, systemRole)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'Administrator', 'male', 'admin@huynhthy.com', '', 'Administrator', 'IT', 'Active', 'admin', hash, 'admin']
    );
    console.log('✅ Default admin user created (username: admin, password: admin123)');
  }

  console.log('✅ SQLite Database Tables Initialized');
  if (process.env.SEED_DB === 'true') {
    await seedDatabase();
  }
  dbInitialized = true;
}

export function getDb(): Database {
  if (!db) {
    throw new Error("Tệp database chưa được khởi tạo! Hãy gọi initDb trước khi sử dụng getDb().");
  }
  return db;
}

// ========== SEED DATA ==========

const genId = () => uuidv4();

async function seedDatabase() {
  // 1. Accounts
  const accountCount = await db.get('SELECT COUNT(*) as c FROM Account');
  const accIds = [genId(), genId(), genId(), genId(), genId()];
  const supIds = [genId(), genId(), genId(), genId(), genId()];

  if (accountCount.c < 10) {
    // 5 Khách hàng
    const accs = [
      [accIds[0], 'Cảng Nam Hải Đình Vũ', 'Miền Bắc', 'Khai thác cảng', 'namhaidinhvu.com', '020xxxxx', 'Hải Phòng', 'Customer', 'NHDV'],
      [accIds[1], 'Cảng Đà Nẵng', 'Miền Trung', 'Khai thác cảng', 'danangport.com', '040xxxxx', 'Đà Nẵng', 'Customer', 'DNGP'],
      [accIds[2], 'Tân Cảng Sài Gòn', 'Miền Nam', 'Logistics', 'saigonnewport.com.vn', '030xxxxx', 'Hồ Chí Minh', 'Customer', 'TCSG'],
      [accIds[3], 'Vận tải Minh Quốc', 'Miền Nam', 'Vận tải', 'minhquoc.com', '030xxxxx', 'Bình Dương', 'Customer', 'MQLogistics'],
      [accIds[4], 'Xi Măng Long Sơn', 'Miền Trung', 'Sản xuất', 'longson.vn', '010xxxxx', 'Thanh Hóa', 'Customer', 'LS Cement']
    ];
    for (const a of accs) {
      await db.run('INSERT OR IGNORE INTO Account (id, companyName, region, industry, website, taxCode, address, accountType, shortName) VALUES (?,?,?,?,?,?,?,?,?)', a);
    }
    
    // 5 Nhà cung cấp
    const sups = [
      [supIds[0], 'Komatsu Japan', 'Nhà sản xuất thiết bị hạng nặng', 'Japan', 'Supplier', 'KOM-JP'],
      [supIds[1], 'Volvo Trucks', 'Xe tải nặng', 'Sweden', 'Supplier', 'VOL-SE'],
      [supIds[2], 'Shacman Heavy Duty', 'Xe công trình đường dài', 'China', 'Supplier', 'SHC-CN'],
      [supIds[3], 'Sany Group', 'Máy xúc & cẩu', 'China', 'Supplier', 'SNY-CN'],
      [supIds[4], 'Caterpillar Inc.', 'Thiết bị xây dựng Mỹ', 'USA', 'Supplier', 'CAT-US']
    ];
    for (const s of sups) {
      await db.run('INSERT OR IGNORE INTO Account (id, companyName, description, country, accountType, code) VALUES (?,?,?,?,?,?)', s);
    }
  }

  // 2. Contacts
  const contactCount = await db.get('SELECT COUNT(*) as c FROM Contact');
  if (contactCount.c < 10) {
    const contacts = [
      [genId(), accIds[0], 'Nguyễn', 'Văn Nam', 'Kỹ thuật', 'Trưởng phòng', 'male', 'namnv@namhai.vn', '0901234567'],
      [genId(), accIds[0], 'Lê', 'Hoàng Thái', 'Kỹ thuật', 'Chuyên viên', 'male', 'thailh@namhai.vn', '0912345678'],
      [genId(), accIds[1], 'Trần', 'Thị Bé', 'Mua hàng', 'Purchasing', 'female', 'bet@danangport.vn', '0923456789'],
      [genId(), accIds[1], 'Phạm', 'Thanh', 'Ban GĐ', 'Giám đốc', 'male', 'thanhp@danangport.vn', '0934567890'],
      [genId(), accIds[2], 'Ngô', 'Quang', 'Mua hàng', 'Trưởng trạm', 'male', 'quangnq@saigonnewport.vn', '0945678901'],
      [genId(), supIds[0], 'Tanaka', 'Kenji', 'Sales', 'Manager', 'male', 'kenji@komatsu.jp', '+81999999'],
      [genId(), supIds[1], 'Anna', 'Andersson', 'B2B', 'Director', 'female', 'anna@volvo.se', '+46888888'],
      [genId(), supIds[2], 'Wang', 'Wei', 'Export', 'Sales Rep', 'male', 'weiw@shacman.cn', '+86777777'],
      [genId(), supIds[3], 'Li', 'Jian', 'Export', 'Manager', 'male', 'lijian@sany.cn', '+86666666'],
      [genId(), accIds[4], 'Hoàng', 'Quân', 'Cơ giới', 'Đội trưởng', 'male', 'quan.hoang@longson.vn', '0956789012'],
    ];
    for (const c of contacts) {
      await db.run('INSERT OR IGNORE INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone) VALUES (?,?,?,?,?,?,?,?,?)', c);
    }
  }

  // 3. Leads
  const leadCount = await db.get('SELECT COUNT(*) as c FROM Lead');
  if (leadCount.c < 10) {
    const leads = [
      [genId(), 'Tập đoàn Hòa Phát', 'Phạm Long', 'long.pham@hoaphat.com.vn', '098111222', 'New', 'Cold Call'],
      [genId(), 'Cảng Quy Nhơn', 'Lý Tự Trọng', 'tronglt@quynhonport.vn', '098222333', 'Qualified', 'Website'],
      [genId(), 'Khoáng sản ABC', 'Bạch Cốt', 'cotb@abc.vn', '098333444', 'Lost', 'Referral'],
      [genId(), 'Vinaconex', 'Trần Thắng', 'thangt@vinaconex.com', '098444555', 'Proposal', 'Event'],
      [genId(), 'Giao hàng Tiết Kiệm', 'Đinh Vĩnh', 'vinhd@ghtk.vn', '098555666', 'Won', 'Website'],
      [genId(), 'Viettel Logistics', 'Trương Tuấn', 'tuan_vt@viettel.vn', '098666777', 'New', 'Partner'],
      [genId(), 'Viconship', 'Đào Hà', 'had@viconship.vn', '098777888', 'Qualification', 'Cold Call'],
      [genId(), 'Cảng Vũng Áng', 'Hồ Tấn', 'tanh@vungang.vn', '098888999', 'Proposal', 'Website'],
      [genId(), 'Tôn Hoa Sen', 'Ca Thương', 'thuongc@hoasen.vn', '098999000', 'New', 'Event'],
      [genId(), 'Hưng Thịnh', 'Thịnh Nguyễn', 'thinhng@hungthinh.vn', '098000111', 'Lost', 'Referral'],
    ];
    for (const ld of leads) {
      await db.run('INSERT OR IGNORE INTO Lead (id, companyName, contactName, email, phone, status, source) VALUES (?,?,?,?,?,?,?)', ld);
    }
  }

  // 4. Products
  const productCount = await db.get('SELECT COUNT(*) as c FROM Product');
  if (productCount.c < 10) {
    const prods = [
      [genId(), 'KOM-PC8000', 'Máy xúc siêu trường Komatsu PC8000', 'Máy xúc', 'Chiếc', 5000000, 'USD', 'Gầu 42m3'],
      [genId(), 'KOM-WA900', 'Xe xúc lật WA900-8', 'Xúc lật', 'Chiếc', 1200000, 'USD', 'Gầu 13m3'],
      [genId(), 'SHC-X3000', 'Xe đầu kéo Shacman X3000', 'Xe tải', 'Chiếc', 45000, 'USD', '400HP'],
      [genId(), 'VOL-FH16', 'Volvo FH16 6x4', 'Xe tải', 'Chiếc', 120000, 'USD', '750HP'],
      [genId(), 'CAT-797F', 'Xe tải mỏ Cat 797F', 'Xe siêu trọng', 'Chiếc', 3500000, 'USD', '400 tấn'],
      [genId(), 'SNY-SY750', 'Máy xúc Sany SY750H', 'Máy xúc', 'Chiếc', 250000, 'USD', 'Gầu 5.4m3'],
      [genId(), 'KAL-DRG', 'Xe nâng Kalmar Reachstacker', 'Xe nâng', 'Chiếc', 600000, 'USD', 'Nâng container 45t'],
      [genId(), 'TFN-FD30', 'Phụ tùng lọc dầu Shacman', 'Phụ tùng', 'Cái', 50, 'USD', 'Bảo dưỡng'],
      [genId(), 'HYD-MOT', 'Motor thủy lực Parker', 'Phụ tùng', 'Cái', 850, 'USD', 'Sửa chữa'],
      [genId(), 'SER-MAINT', 'Gói bảo dưỡng định kỳ 500h', 'Dịch vụ', 'Gói', 1500, 'USD', 'SLA 48h'],
    ];
    for (const pt of prods) {
      await db.run('INSERT OR IGNORE INTO Product (id, sku, name, category, unit, basePrice, currency, technicalSpecs) VALUES (?,?,?,?,?,?,?,?)', pt);
    }
  }

  // 5. SupplierQuotes
  const sqCount = await db.get('SELECT COUNT(*) as c FROM SupplierQuote');
  if (sqCount.c < 10) {
    const sqs = Array(10).fill(0).map((_, i) => [
      genId(),
      supIds[i % 5],
      i % 2 === 0 ? 'Phụ tùng' : 'Máy nguyên chiếc',
      new Date().toISOString(),
      new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      JSON.stringify([{ productId: '123', baseCost: 1000 + i * 100, shippingCost: 200, importTax: 0.1 }]),
      '[]',
      'active'
    ]);
    for (const sq of sqs) {
      await db.run('INSERT OR IGNORE INTO SupplierQuote (id, supplierId, category, quoteDate, validUntil, items, attachments, status) VALUES (?,?,?,?,?,?,?,?)', sq);
    }
  }

  // 6. Quotations
  const quCount = await db.get('SELECT COUNT(*) as c FROM Quotation');
  if (quCount.c < 10) {
    const qts = Array(10).fill(0).map((_, i) => [
      genId(),
      `QT-2026-00${i+1}`,
      new Date().toISOString().slice(0, 10),
      `Báo giá thiết bị ${i+1}`,
      accIds[i % 5],
      null,
      'Nguyễn Văn Sales',
      '0909090909',
      'VND',
      JSON.stringify([{ sku: 'KOM-PC8000', name: 'Komatsu PC8000', unit: 'Chiếc', quantity: 1, unitPrice: 125000000000 }]),
      JSON.stringify({ exchangeRate: 25400 }),
      JSON.stringify({ validity: "30 days" }),
      125000000000,
      10000000000,
      135000000000,
      ['draft', 'sent', 'accepted', 'rejected'][i % 4]
    ]);
    for (const qt of qts) {
      await db.run('INSERT OR IGNORE INTO Quotation (id, quoteNumber, quoteDate, subject, accountId, contactId, salesperson, salespersonPhone, currency, items, financialParams, terms, subtotal, taxTotal, grandTotal, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', qt);
    }
  }

  // 7. Users
  const uCount = await db.get('SELECT COUNT(*) as c FROM User');
  if (uCount.c < 10) {
    const usersList = [
      [genId(), 'Huỳnh Thy Ngọc', 'female', 'ngoc.ht@huynhthy.com', '0911000001', 'CEO', 'Ban Giám Đốc'],
      [genId(), 'Trần Anh Sales', 'male', 'anh.tr@huynhthy.com', '0911000002', 'Sales Rep', 'Kinh Doanh'],
      [genId(), 'Lê Tuấn Mua', 'male', 'tuan.le@huynhthy.com', '0911000003', 'Purchasing', 'Cung Ứng'],
      [genId(), 'Nguyễn Kỹ Thuật', 'male', 'kt.nguyen@huynhthy.com', '0911000004', 'Engineer', 'Kỹ Thuật'],
      [genId(), 'Bùi Minh Trí', 'male', 'tri.bui@huynhthy.com', '0911000005', 'Manager', 'Kinh Doanh'],
      [genId(), 'Hoàng Nhâm', 'female', 'nham.hoang@huynhthy.com', '0911000006', 'HR', 'Nhân Sự'],
      [genId(), 'Võ Quang', 'male', 'quang.vo@huynhthy.com', '0911000007', 'Sales Rep', 'Kinh Doanh'],
      [genId(), 'Phan Thanh', 'female', 'thanh.phan@huynhthy.com', '0911000008', 'Accountant', 'Kế Toán'],
      [genId(), 'Đinh Bảo', 'male', 'bao.dinh@huynhthy.com', '0911000009', 'Marketing', 'Marketing'],
      [genId(), 'Đỗ Ngọc', 'female', 'ngoc.do@huynhthy.com', '0911000010', 'Sales Rep', 'Kinh Doanh'],
    ];
    for (const u of usersList) {
      await db.run('INSERT OR IGNORE INTO User (id, fullName, gender, email, phone, role, department) VALUES (?,?,?,?,?,?,?)', u);
    }
  }

  // 8. Activities
  const actCount = await db.get('SELECT COUNT(*) as c FROM Activity');
  if (actCount.c < 10) {
    const acts = [
      [genId(), 'Gửi báo giá mới', 'Báo giá QT-2026-001 đã được gửi qua email cho khách.', 'Quotation', '📄', '#e0f2fe', '#0284c7', null, null],
      [genId(), 'Tạo Lead mới', 'Lead Tập đoàn Hòa Phát được tạo.', 'Lead', '🎯', '#fce7f3', '#db2777', null, null],
      [genId(), 'Cập nhật QBU', 'Cập nhật giá cước vận chuyển tháng 4.', 'Purchasing', '🏗️', '#fef3c7', '#d97706', null, null],
      [genId(), 'Deal Accepted!', 'Khách hàng Cảng Đà Nẵng đã chốt đơn KOM-WA900.', 'Win', '🏆', '#dcfce7', '#16a34a', null, null],
      [genId(), 'Chăm sóc KH', 'Gọi điện giới thiệu chính sách trả góp 70%.', 'Contact', '📞', '#e0e7ff', '#4f46e5', null, null],
      [genId(), 'Họp với Partner', 'Trao đổi chiến lược với Shacman.', 'Meeting', '🤝', '#ffedd5', '#ea580c', null, null],
      [genId(), 'Import Data', 'Import thành công 100 mã sản phẩm từ kho Excel.', 'System', '⚙️', '#f1f5f9', '#475569', null, null],
      [genId(), 'Update Status', 'Lead Vinaconex nâng từ New -> Proposal.', 'Phase', '🔄', '#e0f2fe', '#0284c7', null, null],
      [genId(), 'Hợp đồng kí kết', 'Hoàn thành Hợp đồng số 102/2026', 'Contract', '📝', '#dcfce7', '#16a34a', null, null],
      [genId(), 'Gửi báo giá mẫu', 'Phục vụ review nội bộ', 'Internal', '📩', '#f3e8ff', '#9333ea', null, null],
    ];
    for (const a of acts) {
      await db.run('INSERT OR IGNORE INTO Activity (id, title, description, category, icon, color, iconColor, entityId, entityType) VALUES (?,?,?,?,?,?,?,?,?)', a);
    }
  }

  // 9. Default Settings
  const defaults = [
    ['quote_vat', '10'],
    ['quote_exchange_rate', '25450'],
    ['quote_interest_rate', '0.8'],
    ['quote_terms', '1. Hiệu lực báo giá: 30 ngày.\n2. Thời gian giao hàng: 60-90 ngày kể từ khi nhận tạm ứng.\n3. Bảo hành: 12 tháng hoặc 2000 giờ tùy điều kiện nào đến trước.'],
    ['company_name', 'CÔNG TY CỔ PHẦN TẬP ĐOÀN HUỲNH THY'],
    ['company_address', '71/11 Lê Quang Định, Phường 14, Quận Bình Thạnh, TP. HCM'],
    ['company_phone', '028 3551 2516'],
    ['company_email', 'info@huynhthy.com'],
    ['company_website', 'www.huynhthy.com']
  ];
  for (const [k, v] of defaults) {
    await db.run('INSERT OR IGNORE INTO SystemSetting (key, value) VALUES (?, ?)', [k, v]);
  }

  console.log('✅ SQLite Database Seed Successful');
}
