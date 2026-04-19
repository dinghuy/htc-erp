require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-auth-'));
process.env.DB_PATH = path.join(tempDir, 'crm-auth.db');

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

async function loginV1(username, password) {
  return api('/api/v1/auth/login', {
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

async function seedUser({
  username,
  password,
  systemRole,
  fullName,
}) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.run(
    `INSERT INTO User (
      fullName, gender, email, phone, role, department, status,
      username, passwordHash, systemRole, accountStatus, mustChangePassword, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fullName,
      'male',
      `${username}@example.com`,
      '',
      systemRole,
      'Ops',
      'Active',
      username,
      passwordHash,
      systemRole,
      'active',
      0,
      'vi',
    ]
  );
  return result.lastID;
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

  await run('default admin login requires password change on first login', async () => {
    const result = await login('admin', 'admin123');
    assert.equal(result.response.status, 200);
    assert.notEqual(result.body.user.id, null);
    assert.notEqual(result.body.user.id, '');
    assert.equal(result.body.user.username, 'admin');
    assert.equal(result.body.user.mustChangePassword, true);
    assert.match(result.body.token, /\S+/);
  });

  await run('v1 auth alias preserves login behavior', async () => {
    const result = await loginV1('admin', 'admin123');
    assert.equal(result.response.status, 200);
    assert.notEqual(result.body.user.id, null);
    assert.notEqual(result.body.user.id, '');
    assert.equal(result.body.user.username, 'admin');
    assert.equal(result.body.user.mustChangePassword, true);
    assert.match(result.body.token, /\S+/);
  });

  await run('login rejects missing credentials and wrong password', async () => {
    const missing = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' }),
    });
    assert.equal(missing.response.status, 400);

    const wrongPassword = await login('admin', 'wrong-password');
    assert.equal(wrongPassword.response.status, 401);
  });

  await run('forced password change succeeds without current password and rotates token', async () => {
    const firstLogin = await login('admin', 'admin123');
    assert.equal(firstLogin.response.status, 200);

    const forced = await api('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firstLogin.body.token}`,
      },
      body: JSON.stringify({
        currentPassword: '',
        newPassword: 'Admin@456',
        forceChange: true,
      }),
    });

    assert.equal(forced.response.status, 200);
    assert.equal(forced.body.user.mustChangePassword, false);
    assert.match(forced.body.token, /\S+/);
    assert.notEqual(forced.body.token, firstLogin.body.token);

    const oldPassword = await login('admin', 'admin123');
    assert.equal(oldPassword.response.status, 401);

    const newPassword = await login('admin', 'Admin@456');
    assert.equal(newPassword.response.status, 200);
    assert.equal(newPassword.body.user.mustChangePassword, false);
  });

  await run('regular password change requires the current password once force-change is cleared', async () => {
    const activeLogin = await login('admin', 'Admin@456');
    assert.equal(activeLogin.response.status, 200);
    assert.equal(activeLogin.body.user.mustChangePassword, false);

    const missingCurrent = await api('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeLogin.body.token}`,
      },
      body: JSON.stringify({ currentPassword: '', newPassword: 'Admin@789' }),
    });
    assert.equal(missingCurrent.response.status, 400);

    const wrongCurrent = await api('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeLogin.body.token}`,
      },
      body: JSON.stringify({ currentPassword: 'wrong-current', newPassword: 'Admin@789' }),
    });
    assert.equal(wrongCurrent.response.status, 401);

    const changed = await api('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeLogin.body.token}`,
      },
      body: JSON.stringify({ currentPassword: 'Admin@456', newPassword: 'Admin@789' }),
    });
    assert.equal(changed.response.status, 200);
    assert.equal(changed.body.user.mustChangePassword, false);
    assert.match(changed.body.token, /\S+/);

    const relogin = await login('admin', 'Admin@789');
    assert.equal(relogin.response.status, 200);
    assert.equal(relogin.body.user.mustChangePassword, false);
  });

  await run('user management endpoints require admin role for list and create', async () => {
    const pmUserId = await seedUser({
      username: 'pm-user',
      password: 'Pm@123456',
      systemRole: 'project_manager',
      fullName: 'Project Manager User',
    });

    const pmLogin = await login('pm-user', 'Pm@123456');
    assert.equal(pmLogin.response.status, 200);

    const listAttempt = await api('/api/users', {
      headers: { Authorization: `Bearer ${pmLogin.body.token}` },
    });
    assert.equal(listAttempt.response.status, 403);

    const directoryAttempt = await api('/api/users/directory', {
      headers: { Authorization: `Bearer ${pmLogin.body.token}` },
    });
    assert.equal(directoryAttempt.response.status, 200);
    assert.ok(Array.isArray(directoryAttempt.body));
    assert.equal(directoryAttempt.body.some((user) => Object.prototype.hasOwnProperty.call(user, 'accountStatus')), false);
    assert.equal(directoryAttempt.body.some((user) => Object.prototype.hasOwnProperty.call(user, 'roleCodes')), false);

    const selfReadAttempt = await api(`/api/users/${pmUserId}`, {
      headers: { Authorization: `Bearer ${pmLogin.body.token}` },
    });
    assert.equal(selfReadAttempt.response.status, 200);

    const adminReadAttempt = await api('/api/users/1', {
      headers: { Authorization: `Bearer ${pmLogin.body.token}` },
    });
    assert.equal(adminReadAttempt.response.status, 403);

    const createAttempt = await api('/api/users', {
      method: 'POST',
      headers: bearer(pmLogin.body.token),
      body: JSON.stringify({
        fullName: 'Unauthorized Create',
        username: 'unauthorized.create',
        password: 'Pass@123',
        systemRole: 'viewer',
      }),
    });
    assert.equal(createAttempt.response.status, 403);

    const updateAttempt = await api(`/api/users/${pmUserId}`, {
      method: 'PUT',
      headers: bearer(pmLogin.body.token),
      body: JSON.stringify({
        fullName: 'Unauthorized Update',
        systemRole: 'viewer',
      }),
    });
    assert.equal(updateAttempt.response.status, 403);

    const avatarAttempt = await api('/api/users/1/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmLogin.body.token}` },
    });
    assert.equal(avatarAttempt.response.status, 400);
  });

  await run('locked accounts cannot log in', async () => {
    const db = getDb();
    await db.run("UPDATE User SET accountStatus = 'locked' WHERE username = ?", ['admin']);

    const locked = await login('admin', 'Admin@789');
    assert.equal(locked.response.status, 403);

    await db.run("UPDATE User SET accountStatus = 'active' WHERE username = ?", ['admin']);
  });

  await run('language preferences update persists for the logged-in user', async () => {
    const activeLogin = await login('admin', 'Admin@789');
    assert.equal(activeLogin.response.status, 200);

    const updated = await api('/api/me/preferences', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeLogin.body.token}`,
      },
      body: JSON.stringify({ language: 'en' }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.user.language, 'en');

    const me = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeLogin.body.token}` },
    });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.language, 'en');
  });

  await run('project list and workspace detail require authentication', async () => {
    const adminLogin = await login('admin', 'Admin@789');
    assert.equal(adminLogin.response.status, 200);

    const created = await api('/api/projects', {
      method: 'POST',
      headers: bearer(adminLogin.body.token),
      body: JSON.stringify({
        code: 'AUTH-PRJ-001',
        name: 'Authenticated Project',
        projectStage: 'quoting',
      }),
    });
    assert.equal(created.response.status, 201);

    const listWithoutAuth = await api('/api/projects');
    assert.equal(listWithoutAuth.response.status, 401);

    const detailWithoutAuth = await api(`/api/projects/${created.body.id}`);
    assert.equal(detailWithoutAuth.response.status, 401);

    const listV1WithoutAuth = await api('/api/v1/projects');
    assert.equal(listV1WithoutAuth.response.status, 401);

    const listWithAuth = await api('/api/projects', {
      headers: { Authorization: `Bearer ${adminLogin.body.token}` },
    });
    assert.equal(listWithAuth.response.status, 200);

    const detailWithAuth = await api(`/api/projects/${created.body.id}`, {
      headers: { Authorization: `Bearer ${adminLogin.body.token}` },
    });
    assert.equal(detailWithAuth.response.status, 200);
    assert.equal(detailWithAuth.body.id, created.body.id);

    const detailV1WithAuth = await api(`/api/v1/projects/${created.body.id}`, {
      headers: { Authorization: `Bearer ${adminLogin.body.token}` },
    });
    assert.equal(detailV1WithAuth.response.status, 200);
    assert.equal(detailV1WithAuth.body.id, created.body.id);
  });

  await run('sales cannot create or update projects while manager can', async () => {
    await seedUser({
      username: 'manager_project',
      password: 'Manager@123',
      systemRole: 'manager',
      fullName: 'Project Manager',
    });
    await seedUser({
      username: 'sales_project',
      password: 'Sales@123',
      systemRole: 'sales',
      fullName: 'Project Sales',
    });

    const managerLogin = await login('manager_project', 'Manager@123');
    const salesLogin = await login('sales_project', 'Sales@123');
    assert.equal(managerLogin.response.status, 200);
    assert.equal(salesLogin.response.status, 200);

    const createdByManager = await api('/api/projects', {
      method: 'POST',
      headers: bearer(managerLogin.body.token),
      body: JSON.stringify({
        code: 'MGR-PRJ-001',
        name: 'Manager Created Project',
        projectStage: 'quoting',
      }),
    });
    assert.equal(createdByManager.response.status, 201);

    const createdBySales = await api('/api/projects', {
      method: 'POST',
      headers: bearer(salesLogin.body.token),
      body: JSON.stringify({
        code: 'SAL-PRJ-001',
        name: 'Sales Created Project',
        projectStage: 'quoting',
      }),
    });
    assert.equal(createdBySales.response.status, 403);

    const updatedByManager = await api(`/api/projects/${createdByManager.body.id}`, {
      method: 'PUT',
      headers: bearer(managerLogin.body.token),
      body: JSON.stringify({
        code: 'MGR-PRJ-001',
        name: 'Manager Updated Project',
        projectStage: 'delivery',
        status: 'active',
      }),
    });
    assert.equal(updatedByManager.response.status, 200);
    assert.equal(updatedByManager.body.name, 'Manager Updated Project');

    const updatedBySales = await api(`/api/projects/${createdByManager.body.id}`, {
      method: 'PUT',
      headers: bearer(salesLogin.body.token),
      body: JSON.stringify({
        code: 'MGR-PRJ-001',
        name: 'Sales Updated Project',
        projectStage: 'delivery',
        status: 'active',
      }),
    });
    assert.equal(updatedBySales.response.status, 403);
  });

  await run('ERP outbox route exposes idempotency and dead-letter metadata', async () => {
    const adminLogin = await login('admin', 'Admin@789');
    assert.equal(adminLogin.response.status, 200);

    const db = getDb();
    await db.run(
      `INSERT INTO ErpOutbox (dedupeKey, eventType, entityType, entityId, payload, status, attempts, lastError)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'dead-letter-key',
        'quotation.upsert',
        'Quotation',
        1,
        JSON.stringify({ quotationId: 'Q-001' }),
        'failed',
        5,
        'Permanent ERP failure',
      ]
    );

    const outbox = await api('/api/erp/outbox?status=dead-letter', {
      headers: { Authorization: `Bearer ${adminLogin.body.token}` },
    });

    assert.equal(outbox.response.status, 200);
    assert.equal(Array.isArray(outbox.body.items), true);
    assert.equal(outbox.body.items.length > 0, true);
    assert.equal(outbox.body.items[0].idempotencyKey, 'dead-letter-key');
    assert.equal(outbox.body.items[0].payloadVersion, 'v1');
    assert.equal(outbox.body.items[0].isDeadLetter, true);
    assert.equal(outbox.body.stats.deadLetter >= 1, true);
    assert.equal(outbox.body.query.status, 'dead_letter');
    assert.equal(outbox.body.policy.maxAttempts, 5);
    assert.equal(outbox.body.policy.payloadVersion, 'v1');
    assert.equal(outbox.body.policy.statusFilterAliases['dead-letter'], 'dead_letter');
    assert.equal(outbox.body.policy.retrySchedule.initialDelaySeconds, 30);
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
