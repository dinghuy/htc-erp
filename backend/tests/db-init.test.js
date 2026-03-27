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
