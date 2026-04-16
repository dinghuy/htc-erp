require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-auth-id-repair-'));
process.env.DB_PATH = path.join(tempDir, 'crm-auth-id-repair.db');

const { repairMissingUserIds } = require('../src/persistence/sqlite/finalize.ts');

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

async function createLegacyUserSchemaWithNullAdminId() {
  const db = await open({
    filename: process.env.DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE User (
      id TEXT PRIMARY KEY,
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
      accountStatus TEXT DEFAULT 'active',
      mustChangePassword INTEGER DEFAULT 1,
      language TEXT DEFAULT 'vi'
    )
  `);

  await db.exec(`
    INSERT INTO User (
      id, fullName, gender, email, phone, role, department, status, username, passwordHash, systemRole, accountStatus, mustChangePassword, language
    )
    SELECT
      NULL,
      'Administrator',
      'male',
      'admin@huynhthy.com',
      '',
      'Administrator',
      'IT',
      'Active',
      'admin',
      '$2b$10$7cqUoB7sQIUR5su.jld4Wu6QH6Z0lrwGPkzk1IzTmA.GbmEaijSWm',
      'admin',
      'active',
      1,
      'vi'
  `);

  await db.close();
}

async function main() {
  await createLegacyUserSchemaWithNullAdminId();

  await run('repairMissingUserIds repairs null admin ids in legacy text primary key schemas', async () => {
    const db = await open({
      filename: process.env.DB_PATH,
      driver: sqlite3.Database,
    });

    const repaired = await repairMissingUserIds(db);
    const admin = await db.get(`SELECT id, username, passwordHash FROM User WHERE username = ?`, ['admin']);

    assert.equal(repaired, 1);
    assert.equal(typeof admin.id, 'string');
    assert.notEqual(admin.id.trim(), '');
    assert.match(admin.passwordHash, /^\$2[aby]\$/);

    await db.close();
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
