import { initDb, getDb } from '../sqlite-db';

const BATCH_TAG = 'SAMPLE_2026_03_25';
const ID_PREFIX = 'sample-20260325';
const MARKER = `[${BATCH_TAG}]`;

const ids = {
  users: {
    u1: `${ID_PREFIX}-user-001`,
    u2: `${ID_PREFIX}-user-002`,
    u3: `${ID_PREFIX}-user-003`,
    u4: `${ID_PREFIX}-user-004`,
    u5: `${ID_PREFIX}-user-005`,
  },
  salespersons: {
    s1: `${ID_PREFIX}-salesperson-001`,
    s2: `${ID_PREFIX}-salesperson-002`,
  },
  accounts: {
    a1: `${ID_PREFIX}-account-001`,
    a2: `${ID_PREFIX}-account-002`,
    a3: `${ID_PREFIX}-account-003`,
    s1: `${ID_PREFIX}-supplier-001`,
  },
  contacts: {
    c1: `${ID_PREFIX}-contact-001`,
    c2: `${ID_PREFIX}-contact-002`,
  },
  leads: {
    l1: `${ID_PREFIX}-lead-001`,
  },
  products: {
    p1: `${ID_PREFIX}-product-001`,
    p2: `${ID_PREFIX}-product-002`,
  },
  exchangeRate: `${ID_PREFIX}-fx-usd-vnd-20260325`,
  projects: {
    p1: `${ID_PREFIX}-project-001`,
    p2: `${ID_PREFIX}-project-002`,
    p3: `${ID_PREFIX}-project-003`,
    p4: `${ID_PREFIX}-project-004`,
    p5: `${ID_PREFIX}-project-005`,
  },
  quotations: {
    q1: `${ID_PREFIX}-quotation-001`,
    q2: `${ID_PREFIX}-quotation-002`,
  },
  supplierQuote: `${ID_PREFIX}-supplierquote-001`,
  pricing: {
    pq1: `${ID_PREFIX}-pricingq-001`,
    li1: `${ID_PREFIX}-pricingli-001`,
    li2: `${ID_PREFIX}-pricingli-002`,
    rc1: `${ID_PREFIX}-rentalcfg-001`,
    oc1: `${ID_PREFIX}-opcfg-001`,
    mp1: `${ID_PREFIX}-mainpart-001`,
    ce1: `${ID_PREFIX}-costentry-001`,
  },
  salesOrder: `${ID_PREFIX}-salesorder-001`,
  approval: `${ID_PREFIX}-approval-001`,
  doc: `${ID_PREFIX}-doc-001`,
  contract: `${ID_PREFIX}-contract-001`,
  appendix: `${ID_PREFIX}-appendix-001`,
  baseline: `${ID_PREFIX}-baseline-001`,
  procurement: `${ID_PREFIX}-proc-001`,
  inbound: `${ID_PREFIX}-inbound-001`,
  delivery: `${ID_PREFIX}-delivery-001`,
  milestone: `${ID_PREFIX}-milestone-001`,
  timeline: `${ID_PREFIX}-timeline-001`,
  chat: `${ID_PREFIX}-chat-001`,
  notification: `${ID_PREFIX}-notif-001`,
  outbox: `${ID_PREFIX}-outbox-001`,
  activity: `${ID_PREFIX}-activity-001`,
  systemSettingKey: `sample.batch.${BATCH_TAG}`,
};

