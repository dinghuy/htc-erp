require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-security-hardening-'));
process.env.DB_PATH = path.join(tempDir, 'crm-security-hardening.db');
process.env.JWT_SECRET = 'test-secret';
process.env.BOOTSTRAP_DEFAULT_ADMIN_PASSWORD = '';

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

async function seedUser({ username, password, systemRole, roleCodes, fullName }) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  await db.run(
    `INSERT INTO User (
      id, fullName, gender, email, phone, role, department, status,
      username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      fullName,
      'male',
      `${username}@example.com`,
      '',
      systemRole,
      'Operations',
      'Active',
      username,
      passwordHash,
      systemRole,
      JSON.stringify(roleCodes),
      'active',
      0,
      'vi',
    ],
  );
  return id;
}

async function login(username, password) {
  return api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

function bearer(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function setup() {
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

  await run('initDb does not auto-seed default admin when bootstrap password is missing', async () => {
    const db = getDb();
    const adminUser = await db.get("SELECT id FROM User WHERE username = 'admin'");
    assert.equal(adminUser, undefined);
  });

  await run('protected reporting and salesperson reads reject unauthenticated access', async () => {
    const protectedRoutes = [
      '/api/salespersons',
      '/api/stats',
      '/api/search?q=alpha',
      '/api/reports/revenue',
      '/api/reports/funnel',
      '/api/ops/summary',
      '/api/reports/handoff-activation',
    ];

    for (const pathname of protectedRoutes) {
      const result = await api(pathname);
      assert.equal(result.response.status, 401, pathname);
    }
  });

  await run('manager can manage salespersons while sales is restricted to read-only access', async () => {
    const db = getDb();
    const seededSalespersonId = uuidv4();
    await db.run(
      `INSERT INTO User (
        id, fullName, gender, email, phone, role, department, status,
        username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        seededSalespersonId,
        'Existing Salesperson',
        'male',
        'existing.salesperson@example.com',
        '0900000000',
        'Salesperson',
        'Sales',
        'Active',
        null,
        null,
        'sales',
        JSON.stringify(['sales']),
        'active',
        0,
        'vi',
      ],
    );

    await seedUser({
      username: 'route_manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Route Manager',
    });
    await seedUser({
      username: 'route_sales',
      password: 'Sales@123',
      systemRole: 'sales',
      roleCodes: ['sales'],
      fullName: 'Route Sales',
    });

    const managerLogin = await login('route_manager', 'Manager@123');
    const salesLogin = await login('route_sales', 'Sales@123');
    assert.equal(managerLogin.response.status, 200);
    assert.equal(salesLogin.response.status, 200);

    const managerStats = await api('/api/stats', {
      headers: { Authorization: `Bearer ${managerLogin.body.token}` },
    });
    assert.equal(managerStats.response.status, 200);
    assert.equal(typeof managerStats.body, 'object');

    const managerSearch = await api('/api/search?q=existing', {
      headers: { Authorization: `Bearer ${managerLogin.body.token}` },
    });
    assert.equal(managerSearch.response.status, 200);

    const managerList = await api('/api/salespersons', {
      headers: { Authorization: `Bearer ${managerLogin.body.token}` },
    });
    assert.equal(managerList.response.status, 200);
    assert.equal(Array.isArray(managerList.body), true);
    assert.ok(managerList.body.some((item) => item.id === seededSalespersonId));

    const salesList = await api('/api/salespersons', {
      headers: { Authorization: `Bearer ${salesLogin.body.token}` },
    });
    assert.equal(salesList.response.status, 200);
    assert.equal(Array.isArray(salesList.body), true);

    const forbiddenCreate = await api('/api/salespersons', {
      method: 'POST',
      headers: bearer(salesLogin.body.token),
      body: JSON.stringify({ name: 'Sales Blocked', email: 'blocked@example.com', phone: '0911111111' }),
    });
    assert.equal(forbiddenCreate.response.status, 403);

    const managerCreate = await api('/api/salespersons', {
      method: 'POST',
      headers: bearer(managerLogin.body.token),
      body: JSON.stringify({ name: 'Manager Created', email: 'manager.created@example.com', phone: '0922222222' }),
    });
    assert.equal(managerCreate.response.status, 201);
    assert.equal(managerCreate.body.name, 'Manager Created');
    const createdUser = await db.get('SELECT id, username, systemRole, roleCodes, department FROM User WHERE id = ?', [managerCreate.body.id]);
    assert.ok(createdUser);
    assert.equal(createdUser.username, null);
    assert.equal(createdUser.systemRole, 'sales');
    assert.equal(createdUser.department, 'Sales');
    assert.equal(createdUser.roleCodes, JSON.stringify(['sales']));

    const forbiddenDelete = await api(`/api/salespersons/${seededSalespersonId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${salesLogin.body.token}` },
    });
    assert.equal(forbiddenDelete.response.status, 403);

    const managerDelete = await api(`/api/salespersons/${managerCreate.body.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerLogin.body.token}` },
    });
    assert.equal(managerDelete.response.status, 200);
    assert.equal(managerDelete.body.success, true);
    const deletedUser = await db.get('SELECT id FROM User WHERE id = ?', [managerCreate.body.id]);
    assert.equal(deletedUser, undefined);
  });

  await teardown();

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  failures += 1;
  console.error(error);
  await teardown().catch(() => {});
  process.exitCode = 1;
});
