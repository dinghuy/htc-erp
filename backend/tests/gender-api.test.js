require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-gender-'));
process.env.DB_PATH = path.join(tempDir, 'crm-gender.db');

const { initDb, getDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let failures = 0;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

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

async function login(username, password) {
  return api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

async function resetDatabaseWithLegacyGender() {
  const db = await open({
    filename: process.env.DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS Account;
    DROP TABLE IF EXISTS User;
    DROP TABLE IF EXISTS Contact;
    CREATE TABLE Account (
      id TEXT PRIMARY KEY,
      companyName TEXT,
      assignedTo TEXT,
      accountType TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE User (
      id TEXT PRIMARY KEY,
      fullName TEXT,
      gender TEXT,
      email TEXT,
      phone TEXT,
      role TEXT,
      department TEXT,
      status TEXT DEFAULT 'Active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      username TEXT,
      passwordHash TEXT,
      systemRole TEXT DEFAULT 'viewer'
    );
    CREATE TABLE Contact (
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
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.run(
    `INSERT INTO Account (id, companyName, assignedTo, accountType, status) VALUES (?, ?, ?, ?, ?)`,
    ['account-1', 'Fixture Account', null, 'Customer', 'active']
  );

  await db.run(
    `INSERT INTO User (id, fullName, gender, email, phone, role, department, status, username, passwordHash, systemRole)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['legacy-user-1', 'Legacy Male', 'Nam', 'legacy.male@example.com', '', 'Sales', 'KD', 'Active', 'legacy.male', null, 'viewer']
  );
  await db.run(
    `INSERT INTO User (id, fullName, gender, email, phone, role, department, status, username, passwordHash, systemRole)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['legacy-user-2', 'Legacy Female', 'F', 'legacy.female@example.com', '', 'HR', 'HCNS', 'Active', 'legacy.female', null, 'viewer']
  );
  await db.run(
    `INSERT INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['legacy-contact-1', 'account-1', 'Nguyen', 'An', 'Purchasing', 'Manager', 'Mr', 'legacy.contact@example.com', '0900000000', 1]
  );
  await db.run(
    `INSERT INTO Contact (id, accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['legacy-contact-2', 'account-1', 'Tran', 'Binh', 'Ops', 'Staff', '', 'legacy.contact2@example.com', '0900000001', 0]
  );

  await db.close();
}

async function setup() {
  await resetDatabaseWithLegacyGender();
  await initDb();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
}

async function teardown() {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function main() {
  await setup();

  await run('initDb backfills legacy user/contact genders to canonical values', async () => {
    const db = getDb();
    const users = await db.all('SELECT id, gender FROM User WHERE id IN (?, ?) ORDER BY id', ['legacy-user-1', 'legacy-user-2']);
    const contacts = await db.all('SELECT id, gender FROM Contact WHERE id IN (?, ?) ORDER BY id', ['legacy-contact-1', 'legacy-contact-2']);

    assert.deepEqual(users, [
      { id: 'legacy-user-1', gender: 'male' },
      { id: 'legacy-user-2', gender: 'female' },
    ]);
    assert.deepEqual(contacts, [
      { id: 'legacy-contact-1', gender: 'male' },
      { id: 'legacy-contact-2', gender: 'unknown' },
    ]);
  });

  await run('creating a user normalizes legacy gender input and API output', async () => {
    const auth = await login('admin', 'admin123');
    assert.equal(auth.response.status, 200);

    const created = await api('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.body.token}`,
      },
      body: JSON.stringify({
        fullName: 'Normalized User',
        gender: 'Nữ',
        email: 'normalized.user@example.com',
        phone: '0900111222',
        role: 'Staff',
        department: 'HCNS',
        systemRole: 'viewer',
      }),
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.body.gender, 'female');
  });

  await run('creating and updating contacts normalizes legacy gender input', async () => {
    const auth = await login('admin', 'admin123');
    assert.equal(auth.response.status, 200);

    const created = await api('/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.body.token}`,
      },
      body: JSON.stringify({
        accountId: 'account-1',
        lastName: 'Pham',
        firstName: 'Cuong',
        department: 'Sales',
        jobTitle: 'Rep',
        gender: 'M',
        email: 'contact.created@example.com',
        phone: '0900999888',
      }),
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.body.gender, 'male');

    const updated = await api(`/api/contacts/${created.body.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.body.token}`,
      },
      body: JSON.stringify({
        ...created.body,
        gender: 'Nu',
      }),
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.gender, 'female');
  });

  await teardown();

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  failures += 1;
  console.error(error);
  await teardown();
  process.exitCode = 1;
});
