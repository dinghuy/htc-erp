import { type Database } from 'sqlite';

export async function bootstrapSqliteSchema(db: Database) {
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
      productVideos TEXT,
      qbuData TEXT,
      qbuUpdatedAt DATETIME,
      status TEXT DEFAULT 'available',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Task (
      id TEXT PRIMARY KEY,
      projectId TEXT,
      parentTaskId TEXT,
      name TEXT NOT NULL,
      description TEXT,
      assigneeId TEXT,
      sortOrder REAL DEFAULT 0,
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
      FOREIGN KEY (parentTaskId) REFERENCES Task(id) ON DELETE SET NULL,
      FOREIGN KEY (assigneeId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

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
  const taskColumns: any[] = await db.all(`PRAGMA table_info('Task')`);
  const hasTaskColumn = (name: string) => taskColumns.some((c: any) => c.name === name);
  if (!hasTaskColumn('parentTaskId')) {
    await db.exec(`ALTER TABLE Task ADD COLUMN parentTaskId TEXT`);
  }
  if (!hasTaskColumn('sortOrder')) {
    await db.exec(`ALTER TABLE Task ADD COLUMN sortOrder REAL DEFAULT 0`);
  }
  const productColumns: any[] = await db.all(`PRAGMA table_info('Product')`);
  const hasProductColumn = (name: string) => productColumns.some((c: any) => c.name === name);
  if (!hasProductColumn('productImages')) {
    await db.exec(`ALTER TABLE Product ADD COLUMN productImages TEXT`);
  }
  if (!hasProductColumn('productVideos')) {
    await db.exec(`ALTER TABLE Product ADD COLUMN productVideos TEXT`);
  }
  if (!hasProductColumn('productDocuments')) {
    await db.exec(`ALTER TABLE Product ADD COLUMN productDocuments TEXT`);
  }

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
      reviewStatus TEXT DEFAULT 'draft',
      reviewerUserId TEXT,
      reviewedAt TEXT,
      reviewNote TEXT,
      storageKey TEXT,
      threadId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectBlocker (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      category TEXT DEFAULT 'workflow',
      ownerRole TEXT,
      status TEXT DEFAULT 'open',
      tone TEXT DEFAULT 'warning',
      title TEXT NOT NULL,
      detail TEXT,
      action TEXT,
      linkedEntityType TEXT,
      linkedEntityId TEXT,
      resolvedAt TEXT,
      resolvedBy TEXT,
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(resolvedBy) REFERENCES User(id) ON DELETE SET NULL
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
    CREATE INDEX IF NOT EXISTS idx_task_parent ON Task (parentTaskId);
    CREATE INDEX IF NOT EXISTS idx_task_sort_order ON Task (parentTaskId, sortOrder, createdAt);
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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS SalesPerson (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS EntityThread (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      title TEXT,
      status TEXT DEFAULT 'active',
      createdBy TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS EntityThreadMessage (
      id TEXT PRIMARY KEY,
      threadId TEXT NOT NULL REFERENCES EntityThread(id) ON DELETE CASCADE,
      authorUserId TEXT,
      content TEXT NOT NULL,
      contentType TEXT DEFAULT 'text/plain',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
    CREATE INDEX IF NOT EXISTS idx_entitythread_entity ON EntityThread (entityType, entityId, status, createdAt);
    CREATE INDEX IF NOT EXISTS idx_entitythreadmessage_thread ON EntityThreadMessage (threadId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_supportticket_createdby_created ON SupportTicket (createdBy, createdAt);
    CREATE INDEX IF NOT EXISTS idx_supportticket_status_created ON SupportTicket (status, createdAt);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_erpoutbox_dedupe ON ErpOutbox (dedupeKey);
    CREATE INDEX IF NOT EXISTS idx_erpoutbox_status_next ON ErpOutbox (status, nextRunAt, createdAt);
    CREATE INDEX IF NOT EXISTS idx_salesorder_created ON SalesOrder (createdAt);
    CREATE INDEX IF NOT EXISTS idx_salesorder_status ON SalesOrder (status, updatedAt);
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
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS SystemSetting (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // ─── HULY PORT: Funnel (Sales Pipeline) ──────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Funnel (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      isDefault INTEGER DEFAULT 0,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── HULY PORT: HR Module ─────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Department (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parentId TEXT REFERENCES Department(id) ON DELETE SET NULL,
      teamLeadId TEXT REFERENCES User(id) ON DELETE SET NULL,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS HrRequest (
      id TEXT PRIMARY KEY,
      staffId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
      departmentId TEXT REFERENCES Department(id) ON DELETE SET NULL,
      requestType TEXT NOT NULL,
      description TEXT,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      decidedBy TEXT REFERENCES User(id) ON DELETE SET NULL,
      decidedAt TEXT,
      note TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PublicHoliday (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      holidayDate TEXT NOT NULL,
      departmentId TEXT REFERENCES Department(id) ON DELETE SET NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── HULY PORT: Product Category Hierarchy ───────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProductCategory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parentId TEXT REFERENCES ProductCategory(id) ON DELETE SET NULL,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── HULY PORT: Contact Channels ─────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ContactChannel (
      id TEXT PRIMARY KEY,
      contactId TEXT NOT NULL REFERENCES Contact(id) ON DELETE CASCADE,
      channelType TEXT NOT NULL,
      value TEXT NOT NULL,
      isPrimary INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── HULY PORT: Milestone (tracker) ──────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Milestone (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL REFERENCES Project(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planned',
      targetDate TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── HULY PORT: Time Spend Report ────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS TimeSpendReport (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
      userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
      reportDate TEXT NOT NULL,
      hours REAL NOT NULL DEFAULT 0,
      description TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_timespend_task_date ON TimeSpendReport (taskId, reportDate);
    CREATE INDEX IF NOT EXISTS idx_timespend_user_date ON TimeSpendReport (userId, reportDate);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS TaskDependency (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
      relatedTaskId TEXT NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'relates_to',
      note TEXT,
      createdBy TEXT REFERENCES User(id) ON DELETE SET NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_taskdependency_task ON TaskDependency (taskId, kind, createdAt);
    CREATE INDEX IF NOT EXISTS idx_taskdependency_related ON TaskDependency (relatedTaskId, kind, createdAt);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS TaskViewPreset (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      query TEXT,
      projectId TEXT,
      assigneeId TEXT,
      priority TEXT,
      status TEXT,
      onlyOverdue INTEGER DEFAULT 0,
      groupBy TEXT DEFAULT 'none',
      surface TEXT DEFAULT 'kanban',
      isDefault INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_taskviewpreset_user ON TaskViewPreset (userId, isDefault, createdAt);
  `);

  // ─── HULY PORT: ToDo + WorkSlot ──────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ToDo (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      dueDate TEXT,
      priority TEXT DEFAULT 'no_priority',
      visibility TEXT DEFAULT 'private',
      doneAt TEXT,
      entityType TEXT,
      entityId TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_todo_user_done ON ToDo (userId, doneAt);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS WorkSlot (
      id TEXT PRIMARY KEY,
      todoId TEXT NOT NULL REFERENCES ToDo(id) ON DELETE CASCADE,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workslot_todo ON WorkSlot (todoId);
  `);

  // ─── HULY PORT: extended indexes ─────────────────────────────────────────
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_funnel_sort ON Funnel (sortOrder);
    CREATE INDEX IF NOT EXISTS idx_department_parent ON Department (parentId);
    CREATE INDEX IF NOT EXISTS idx_hrrequest_staff ON HrRequest (staffId, startDate);
    CREATE INDEX IF NOT EXISTS idx_hrrequest_dept ON HrRequest (departmentId, status);
    CREATE INDEX IF NOT EXISTS idx_publicholiday_date ON PublicHoliday (holidayDate);
    CREATE INDEX IF NOT EXISTS idx_productcategory_parent ON ProductCategory (parentId);
    CREATE INDEX IF NOT EXISTS idx_contactchannel_contact ON ContactChannel (contactId);
    CREATE INDEX IF NOT EXISTS idx_milestone_project ON Milestone (projectId, status);
  `);
}