async function main() {
  await initDb();
  const db = getDb();

  await db.exec('BEGIN');
  try {
    await db.run(
      `INSERT OR IGNORE INTO User
       (id, fullName, username, role, department, status, systemRole, employeeCode, accountStatus, mustChangePassword, language)
       VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, 'active', 0, 'vi')`,
      [ids.users.u1, 'Sample Nguyen Van Hung', 'sample.hung', 'Sales Manager', 'Sales', 'manager', 'SMP-E001']
    );
    await db.run(
      `INSERT OR IGNORE INTO User
       (id, fullName, username, role, department, status, systemRole, employeeCode, accountStatus, mustChangePassword, language)
       VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, 'active', 0, 'vi')`,
      [ids.users.u2, 'Sample Tran Thi Mai', 'sample.mai', 'Sales Executive', 'Sales', 'sales', 'SMP-E002']
    );
    await db.run(
      `INSERT OR IGNORE INTO User
       (id, fullName, username, role, department, status, systemRole, employeeCode, accountStatus, mustChangePassword, language)
       VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, 'active', 0, 'vi')`,
      [ids.users.u3, 'Sample Le Minh Tuan', 'sample.tuan', 'Technical Engineer', 'Technical', 'sales', 'SMP-E003']
    );
    await db.run(
      `INSERT OR IGNORE INTO User
       (id, fullName, username, role, department, status, systemRole, employeeCode, accountStatus, mustChangePassword, language)
       VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, 'active', 0, 'vi')`,
      [ids.users.u4, 'Sample Pham Thi Hoa', 'sample.hoa', 'Finance Officer', 'Finance', 'viewer', 'SMP-E004']
    );
    await db.run(
      `INSERT OR IGNORE INTO User
       (id, fullName, username, role, department, status, systemRole, employeeCode, accountStatus, mustChangePassword, language)
       VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, 'active', 0, 'vi')`,
      [ids.users.u5, 'Sample Hoang Duc Nam', 'sample.nam', 'Procurement Manager', 'Procurement', 'manager', 'SMP-E005']
    );

    await db.run(`INSERT OR IGNORE INTO SalesPerson (id, name, email, phone) VALUES (?, ?, ?, ?)`, [ids.salespersons.s1, 'Sample Tran Thi Mai', 'sample.mai@htg.local', '0900000001']);
    await db.run(`INSERT OR IGNORE INTO SalesPerson (id, name, email, phone) VALUES (?, ?, ?, ?)`, [ids.salespersons.s2, 'Sample Nguyen Van Hung', 'sample.hung@htg.local', '0900000002']);

    await db.run(
      `INSERT OR IGNORE INTO Account (id, companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.accounts.a1,
        'Sample Da Nang Port',
        'Central',
        'Logistics',
        'https://sample-danang-port.local',
        'SMP-TAX-001',
        'Da Nang',
        ids.users.u1,
        'Active',
        'Customer',
        'SMP-ACC-001',
        'SDP',
        `Sample customer account ${MARKER}`,
        BATCH_TAG,
        'VN',
      ]
    );
    await db.run(
      `INSERT OR IGNORE INTO Account (id, companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.accounts.a2,
        'Sample Nam Hai Terminal',
        'North',
        'Port',
        'https://sample-namhai.local',
        'SMP-TAX-002',
        'Hai Phong',
        ids.users.u2,
        'Active',
        'Customer',
        'SMP-ACC-002',
        'NHT',
        `Sample customer account ${MARKER}`,
        BATCH_TAG,
        'VN',
      ]
    );
    await db.run(
      `INSERT OR IGNORE INTO Account (id, companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.accounts.a3,
        'Sample HTG Internal',
        'HCM',
        'Internal',
        'https://sample-htg.local',
        'SMP-TAX-003',
        'Ho Chi Minh',
        ids.users.u1,
        'Active',
        'Customer',
        'SMP-ACC-003',
        'HTG-I',
        `Sample internal account ${MARKER}`,
        BATCH_TAG,
        'VN',
      ]
    );
    await db.run(
      `INSERT OR IGNORE INTO Account (id, companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.accounts.s1,
        'Sample Komatsu Supplier',
        'Japan',
        'Heavy Equipment',
        'https://sample-komatsu-supplier.local',
        'SMP-TAX-S01',
        'Tokyo',
        ids.users.u5,
        'Active',
        'Supplier',
        'SMP-SUP-001',
        'KMS',
        `Sample supplier account ${MARKER}`,
        BATCH_TAG,
        'JP',
      ]
    );

    await db.run(
      `INSERT OR IGNORE INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ids.contacts.c1, ids.accounts.a1, 'Nguyen', 'An', 'Procurement', 'Manager', 'male', 'an.nguyen@sample-danang-port.local', '0911000001', 1]
    );
    await db.run(
      `INSERT OR IGNORE INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ids.contacts.c2, ids.accounts.a2, 'Tran', 'Binh', 'Operations', 'Deputy Director', 'male', 'binh.tran@sample-namhai.local', '0911000002', 1]
    );

    await db.run(
      `INSERT OR IGNORE INTO Lead (id, companyName, contactName, email, phone, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ids.leads.l1, 'Sample New Port Opportunity', 'Le Van Cuong', 'cuong.lead@sample.local', '0922000001', 'Qualified', 'Referral']
    );

    await db.run(
      `INSERT OR IGNORE INTO Product (id, sku, name, category, unit, basePrice, currency, specifications, technicalSpecs, media, qbuData, status, qbuRateSource, qbuRateDate, qbuRateValue)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.products.p1,
        'SMP-SHACMAN-X3000',
        'Sample Shacman X3000 Tractor Head',
        'Vehicle',
        'unit',
        1800000000,
        'VND',
        '6x4 tractor head',
        '{}',
        '[]',
        '{}',
        'available',
        'manual',
        '2026-03-25',
        25500,
      ]
    );
    await db.run(
      `INSERT OR IGNORE INTO Product (id, sku, name, category, unit, basePrice, currency, specifications, technicalSpecs, media, qbuData, status, qbuRateSource, qbuRateDate, qbuRateValue)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.products.p2,
        'SMP-KMT-PART-01',
        'Sample Komatsu Spare Part Kit',
        'Spare Part',
        'set',
        250000000,
        'VND',
        'Maintenance kit',
        '{}',
        '[]',
        '{}',
        'available',
        'manual',
        '2026-03-25',
        25500,
      ]
    );

    await db.run(
      `INSERT OR IGNORE INTO ExchangeRate (id, baseCurrency, quoteCurrency, effectiveDate, rateValue, source)
       VALUES (?, 'USD', 'VND', '2026-03-25', 25500, ?)`,
      [ids.exchangeRate, `seed-${BATCH_TAG}`]
    );

    await db.run(
      `INSERT OR IGNORE INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [ids.projects.p1, 'SMP-2026-001', 'Sample Shacman Fleet Delivery', `Project sample ${MARKER}`, ids.users.u1, ids.accounts.a1, 'delivery', '2026-01-15', '2026-06-30', 'active']
    );
    await db.run(
      `INSERT OR IGNORE INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [ids.projects.p2, 'SMP-2025-012', 'Sample Port Maintenance Q4', `Project sample ${MARKER}`, ids.users.u3, ids.accounts.a1, 'closed', '2025-10-01', '2025-12-31', 'completed']
    );
    await db.run(
      `INSERT OR IGNORE INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [ids.projects.p3, 'SMP-2026-002', 'Sample Komatsu Spare Parts Import', `Project sample ${MARKER}`, ids.users.u5, ids.accounts.a3, 'internal-review', '2026-02-01', '2026-04-30', 'active']
    );
    await db.run(
      `INSERT OR IGNORE INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [ids.projects.p4, 'SMP-2026-003', 'Sample Internal CRM Rollout', `Project sample ${MARKER}`, ids.users.u1, ids.accounts.a3, 'delivery', '2026-01-01', '2026-12-31', 'active']
    );
    await db.run(
      `INSERT OR IGNORE INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [ids.projects.p5, 'SMP-2026-004', 'Sample Volvo Quotation Project', `Project sample ${MARKER}`, ids.users.u2, ids.accounts.a2, 'quoting', '2026-04-01', '2026-09-30', 'pending']
    );

    await db.run(
      `INSERT OR IGNORE INTO Quotation
       (id, quoteNumber, quoteDate, subject, accountId, contactId, projectId, salesperson, salespersonPhone, currency, opportunityId, items, financialParams, terms, subtotal, taxTotal, grandTotal, status, validUntil, revisionNo, revisionLabel, changeReason, isWinningVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.quotations.q1,
        'SMP-QT-2026-001',
        '2026-03-20',
        `Sample quotation package ${MARKER}`,
        ids.accounts.a1,
        ids.contacts.c1,
        ids.projects.p1,
        'Sample Tran Thi Mai',
        '0900000001',
        'VND',
        ids.leads.l1,
        JSON.stringify([{ sku: 'SMP-SHACMAN-X3000', qty: 2, unitPrice: 1800000000 }]),
        JSON.stringify({ vatRate: 0.08 }),
        JSON.stringify({ payment: '30 days' }),
        3600000000,
        288000000,
        3888000000,
        'accepted',
        '2026-04-15',
        1,
        'R1',
        `Seed quotation ${MARKER}`,
        1,
      ]
    );
    await db.run(
      `INSERT OR IGNORE INTO Quotation
       (id, quoteNumber, quoteDate, subject, accountId, contactId, projectId, salesperson, salespersonPhone, currency, items, financialParams, terms, subtotal, taxTotal, grandTotal, status, validUntil, revisionNo, revisionLabel, changeReason, isWinningVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.quotations.q2,
        'SMP-QT-2026-002',
        '2026-03-22',
        `Sample quotation draft ${MARKER}`,
        ids.accounts.a2,
        ids.contacts.c2,
        ids.projects.p5,
        'Sample Nguyen Van Hung',
        '0900000002',
        'VND',
        JSON.stringify([{ sku: 'SMP-KMT-PART-01', qty: 10, unitPrice: 250000000 }]),
        JSON.stringify({ vatRate: 0.08 }),
        JSON.stringify({ payment: 'advance 30%' }),
        2500000000,
        200000000,
        2700000000,
        'draft',
        '2026-04-20',
        1,
        'R1',
        `Seed quotation ${MARKER}`,
        0,
      ]
    );

    await db.run(
      `INSERT OR IGNORE INTO SupplierQuote (id, supplierId, projectId, linkedQuotationId, category, quoteDate, validUntil, items, attachments, changeReason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ids.supplierQuote,
        ids.accounts.s1,
        ids.projects.p3,
        ids.quotations.q1,
        'parts',
        '2026-03-18',
        '2026-04-18',
        JSON.stringify([{ item: 'Sample spare part', qty: 50, price: 1200 }]),
        JSON.stringify([]),
        `Seed supplier quote ${MARKER}`,
        'active',
      ]
    );

    const taskRows = [
      ['001', ids.projects.p1, 'Prepare contract package', ids.users.u1, 'completed', 'high', 100, '2026-01-20', '2026-02-15', ids.accounts.a1, null, ids.quotations.q1, 'Sales'],
      ['002', ids.projects.p1, 'Track factory production timeline', ids.users.u5, 'active', 'high', 65, '2026-02-16', '2026-04-20', ids.accounts.a1, null, ids.quotations.q1, 'Procurement'],
      ['003', ids.projects.p1, 'Prepare customs checklist', ids.users.u4, 'pending', 'medium', 0, '2026-03-10', '2026-05-30', ids.accounts.a1, null, ids.quotations.q1, 'Finance'],
      ['004', ids.projects.p2, 'Inspect crane condition', ids.users.u3, 'completed', 'high', 100, '2025-10-05', '2025-10-20', ids.accounts.a1, null, null, 'Technical'],
      ['005', ids.projects.p2, 'Execute periodic maintenance', ids.users.u3, 'completed', 'high', 100, '2025-10-21', '2025-11-30', ids.accounts.a1, null, null, 'Technical'],
      ['006', ids.projects.p2, 'Issue acceptance report', ids.users.u1, 'completed', 'medium', 100, '2025-12-01', '2025-12-20', ids.accounts.a1, null, null, 'Sales'],
      ['007', ids.projects.p3, 'Contact Japan supplier', ids.users.u5, 'completed', 'high', 100, '2026-02-01', '2026-02-10', ids.accounts.s1, ids.leads.l1, null, 'Procurement'],
      ['008', ids.projects.p3, 'Negotiate payment terms', ids.users.u5, 'active', 'high', 70, '2026-02-11', '2026-03-15', ids.accounts.s1, ids.leads.l1, null, 'Procurement'],
      ['009', ids.projects.p3, 'Complete LC documents', ids.users.u4, 'pending', 'high', 0, '2026-03-12', '2026-04-01', ids.accounts.s1, null, null, 'Finance'],
      ['010', ids.projects.p4, 'Finalize CRM dashboard UI', ids.users.u2, 'completed', 'high', 100, '2026-01-10', '2026-01-31', ids.accounts.a3, null, null, 'Sales'],
      ['011', ids.projects.p4, 'Build leads and accounts module', ids.users.u3, 'completed', 'high', 100, '2026-02-01', '2026-02-28', ids.accounts.a3, null, null, 'Technical'],
      ['012', ids.projects.p4, 'Implement role-based access', ids.users.u1, 'active', 'high', 85, '2026-03-01', '2026-03-31', ids.accounts.a3, null, null, 'Sales'],
      ['013', ids.projects.p5, 'Gather customer technical requirements', ids.users.u2, 'active', 'medium', 45, '2026-03-25', '2026-04-15', ids.accounts.a2, ids.leads.l1, ids.quotations.q2, 'Sales'],
      ['014', ids.projects.p5, 'Request official quotation from OEM', ids.users.u5, 'pending', 'medium', 0, '2026-03-30', '2026-05-01', ids.accounts.s1, null, ids.quotations.q2, 'Procurement'],
      ['015', ids.projects.p5, 'Draft final quote to customer', ids.users.u2, 'pending', 'low', 0, '2026-04-02', '2026-06-01', ids.accounts.a2, null, ids.quotations.q2, 'Sales'],
    ];
    for (const row of taskRows) {
      const taskId = `${ID_PREFIX}-task-${row[0]}`;
      await db.run(
        `INSERT OR IGNORE INTO Task
         (id, projectId, name, assigneeId, status, priority, completionPct, startDate, dueDate, notes, accountId, leadId, quotationId, department, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [taskId, row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], `${MARKER} seed task`, row[9], row[10], row[11], row[12]]
      );
    }

    await db.run(
      `INSERT OR IGNORE INTO PricingQuotation
       (id, projectId, projectCode, customerName, supplierName, salePerson, changeReason, qbuType, batchNo, qbuWorkflowStage, date, vatRate, discountRate, citRate, tpcType, tpcRate, sellFxRate, buyFxRate, loanInterestDays, loanInterestRate)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'INITIAL', 1, 'submitted', ?, 0.08, 0.02, 0.2, 'standard', 0, 25500, 26300, 240, 0.08)`,
      [
        ids.pricing.pq1,
        ids.projects.p1,
        'SMP-2026-001',
        'Sample Da Nang Port',
        'Sample Komatsu Supplier',
        'Sample Tran Thi Mai',
        `Seed pricing quotation ${MARKER}`,
        '2026-03-25',
      ]
    );
    await db.run(
      `INSERT OR IGNORE INTO PricingLineItem
       (id, quotationId, sortOrder, section, description, quantityLabel, unitCount, costRoutingType, sellUnitPriceVnd, buyUnitPriceVnd, buyUnitPriceUsd)
       VALUES (?, ?, 1, 'equipment', ?, '2 units', 2, 'direct', 1950000000, 1800000000, 70000)`,
      [ids.pricing.li1, ids.pricing.pq1, `Sample tractor head line ${MARKER}`]
    );
    await db.run(
      `INSERT OR IGNORE INTO PricingLineItem
       (id, quotationId, sortOrder, section, description, quantityLabel, unitCount, costRoutingType, sellUnitPriceVnd, buyUnitPriceVnd, buyUnitPriceUsd)
       VALUES (?, ?, 2, 'service', ?, '1 package', 1, 'indirect', 150000000, 90000000, 3500)`,
      [ids.pricing.li2, ids.pricing.pq1, `Sample implementation service ${MARKER}`]
    );
    await db.run(`INSERT OR IGNORE INTO PricingRentalConfig (id, quotationId, investmentQty) VALUES (?, ?, 2)`, [ids.pricing.rc1, ids.pricing.pq1]);
    await db.run(`INSERT OR IGNORE INTO PricingOperationConfig (id, quotationId, pmIntervalsHours) VALUES (?, ?, ?)`, [ids.pricing.oc1, ids.pricing.pq1, JSON.stringify([500, 1000, 2000])]);
    await db.run(
      `INSERT OR IGNORE INTO PricingMaintenancePart
       (id, quotationId, sortOrder, systemName, itemDescription, modelSpec, unit, qty, unitPriceVnd, level500h, level1000h, note)
       VALUES (?, ?, 1, 'Engine', 'Sample oil filter set', 'X3000', 'set', 4, 3500000, 1, 1, ?)`,
      [ids.pricing.mp1, ids.pricing.pq1, `Sample maintenance part ${MARKER}`]
    );
    await db.run(
      `INSERT OR IGNORE INTO PricingCostEntry
       (id, pricingQuotationId, lineItemId, entryType, amountVnd, quantity, note, recordedAt, recordedBy)
       VALUES (?, ?, ?, 'actual', 450000000, 1, ?, '2026-03-25', ?)`,
      [ids.pricing.ce1, ids.pricing.pq1, ids.pricing.li1, `Seed cost entry ${MARKER}`, ids.users.u4]
    );

    await db.run(
      `INSERT OR IGNORE INTO SalesOrder
       (id, orderNumber, quotationId, accountId, status, currency, items, subtotal, taxTotal, grandTotal, notes)
       VALUES (?, 'SMP-SO-2026-001', ?, ?, 'confirmed', 'VND', ?, 3600000000, 288000000, 3888000000, ?)`,
      [ids.salesOrder, ids.quotations.q1, ids.accounts.a1, JSON.stringify([{ item: 'Sample tractor head', qty: 2 }]), `Sales order generated from seed ${MARKER}`]
    );

    await db.run(
      `INSERT OR IGNORE INTO ApprovalRequest
       (id, projectId, quotationId, pricingQuotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate, note)
       VALUES (?, ?, ?, ?, 'qbu-approval', ?, 'Finance', ?, 'cfo', ?, 'pending', '2026-03-28', ?)`,
      [ids.approval, ids.projects.p1, ids.quotations.q1, ids.pricing.pq1, `Sample QBU approval ${MARKER}`, ids.users.u2, ids.users.u4, `Approval seeded ${MARKER}`]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectDocument
       (id, projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage, note, receivedAt)
       VALUES (?, ?, ?, 'SMP-DOC-001', 'Sample contract package', 'Contract', 'Sales', 'received', 'delivery', ?, '2026-03-25')`,
      [ids.doc, ids.projects.p1, ids.quotations.q1, `Project document seeded ${MARKER}`]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectContract
       (id, projectId, quotationId, contractNumber, title, signedDate, effectiveDate, status, currency, totalValue, summary, lineItems, createdBy)
       VALUES (?, ?, ?, 'SMP-CT-001', ?, '2026-03-24', '2026-03-25', 'active', 'VND', 3888000000, ?, ?, ?)`,
      [
        ids.contract,
        ids.projects.p1,
        ids.quotations.q1,
        `Sample project contract ${MARKER}`,
        `Contract generated from sample quote ${MARKER}`,
        JSON.stringify([{ line: 1, item: 'Tractor head', qty: 2, value: 3888000000 }]),
        ids.users.u1,
      ]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectContractAppendix
       (id, projectId, contractId, appendixNumber, title, signedDate, effectiveDate, status, totalDeltaValue, summary, lineItems, createdBy)
       VALUES (?, ?, ?, 'SMP-APX-001', ?, '2026-03-26', '2026-03-26', 'active', 120000000, ?, ?, ?)`,
      [
        ids.appendix,
        ids.projects.p1,
        ids.contract,
        `Sample appendix #1 ${MARKER}`,
        `Scope update for transport and installation ${MARKER}`,
        JSON.stringify([{ line: 1, item: 'Additional installation', value: 120000000 }]),
        ids.users.u1,
      ]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectExecutionBaseline
       (id, projectId, sourceType, sourceId, baselineNo, title, effectiveDate, currency, totalValue, lineItems, isCurrent, createdBy)
       VALUES (?, ?, 'contract', ?, 1, ?, '2026-03-25', 'VND', 4008000000, ?, 1, ?)`,
      [
        ids.baseline,
        ids.projects.p1,
        ids.contract,
        `Baseline from contract ${MARKER}`,
        JSON.stringify([{ key: 'L1', itemCode: 'TRUCK', qty: 2, value: 4008000000 }]),
        ids.users.u1,
      ]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectProcurementLine
       (id, projectId, baselineId, sourceLineKey, itemCode, itemName, description, unit, contractQty, orderedQty, receivedQty, deliveredQty, shortageQty, shortageStatus, supplierId, poNumber, etaDate, committedDeliveryDate, status, note)
       VALUES (?, ?, ?, 'L1', 'TRUCK', 'Sample tractor head', ?, 'unit', 2, 2, 1, 0, 1, 'open', ?, 'SMP-PO-001', '2026-04-15', '2026-04-25', 'ordered', ?)`,
      [ids.procurement, ids.projects.p1, ids.baseline, `Procurement line ${MARKER}`, ids.accounts.s1, `Procurement line seeded ${MARKER}`]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectInboundLine
       (id, projectId, procurementLineId, baselineId, sourceLineKey, receivedQty, etaDate, actualReceivedDate, status, receiptRef, note, createdBy)
       VALUES (?, ?, ?, ?, 'L1', 1, '2026-04-15', '2026-04-16', 'received', 'SMP-PNK-001', ?, ?)`,
      [ids.inbound, ids.projects.p1, ids.procurement, ids.baseline, `Inbound line seeded ${MARKER}`, ids.users.u4]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectDeliveryLine
       (id, projectId, procurementLineId, baselineId, sourceLineKey, deliveredQty, committedDate, actualDeliveryDate, status, deliveryRef, note, createdBy)
       VALUES (?, ?, ?, ?, 'L1', 1, '2026-04-25', NULL, 'scheduled', 'SMP-PXK-001', ?, ?)`,
      [ids.delivery, ids.projects.p1, ids.procurement, ids.baseline, `Delivery line seeded ${MARKER}`, ids.users.u2]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectMilestone
       (id, projectId, milestoneType, title, plannedDate, actualDate, status, note, createdBy)
       VALUES (?, ?, 'delivery', ?, '2026-04-25', NULL, 'pending', ?, ?)`,
      [ids.milestone, ids.projects.p1, `Vehicle handover milestone ${MARKER}`, `Milestone seeded ${MARKER}`, ids.users.u1]
    );

    await db.run(
      `INSERT OR IGNORE INTO ProjectTimelineEvent
       (id, projectId, eventType, title, description, eventDate, entityType, entityId, payload, createdBy)
       VALUES (?, ?, 'seed', ?, ?, '2026-03-25', 'Project', ?, ?, ?)`,
      [
        ids.timeline,
        ids.projects.p1,
        `Seed timeline event ${MARKER}`,
        `Generated by seed script for full-database testing ${MARKER}`,
        ids.projects.p1,
        JSON.stringify({ batchTag: BATCH_TAG }),
        ids.users.u1,
      ]
    );

    await db.run(
      `INSERT OR IGNORE INTO ChatMessage (id, userId, content, readAt)
       VALUES (?, ?, ?, NULL)`,
      [ids.chat, ids.users.u2, `Sample chat message ${MARKER}`]
    );

    await db.run(
      `INSERT OR IGNORE INTO Notification (id, userId, content, entityType, entityId, link, readAt)
       VALUES (?, ?, ?, 'Project', ?, '/projects', NULL)`,
      [ids.notification, ids.users.u1, `Sample notification ${MARKER}`, ids.projects.p1]
    );

    await db.run(
      `INSERT OR IGNORE INTO ErpOutbox
       (id, dedupeKey, eventType, entityType, entityId, payload, status, attempts, nextRunAt, sentAt)
       VALUES (?, ?, 'sales_order_created', 'SalesOrder', ?, ?, 'pending', 0, datetime('now', '+5 minute'), NULL)`,
      [
        ids.outbox,
        `${BATCH_TAG}:salesorder:${ids.salesOrder}`,
        ids.salesOrder,
        JSON.stringify({ salesOrderId: ids.salesOrder, batchTag: BATCH_TAG }),
      ]
    );

    await db.run(
      `INSERT OR IGNORE INTO Activity
       (id, title, description, category, icon, color, iconColor, entityId, entityType, link)
       VALUES (?, ?, ?, 'Seed', 'flask', '#eff6ff', '#1d4ed8', ?, 'Project', '/projects')`,
      [ids.activity, `Sample seed activity ${BATCH_TAG}`, `Full database sample seeded ${MARKER}`, ids.projects.p1]
    );

    await db.run(
      `INSERT OR REPLACE INTO SystemSetting (key, value)
       VALUES (?, ?)`,
      [ids.systemSettingKey, JSON.stringify({ batchTag: BATCH_TAG, idPrefix: ID_PREFIX, marker: MARKER, seededAt: new Date().toISOString() })]
    );

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }

  const counters: Record<string, number> = {};
  const countByIdLike = async (table: string) => {
    const row = await db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table} WHERE id LIKE ?`, [`${ID_PREFIX}-%`]);
    return row?.c || 0;
  };
  const countByMarker = async (table: string, col: string) => {
    const row = await db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table} WHERE ${col} LIKE ?`, [`%${MARKER}%`]);
    return row?.c || 0;
  };

  counters.User = await countByIdLike('User');
  counters.Account = await countByIdLike('Account');
  counters.Contact = await countByIdLike('Contact');
  counters.Lead = await countByIdLike('Lead');
  counters.Product = await countByIdLike('Product');
  counters.ExchangeRate = await countByIdLike('ExchangeRate');
  counters.Project = await countByIdLike('Project');
  counters.Task = await countByIdLike('Task');
  counters.Quotation = await countByIdLike('Quotation');
  counters.SupplierQuote = await countByIdLike('SupplierQuote');
  counters.PricingQuotation = await countByIdLike('PricingQuotation');
  counters.PricingLineItem = await countByIdLike('PricingLineItem');
  counters.PricingRentalConfig = await countByIdLike('PricingRentalConfig');
  counters.PricingOperationConfig = await countByIdLike('PricingOperationConfig');
  counters.PricingMaintenancePart = await countByIdLike('PricingMaintenancePart');
  counters.PricingCostEntry = await countByIdLike('PricingCostEntry');
  counters.SalesOrder = await countByIdLike('SalesOrder');
  counters.ApprovalRequest = await countByIdLike('ApprovalRequest');
  counters.ProjectDocument = await countByIdLike('ProjectDocument');
  counters.ProjectContract = await countByIdLike('ProjectContract');
  counters.ProjectContractAppendix = await countByIdLike('ProjectContractAppendix');
  counters.ProjectExecutionBaseline = await countByIdLike('ProjectExecutionBaseline');
  counters.ProjectProcurementLine = await countByIdLike('ProjectProcurementLine');
  counters.ProjectInboundLine = await countByIdLike('ProjectInboundLine');
  counters.ProjectDeliveryLine = await countByIdLike('ProjectDeliveryLine');
  counters.ProjectMilestone = await countByIdLike('ProjectMilestone');
  counters.ProjectTimelineEvent = await countByIdLike('ProjectTimelineEvent');
  counters.SalesPerson = await countByIdLike('SalesPerson');
  counters.ChatMessage = await countByIdLike('ChatMessage');
  counters.Notification = await countByIdLike('Notification');
  counters.ErpOutbox = await countByIdLike('ErpOutbox');
  counters.Activity = await countByIdLike('Activity');
  counters.SystemSetting = (
    await db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM SystemSetting WHERE key LIKE ?`,
      [`sample.batch.${BATCH_TAG}%`]
    )
  )?.c || 0;
  counters.MarkedTasks = await countByMarker('Task', 'notes');

  console.log('Full sample data seeded');
  console.log(JSON.stringify({ batchTag: BATCH_TAG, idPrefix: ID_PREFIX, marker: MARKER, counters }, null, 2));
}

main().catch((error) => {
  console.error('[seed-sample-data] Error:', error?.message || error);
  process.exit(1);
});

