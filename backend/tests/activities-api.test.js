require('ts-node/register');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-activities-'));
process.env.DB_PATH = path.join(tempDir, 'crm-activities.db');

const { initDb, getDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let failures = 0;
let seeded;

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

async function createUser({ fullName, username, password, systemRole }) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  await db.run(
    `INSERT INTO User (
      fullName, gender, email, phone, role, department, status,
      username, passwordHash, systemRole, accountStatus, mustChangePassword, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fullName,
      'unknown',
      `${username}@example.com`,
      '',
      systemRole,
      'CRM',
      'Active',
      username,
      passwordHash,
      systemRole,
      'active',
      0,
      'vi',
    ]
  );

  return db.get(`SELECT id FROM User WHERE username = ?`, [username]);
}

async function seedActivities() {
  const db = getDb();
  await db.run('DELETE FROM Activity');

  const accountId = 100001;
  const contactId = 200001;

  await db.run(
    `INSERT INTO Account (id, companyName, shortName, status, accountType)
     VALUES (?, ?, ?, ?, ?)`,
    [accountId, 'Acme Corporation', 'ACME', 'Active', 'Customer']
  );

  await db.run(
    `INSERT INTO Contact (id, accountId, lastName, firstName, gender)
     VALUES (?, ?, ?, ?, ?)`,
    [contactId, accountId, 'Nguyen', 'An', 'male']
  );

  const accountActivityInsert = await db.run(
    `INSERT INTO Activity (title, description, category, icon, color, iconColor, entityId, entityType, link, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Account follow-up', 'Account note', 'Account', 'office', '#fff', '#000', accountId, 'Account', 'Customers', '2026-01-01 09:00:00']
  );

  const contactActivityInsert = await db.run(
    `INSERT INTO Activity (title, description, category, icon, color, iconColor, entityId, entityType, link, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Contact follow-up', 'Contact note', 'Contact', 'user', '#fff', '#000', contactId, 'Contact', 'Customers', '2026-01-02 09:00:00']
  );

  const genericActivityInsert = await db.run(
    `INSERT INTO Activity (title, description, category, icon, color, iconColor, entityId, entityType, link, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['General note', 'General note', 'General', 'note', '#fff', '#000', null, null, 'Dashboard', '2026-01-03 09:00:00']
  );

  return {
    accountId,
    contactId,
    accountActivityId: accountActivityInsert.lastID,
    contactActivityId: contactActivityInsert.lastID,
    genericActivityId: genericActivityInsert.lastID,
  };
}

async function setup() {
  await initDb();
  await createUser({
    fullName: 'Activities Viewer',
    username: 'activities.viewer',
    password: 'Viewer@123',
    systemRole: 'viewer',
  });
  seeded = await seedActivities();

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

  await run('activities list returns enriched entity display and honors limit', async () => {
    const list = await api('/api/activities?limit=1');
    assert.equal(list.response.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].id, seeded.genericActivityId);

    const accountActivities = await api(`/api/activities?entityId=${seeded.accountId}&limit=5`);
    assert.equal(accountActivities.response.status, 200);
    assert.equal(accountActivities.body.length, 2);
    assert.equal(accountActivities.body.some((activity) => activity.entityDisplay === 'ACME'), true);

    const contactActivities = await api(`/api/activities?entityId=${seeded.contactId}&limit=5`);
    assert.equal(contactActivities.response.status, 200);
    assert.equal(contactActivities.body.length, 2);
    assert.equal(contactActivities.body.some((activity) => activity.entityDisplay === 'Nguyen An - ACME'), true);
  });

  await run('only admin or manager can create activities', async () => {
    const viewerAuth = await login('activities.viewer', 'Viewer@123');
    const adminAuth = await login('admin', 'admin123');
    assert.equal(viewerAuth.response.status, 200);
    assert.equal(adminAuth.response.status, 200);

    const forbidden = await api('/api/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerAuth.body.token}`,
      },
      body: JSON.stringify({
        title: 'Blocked activity',
        description: 'Viewer should not create this',
      }),
    });
    assert.equal(forbidden.response.status, 403);

    const created = await api('/api/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.body.token}`,
      },
      body: JSON.stringify({
        title: 'Admin activity',
        description: 'Created by admin',
        category: 'Admin',
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.title, 'Admin activity');
    assert.equal(created.body.description, 'Created by admin');
    assert.equal(created.body.category, 'Admin');
  });

  await teardown();
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await teardown();
  process.exitCode = 1;
});
