require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-db-init-'));
process.env.DB_PATH = path.join(tempDir, 'crm-db-init.db');

const { initDb, getDb } = require('../sqlite-db.ts');

let failures = 0;

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

async function createLegacyPricingSchema() {
  const db = await open({
    filename: process.env.DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE PricingQuotation (
      id TEXT PRIMARY KEY,
      projectCode TEXT,
      customerName TEXT,
      supplierName TEXT,
      salePerson TEXT,
      date TEXT,
      vatRate REAL,
      discountRate REAL,
      citRate REAL,
      tpcType TEXT,
      tpcRate REAL,
      sellFxRate REAL,
      buyFxRate REAL,
      loanInterestDays REAL,
      loanInterestRate REAL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE Quotation (
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
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(
    `INSERT INTO Quotation (
      id, quoteNumber, quoteDate, subject, currency, items, financialParams, terms, subtotal, taxTotal, grandTotal, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'legacy-quotation-1',
      'Q-LEGACY-001',
      '2026-04-01',
      'Legacy quotation',
      'VND',
      JSON.stringify([
        {
          sku: 'SKU-001',
          name: 'Legacy item',
          unit: 'Chiếc',
          currency: 'USD',
          vatMode: 'included',
          vatRate: 10,
          technicalSpecs: 'Spec',
          remarks: 'Remark',
          quantity: 2,
          unitPrice: 125000,
        },
      ]),
      JSON.stringify({
        interestRate: 8.5,
        exchangeRate: 25400,
        loanTermMonths: 36,
        markup: 15,
        vatRate: 8,
        calculateTotals: false,
      }),
      JSON.stringify({
        remarks: 'Legacy remarks vi',
        remarksEn: 'Legacy remarks en',
        termItems: [
          {
            labelViPrint: 'Thanh toán',
            labelEn: 'Payment',
            textVi: '30/70',
            textEn: '30/70',
          },
        ],
      }),
      250000,
      20000,
      270000,
      'draft',
    ]
  );

  await db.close();
}

async function main() {
  await createLegacyPricingSchema();

  await run('initDb upgrades legacy PricingQuotation schema before creating project index', async () => {
    await initDb();
    const db = getDb();
    const cols = await db.all(`PRAGMA table_info('PricingQuotation')`);
    const colNames = cols.map((col) => col.name);
    assert.equal(colNames.includes('projectId'), true);
    assert.equal(colNames.includes('batchNo'), true);
    assert.equal(colNames.includes('investmentQty'), true);
    assert.equal(colNames.includes('depreciationMonths'), true);
    assert.equal(colNames.includes('rentPeriodMonths'), true);
    assert.equal(colNames.includes('workingDaysMonth'), true);
    assert.equal(colNames.includes('dailyHours'), true);
    assert.equal(colNames.includes('pmIntervalsHours'), true);

    const configTables = (await db.all(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('PricingRentalConfig', 'PricingOperationConfig')`
    )).map((row) => row.name);
    assert.deepEqual(configTables, []);
  });

  await run('initDb creates typed quotation child tables and backfills legacy quotation blobs', async () => {
    const db = getDb();
    const tableNames = (await db.all(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('QuotationLineItem', 'QuotationFinancialConfig', 'QuotationTermProfile', 'QuotationTermItem')`
    )).map((row) => row.name);

    assert.deepEqual(
      tableNames.sort(),
      ['QuotationLineItem', 'QuotationTermItem']
    );

    const quotationCols = await db.all(`PRAGMA table_info('Quotation')`);
    const quotationColNames = quotationCols.map((col) => col.name);
    assert.equal(quotationColNames.includes('interestRate'), true);
    assert.equal(quotationColNames.includes('exchangeRate'), true);
    assert.equal(quotationColNames.includes('loanTermMonths'), true);
    assert.equal(quotationColNames.includes('markup'), true);
    assert.equal(quotationColNames.includes('vatRate'), true);
    assert.equal(quotationColNames.includes('calculateTotals'), true);
    assert.equal(quotationColNames.includes('remarksVi'), true);
    assert.equal(quotationColNames.includes('remarksEn'), true);

    const lineItems = await db.all(
      `SELECT sku, name, unit, currency, vatMode, vatRate, technicalSpecs, remarks, quantity, unitPrice, isOption
       FROM QuotationLineItem
       WHERE quotationId = ?
       ORDER BY sortOrder ASC, createdAt ASC`,
      ['legacy-quotation-1']
    );
    assert.equal(lineItems.length, 1);
    assert.equal(lineItems[0].sku, 'SKU-001');
    assert.equal(lineItems[0].currency, 'USD');
    assert.equal(lineItems[0].vatMode, 'included');
    assert.equal(lineItems[0].vatRate, 10);
    assert.equal(lineItems[0].quantity, 2);
    assert.equal(lineItems[0].unitPrice, 125000);
    assert.equal(lineItems[0].isOption, 0);

    const quotationHeader = await db.get(
      `SELECT interestRate, exchangeRate, loanTermMonths, markup, vatRate, calculateTotals, remarksVi, remarksEn
       FROM Quotation
       WHERE id = ?`,
      ['legacy-quotation-1']
    );
    assert.equal(quotationHeader.interestRate, 8.5);
    assert.equal(quotationHeader.exchangeRate, 25400);
    assert.equal(quotationHeader.loanTermMonths, 36);
    assert.equal(quotationHeader.markup, 15);
    assert.equal(quotationHeader.vatRate, 8);
    assert.equal(quotationHeader.calculateTotals, 0);
    assert.equal(quotationHeader.remarksVi, 'Legacy remarks vi');
    assert.equal(quotationHeader.remarksEn, 'Legacy remarks en');

    const termItems = await db.all(
      `SELECT labelViPrint, labelEn, textVi, textEn
       FROM QuotationTermItem
       WHERE quotationId = ?
       ORDER BY sortOrder ASC, createdAt ASC`,
      ['legacy-quotation-1']
    );
    assert.equal(termItems.length, 1);
    assert.equal(termItems[0].labelViPrint, 'Thanh toán');
    assert.equal(termItems[0].textVi, '30/70');
  });

  await run('initDb creates database support indexes for project stage and approval ownership lookups', async () => {
    const db = getDb();

    const projectIndexes = await db.all(`PRAGMA index_list('Project')`);
    const approvalIndexes = await db.all(`PRAGMA index_list('ApprovalRequest')`);
    const salesOrderIndexes = await db.all(`PRAGMA index_list('SalesOrder')`);
    const taskIndexes = await db.all(`PRAGMA index_list('Task')`);
    const quotationIndexes = await db.all(`PRAGMA index_list('Quotation')`);
    const todoIndexes = await db.all(`PRAGMA index_list('ToDo')`);
    const projectDocumentIndexes = await db.all(`PRAGMA index_list('ProjectDocument')`);
    const accountIndexes = await db.all(`PRAGMA index_list('Account')`);
    const leadIndexes = await db.all(`PRAGMA index_list('Lead')`);

    const projectIndexNames = projectIndexes.map((row) => row.name);
    const approvalIndexNames = approvalIndexes.map((row) => row.name);
    const salesOrderIndexNames = salesOrderIndexes.map((row) => row.name);
    const taskIndexNames = taskIndexes.map((row) => row.name);
    const quotationIndexNames = quotationIndexes.map((row) => row.name);
    const todoIndexNames = todoIndexes.map((row) => row.name);
    const projectDocumentIndexNames = projectDocumentIndexes.map((row) => row.name);
    const accountIndexNames = accountIndexes.map((row) => row.name);
    const leadIndexNames = leadIndexes.map((row) => row.name);

    assert.equal(projectIndexNames.includes('idx_project_stage'), true);
    assert.equal(approvalIndexNames.includes('idx_approval_requested_by'), true);
    assert.equal(approvalIndexNames.includes('idx_approval_approver_user'), true);
    assert.equal(salesOrderIndexNames.includes('idx_salesorder_quotation'), true);
    assert.equal(taskIndexNames.includes('idx_task_project_status_due'), true);
    assert.equal(quotationIndexNames.includes('idx_quotation_project_latest'), true);
    assert.equal(todoIndexNames.includes('idx_todo_entity_done'), true);
    assert.equal(projectDocumentIndexNames.includes('idx_projectdocument_thread'), true);
    assert.equal(accountIndexNames.includes('idx_account_type_created'), true);
    assert.equal(leadIndexNames.includes('idx_lead_status_created'), true);
  });

  await run('initDb keeps ProjectMilestone as the only active milestone table', async () => {
    const db = getDb();
    const tables = await db.all(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Milestone', 'ProjectMilestone', 'SalesPerson')`
    );
    const tableNames = tables.map((row) => row.name).sort();
    assert.deepEqual(tableNames, ['ProjectMilestone']);
  });

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  failures += 1;
  console.error(error);
  process.exitCode = 1;
});
