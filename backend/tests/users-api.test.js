require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-users-'));
process.env.DB_PATH = path.join(tempDir, 'crm-users.db');

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

  await run('user management endpoints require admin role for list and create', async () => {
    const pmUserId = await seedUser({
      username: 'pm-user',
      password: 'Pm@123456',
      systemRole: 'project_manager',
      fullName: 'Project Manager User',
    });

    const adminReset = await api('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(await login('admin', 'admin123')).body.token}`,
      },
      body: JSON.stringify({
        currentPassword: '',
        newPassword: 'Admin@789',
        forceChange: true,
      }),
    });
    assert.equal(adminReset.response.status, 200);

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
        password: 'Pass@12345',
        role: 'Sales Executive',
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

  await run('admin user management validates email format, username uniqueness, import duplicates, and avatar size', async () => {
    const adminLogin = await login('admin', 'Admin@789');
    assert.equal(adminLogin.response.status, 200);

    const invalidEmailCreate = await api('/api/users', {
      method: 'POST',
      headers: bearer(adminLogin.body.token),
      body: JSON.stringify({
        fullName: 'Invalid Email User',
        email: 'invalid-email',
        username: 'invalid.email.user',
        password: 'Password@123',
        role: 'Sales Executive',
        systemRole: 'sales',
      }),
    });
    assert.equal(invalidEmailCreate.response.status, 400);
    assert.equal(invalidEmailCreate.body.code, 'INVALID_REQUEST_BODY');

    const duplicateUsernameCreate = await api('/api/users', {
      method: 'POST',
      headers: bearer(adminLogin.body.token),
      body: JSON.stringify({
        fullName: 'Duplicate Username User',
        email: 'dupe-create@example.com',
        username: 'admin',
        password: 'Password@123',
        role: 'Sales Executive',
        systemRole: 'sales',
      }),
    });
    assert.equal(duplicateUsernameCreate.response.status, 409);
    assert.equal(duplicateUsernameCreate.body.code, 'USERNAME_ALREADY_EXISTS');

    const updatableUserId = await seedUser({
      username: 'updatable-user',
      password: 'Updatable@123',
      systemRole: 'sales',
      fullName: 'Updatable User',
    });

    const duplicateUsernameUpdate = await api(`/api/users/${updatableUserId}`, {
      method: 'PUT',
      headers: bearer(adminLogin.body.token),
      body: JSON.stringify({
        fullName: 'Updatable User',
        username: 'admin',
        role: 'Sales Executive',
      }),
    });
    assert.equal(duplicateUsernameUpdate.response.status, 409);
    assert.equal(duplicateUsernameUpdate.body.code, 'USERNAME_ALREADY_EXISTS');

    const importCsv = [
      'fullName,role,username,email,password',
      'Imported Duplicate,Sales Executive,admin,import@example.com,Password@123',
    ].join('\n');
    const importForm = new FormData();
    importForm.append('file', new Blob([importCsv], { type: 'text/csv' }), 'users-import.csv');
    const importAttempt = await api('/api/users/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminLogin.body.token}` },
      body: importForm,
    });
    assert.equal(importAttempt.response.status, 200);
    assert.equal(importAttempt.body.errors, 1);
    assert.equal(importAttempt.body.rows[0].action, 'error');
    assert.match(importAttempt.body.rows[0].messages[0], /Username/);

    const oversizedAvatar = new Uint8Array(2 * 1024 * 1024 + 1024);
    const avatarForm = new FormData();
    avatarForm.append('avatar', new Blob([oversizedAvatar], { type: 'image/jpeg' }), 'oversized-avatar.jpg');
    const avatarTooLarge = await api('/api/users/1/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminLogin.body.token}` },
      body: avatarForm,
    });
    assert.equal(avatarTooLarge.response.status, 413);
  });

  await run('forgot-password and reset-password complete a local reset flow', async () => {
    const userId = await seedUser({
      username: 'reset-user',
      password: 'Reset@123',
      systemRole: 'sales',
      fullName: 'Reset User',
    });

    const requestReset = await api('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'reset-user' }),
    });
    assert.equal(requestReset.response.status, 200);
    assert.equal(requestReset.body.ok, true);
    assert.match(requestReset.body.debugResetToken, /\S+/);

    const completeReset = await api('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: requestReset.body.debugResetToken,
        newPassword: 'Reset@456',
      }),
    });
    assert.equal(completeReset.response.status, 200);
    assert.equal(completeReset.body.ok, true);
    assert.equal(completeReset.body.user.id, userId);
    assert.equal(completeReset.body.user.mustChangePassword, false);

    const oldLogin = await login('reset-user', 'Reset@123');
    assert.equal(oldLogin.response.status, 401);

    const newLogin = await login('reset-user', 'Reset@456');
    assert.equal(newLogin.response.status, 200);
    assert.equal(newLogin.body.user.mustChangePassword, false);

    const secondUse = await api('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: requestReset.body.debugResetToken,
        newPassword: 'Reset@789',
      }),
    });
    assert.equal(secondUse.response.status, 400);
  });

  await teardown();
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await teardown();
  process.exit(1);
});
