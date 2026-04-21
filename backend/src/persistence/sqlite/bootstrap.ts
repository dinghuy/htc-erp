import { type Database } from 'sqlite';

export async function bootstrapSqliteSchema(db: Database) {
  // ─── CORE MODULE ───
  await db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT,
      gender TEXT,
      email TEXT,
      phone TEXT,
      role TEXT,
      department TEXT,
      status TEXT DEFAULT 'Active',
      username TEXT,
      passwordHash TEXT,
      systemRole TEXT DEFAULT 'viewer',
      roleCodes TEXT,
      employeeCode TEXT,
      dateOfBirth TEXT,
      avatar TEXT,
      address TEXT,
      startDate TEXT,
      lastLoginAt TEXT,
      accountStatus TEXT DEFAULT 'active',
      mustChangePassword INTEGER DEFAULT 1,
      language TEXT DEFAULT 'vi',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyName TEXT,
      region TEXT,
      industry TEXT,
      website TEXT,
      taxCode TEXT,
      address TEXT,
      assignedTo INTEGER,
      status TEXT,
      accountType TEXT DEFAULT 'Customer',
      code TEXT,
      shortName TEXT,
      description TEXT,
      tag TEXT,
      country TEXT,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assignedTo) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Contact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accountId INTEGER,
      lastName TEXT,
      firstName TEXT,
      department TEXT,
      jobTitle TEXT,
      gender TEXT,
      email TEXT,
      phone TEXT,
      isPrimaryContact INTEGER DEFAULT 0,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE CASCADE,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Lead (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyName TEXT,
      contactName TEXT,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'New',
      source TEXT,
      funnelId INTEGER,
      title TEXT,
      value REAL,
      assignedTo INTEGER,
      startDate TEXT,
      notes TEXT,
      contactId INTEGER,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assignedTo) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(contactId) REFERENCES Contact(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Product (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      name TEXT,
      category TEXT,
      categoryId INTEGER,
      unit TEXT DEFAULT 'Chiếc',
      basePrice REAL,
      currency TEXT DEFAULT 'USD',
      specifications TEXT,
      technicalSpecs TEXT,
      media TEXT,
      productImages TEXT,
      productVideos TEXT,
      productDocuments TEXT,
      qbuData TEXT,
      qbuUpdatedAt DATETIME,
      qbuRateSource TEXT,
      qbuRateDate TEXT,
      qbuRateValue REAL,
      status TEXT DEFAULT 'available',
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── TRANSACTIONAL MODULE ───
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ExchangeRate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baseCurrency TEXT NOT NULL,
      quoteCurrency TEXT NOT NULL,
      effectiveDate TEXT NOT NULL,
      rateValue REAL NOT NULL,
      source TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PasswordResetToken (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tokenHash TEXT NOT NULL,
      requestedByIp TEXT,
      expiresAt TEXT NOT NULL,
      usedAt TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
      interestRate REAL DEFAULT 8.5,
      exchangeRate REAL DEFAULT 25400,
      loanTermMonths INTEGER DEFAULT 36,
      markup REAL DEFAULT 15,
      vatRate REAL DEFAULT 8,
      calculateTotals INTEGER DEFAULT 1,
      remarksVi TEXT,
      remarksEn TEXT,
      subtotal REAL,
      taxTotal REAL,
      grandTotal REAL,
      status TEXT DEFAULT 'draft',
      validUntil DATETIME,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(accountId) REFERENCES Account(id) ON DELETE SET NULL,
      FOREIGN KEY(contactId) REFERENCES Contact(id) ON DELETE SET NULL,
      FOREIGN KEY(parentQuotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
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
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplierId) REFERENCES Account(id) ON DELETE CASCADE,
      FOREIGN KEY(linkedQuotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS SalesOrder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderNumber TEXT,
      quotationId INTEGER UNIQUE,
      accountId INTEGER,
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

  // ─── PROJECT MODULE ───
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Project (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      managerId INTEGER,
      accountId INTEGER,
      projectStage TEXT DEFAULT 'new',
      startDate TEXT,
      endDate TEXT,
      status TEXT DEFAULT 'pending',
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (managerId) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY (accountId) REFERENCES Account(id) ON DELETE SET NULL,
      FOREIGN KEY (deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Task (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER,
      parentTaskId INTEGER,
      milestoneId INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      assigneeId INTEGER,
      sortOrder REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      startDate TEXT,
      dueDate TEXT,
      completionPct INTEGER DEFAULT 0,
      notes TEXT,
      accountId INTEGER,
      leadId INTEGER,
      quotationId INTEGER,
      taskType TEXT,
      department TEXT,
      blockedReason TEXT,
      target TEXT,
      resultLinks TEXT,
      output TEXT,
      reportDate TEXT,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY (parentTaskId) REFERENCES Task(id) ON DELETE SET NULL,
      FOREIGN KEY (assigneeId) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY (quotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY (deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ApprovalRequest (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER,
      quotationId INTEGER,
      pricingQuotationId INTEGER,
      requestType TEXT,
      title TEXT,
      department TEXT,
      requestedBy INTEGER,
      approverRole TEXT,
      approverUserId INTEGER,
      status TEXT DEFAULT 'pending',
      dueDate TEXT,
      note TEXT,
      decidedAt TEXT,
      decidedBy INTEGER,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY(approverUserId) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(decidedBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(requestedBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectDocument (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER,
      quotationId INTEGER,
      documentCode TEXT,
      documentName TEXT,
      category TEXT,
      department TEXT,
      status TEXT DEFAULT 'missing',
      requiredAtStage TEXT,
      note TEXT,
      receivedAt TEXT,
      reviewStatus TEXT DEFAULT 'draft',
      reviewerUserId INTEGER,
      reviewedAt TEXT,
      reviewNote TEXT,
      storageKey TEXT,
      threadId INTEGER,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY(reviewerUserId) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(threadId) REFERENCES EntityThread(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectBlocker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      source TEXT DEFAULT 'manual',
      category TEXT DEFAULT 'workflow',
      ownerRole TEXT,
      status TEXT DEFAULT 'open',
      tone TEXT DEFAULT 'warning',
      title TEXT NOT NULL,
      detail TEXT,
      action TEXT,
      linkedEntityType TEXT,
      linkedEntityId INTEGER,
      resolvedAt TEXT,
      resolvedBy INTEGER,
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(resolvedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectContract (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      quotationId INTEGER,
      contractNumber TEXT,
      title TEXT,
      signedDate TEXT,
      effectiveDate TEXT,
      status TEXT DEFAULT 'draft',
      currency TEXT DEFAULT 'VND',
      totalValue REAL DEFAULT 0,
      summary TEXT,
      lineItems TEXT DEFAULT '[]',
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(quotationId) REFERENCES Quotation(id) ON DELETE SET NULL,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectContractAppendix (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      contractId INTEGER NOT NULL,
      appendixNumber TEXT,
      title TEXT,
      signedDate TEXT,
      effectiveDate TEXT,
      status TEXT DEFAULT 'draft',
      totalDeltaValue REAL DEFAULT 0,
      summary TEXT,
      lineItems TEXT DEFAULT '[]',
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(contractId) REFERENCES ProjectContract(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectExecutionBaseline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      sourceType TEXT NOT NULL,
      sourceId INTEGER NOT NULL,
      baselineNo INTEGER DEFAULT 1,
      title TEXT,
      effectiveDate TEXT,
      currency TEXT DEFAULT 'VND',
      totalValue REAL DEFAULT 0,
      lineItems TEXT DEFAULT '[]',
      isCurrent INTEGER DEFAULT 0,
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectProcurementLine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      baselineId INTEGER,
      sourceLineKey TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      supersededAt TEXT,
      supersededByBaselineId INTEGER,
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
      status TEXT DEFAULT 'planned',
      supplierId INTEGER,
      poNumber TEXT,
      etaDate TEXT,
      committedDeliveryDate TEXT,
      actualReceivedDate TEXT,
      actualDeliveryDate TEXT,
      note TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(baselineId) REFERENCES ProjectExecutionBaseline(id) ON DELETE SET NULL,
      FOREIGN KEY(supersededByBaselineId) REFERENCES ProjectExecutionBaseline(id) ON DELETE SET NULL,
      FOREIGN KEY(supplierId) REFERENCES Account(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectInboundLine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      procurementLineId INTEGER NOT NULL,
      baselineId INTEGER,
      sourceLineKey TEXT,
      receivedQty REAL DEFAULT 0,
      etaDate TEXT,
      actualReceivedDate TEXT,
      status TEXT DEFAULT 'pending',
      receiptRef TEXT,
      note TEXT,
      createdBy INTEGER,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      procurementLineId INTEGER NOT NULL,
      baselineId INTEGER,
      sourceLineKey TEXT,
      deliveredQty REAL DEFAULT 0,
      committedDate TEXT,
      actualDeliveryDate TEXT,
      status TEXT DEFAULT 'pending',
      deliveryRef TEXT,
      note TEXT,
      createdBy INTEGER,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      milestoneType TEXT,
      title TEXT NOT NULL,
      plannedDate TEXT,
      actualDate TEXT,
      status TEXT DEFAULT 'pending',
      note TEXT,
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProjectTimelineEvent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      eventType TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      eventDate TEXT,
      entityType TEXT,
      entityId INTEGER,
      payload TEXT,
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // ─── SUPPORT & COLLABORATION ───
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      category TEXT,
      icon TEXT,
      color TEXT,
      iconColor TEXT,
      entityId INTEGER,
      entityType TEXT,
      link TEXT,
      actorUserId INTEGER,
      actorRoles TEXT,
      actingCapability TEXT,
      action TEXT,
      timestamp TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(actorUserId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS DeletedRecord (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moduleKey TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      entityLabel TEXT,
      projectId TEXT,
      routePath TEXT,
      deleteMode TEXT DEFAULT 'soft',
      status TEXT DEFAULT 'deleted',
      snapshotJson TEXT,
      reason TEXT,
      deletedBy INTEGER,
      actorRoles TEXT,
      actingCapability TEXT,
      sourceActivityId INTEGER,
      adminNote TEXT,
      reviewedAt TEXT,
      reviewedBy INTEGER,
      restoredAt TEXT,
      restoredBy INTEGER,
      purgedAt TEXT,
      purgedBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(reviewedBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(restoredBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(purgedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ChatMessage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      content TEXT NOT NULL,
      readAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Notification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      content TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
      link TEXT,
      readAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS EntityThread (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entityType TEXT NOT NULL,
      entityId INTEGER NOT NULL,
      title TEXT,
      status TEXT DEFAULT 'active',
      createdBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS EntityThreadMessage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      threadId INTEGER NOT NULL,
      authorUserId INTEGER,
      content TEXT NOT NULL,
      contentType TEXT DEFAULT 'text/plain',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(threadId) REFERENCES EntityThread(id) ON DELETE CASCADE,
      FOREIGN KEY(authorUserId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS SupportTicket (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      responseNote TEXT,
      createdBy INTEGER NOT NULL,
      updatedBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY(updatedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  // ─── PRICING MODULE ───
  await db.exec(`
    CREATE TABLE IF NOT EXISTS PricingQuotation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER,
      projectCode TEXT,
      customerName TEXT,
      supplierName TEXT,
      salePerson TEXT,
      changeReason TEXT,
      qbuType TEXT DEFAULT 'INITIAL',
      parentPricingQuotationId INTEGER,
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
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE SET NULL,
      FOREIGN KEY(parentPricingQuotationId) REFERENCES PricingQuotation(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PricingLineItem (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotationId INTEGER NOT NULL,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotationId INTEGER NOT NULL UNIQUE,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotationId INTEGER NOT NULL UNIQUE,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotationId INTEGER NOT NULL,
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
    CREATE TABLE IF NOT EXISTS PricingCostEntry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pricingQuotationId INTEGER NOT NULL,
      lineItemId INTEGER,
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

  // ─── HULY PORT TABLES ───
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Funnel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      isDefault INTEGER DEFAULT 0,
      sortOrder INTEGER DEFAULT 0,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Department (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      parentId INTEGER,
      teamLeadId INTEGER,
      sortOrder INTEGER DEFAULT 0,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(parentId) REFERENCES Department(id) ON DELETE SET NULL,
      FOREIGN KEY(teamLeadId) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS HrRequest (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffId INTEGER NOT NULL,
      departmentId INTEGER,
      requestType TEXT NOT NULL,
      description TEXT,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      decidedBy INTEGER,
      decidedAt TEXT,
      note TEXT,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(staffId) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY(departmentId) REFERENCES Department(id) ON DELETE SET NULL,
      FOREIGN KEY(decidedBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS PublicHoliday (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      holidayDate TEXT NOT NULL,
      departmentId INTEGER,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(departmentId) REFERENCES Department(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ProductCategory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parentId INTEGER,
      sortOrder INTEGER DEFAULT 0,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(parentId) REFERENCES ProductCategory(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ContactChannel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contactId INTEGER NOT NULL,
      channelType TEXT NOT NULL,
      value TEXT NOT NULL,
      isPrimary INTEGER DEFAULT 0,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(contactId) REFERENCES Contact(id) ON DELETE CASCADE,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Milestone (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planned',
      targetDate TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(projectId) REFERENCES Project(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS TimeSpendReport (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      reportDate TEXT NOT NULL,
      hours REAL NOT NULL DEFAULT 0,
      description TEXT,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(taskId) REFERENCES Task(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS TaskDependency (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId INTEGER NOT NULL,
      relatedTaskId INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'relates_to',
      note TEXT,
      createdBy INTEGER,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(taskId) REFERENCES Task(id) ON DELETE CASCADE,
      FOREIGN KEY(relatedTaskId) REFERENCES Task(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS TaskViewPreset (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      query TEXT,
      projectId INTEGER,
      assigneeId INTEGER,
      priority TEXT,
      status TEXT,
      onlyOverdue INTEGER DEFAULT 0,
      groupBy TEXT DEFAULT 'none',
      surface TEXT DEFAULT 'kanban',
      isDefault INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(userId) REFERENCES User(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ToDo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      dueDate TEXT,
      priority TEXT DEFAULT 'no_priority',
      visibility TEXT DEFAULT 'private',
      doneAt TEXT,
      entityType TEXT,
      entityId INTEGER,
      deletedAt TEXT,
      deletedBy INTEGER,
      deleteReason TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(userId) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY(deletedBy) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS WorkSlot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todoId INTEGER NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(todoId) REFERENCES ToDo(id) ON DELETE CASCADE
    )
  `);

  // ─── SYSTEM TABLES ───
  await db.exec(`
    CREATE TABLE IF NOT EXISTS SystemSetting (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ErpOutbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupeKey TEXT NOT NULL,
      eventType TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
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
    CREATE TABLE IF NOT EXISTS IdempotencyLog (
      id TEXT PRIMARY KEY,
      idempotencyKey TEXT NOT NULL,
      method TEXT NOT NULL,
      routeKey TEXT NOT NULL,
      actorUserId TEXT,
      requestHash TEXT NOT NULL,
      status TEXT NOT NULL,
      responseStatus INTEGER,
      responseBody TEXT,
      expiresAt DATETIME NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ─── INDEXES ───
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_account_assigned ON Account (assignedTo);
    CREATE INDEX IF NOT EXISTS idx_contact_account ON Contact (accountId);
    CREATE INDEX IF NOT EXISTS idx_lead_status ON Lead (status);
    CREATE INDEX IF NOT EXISTS idx_product_sku ON Product (sku);
    CREATE INDEX IF NOT EXISTS idx_quotation_account ON Quotation (accountId);
    CREATE INDEX IF NOT EXISTS idx_project_manager ON Project (managerId);
    CREATE INDEX IF NOT EXISTS idx_task_project ON Task (projectId);
    CREATE INDEX IF NOT EXISTS idx_activity_entity ON Activity (entityId, entityType);
    CREATE INDEX IF NOT EXISTS idx_activity_actor ON Activity (actorUserId);
    CREATE INDEX IF NOT EXISTS idx_notification_user ON Notification (userId);
    CREATE INDEX IF NOT EXISTS idx_erpoutbox_status ON ErpOutbox (status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_erpoutbox_dedupe ON ErpOutbox (dedupeKey);
    CREATE INDEX IF NOT EXISTS idx_erpoutbox_worker_due ON ErpOutbox (status, nextRunAt, createdAt, id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_scope_key ON IdempotencyLog (method, routeKey, actorUserId, idempotencyKey);
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON IdempotencyLog (expiresAt);
    CREATE INDEX IF NOT EXISTS idx_timespend_task ON TimeSpendReport (taskId);
    CREATE INDEX IF NOT EXISTS idx_todo_user ON ToDo (userId, doneAt);
  `);
}
