require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-task-views-'));
process.env.DB_PATH = path.join(tempDir, 'crm-task-views.db');

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

async function seedUser({
  username,
  password,
  systemRole,
  roleCodes,
  fullName,
}) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.run(
    `INSERT INTO User (
      fullName, gender, email, phone, role, department, status,
      username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fullName,
      'unknown',
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
  return result.lastID;
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

  await run('task view presets require auth and return user-scoped items', async () => {
    const unauthenticated = await api('/api/v1/tasks/views');
    assert.equal(unauthenticated.response.status, 401);
  });

  await run('task view presets create list and switch default per user', async () => {
    await seedUser({
      username: 'task.view.manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Task View Manager',
    });

    const auth = await login('task.view.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const firstPreset = await api('/api/v1/tasks/views', {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        name: 'Ops overdue',
        query: 'delivery',
        projectId: 'project-1',
        assigneeId: 'user-1',
        priority: 'high',
        status: 'in_progress',
        onlyOverdue: true,
        groupBy: 'department',
        surface: 'kanban',
        isDefault: true,
      }),
    });
    assert.equal(firstPreset.response.status, 201);
    assert.equal(firstPreset.body.name, 'Ops overdue');
    assert.equal(firstPreset.body.onlyOverdue, true);
    assert.equal(firstPreset.body.groupBy, 'department');
    assert.equal(firstPreset.body.isDefault, true);

    const secondPreset = await api('/api/v1/tasks/views', {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        name: 'Legal backlog',
        query: '',
        projectId: null,
        assigneeId: '',
        priority: '',
        status: 'on_hold',
        onlyOverdue: false,
        groupBy: 'urgency',
        surface: 'list',
        isDefault: true,
      }),
    });
    assert.equal(secondPreset.response.status, 201);
    assert.equal(secondPreset.body.surface, 'list');
    assert.equal(secondPreset.body.groupBy, 'urgency');
    assert.equal(secondPreset.body.isDefault, true);

    const listed = await api('/api/v1/tasks/views', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.items.length, 2);
    const defaultPreset = listed.body.items.find((item) => item.isDefault);
    assert.ok(defaultPreset);
    assert.equal(defaultPreset.id, secondPreset.body.id);
    const previousPreset = listed.body.items.find((item) => item.id === firstPreset.body.id);
    assert.equal(previousPreset.isDefault, false);
  });

  await run('task view presets are isolated per user and owners can delete their preset', async () => {
    await seedUser({
      username: 'task.view.owner',
      password: 'Owner@123',
      systemRole: 'project_manager',
      roleCodes: ['project_manager'],
      fullName: 'Task View Owner',
    });
    await seedUser({
      username: 'task.view.other',
      password: 'Other@123',
      systemRole: 'sales',
      roleCodes: ['sales'],
      fullName: 'Task View Other',
    });

    const ownerAuth = await login('task.view.owner', 'Owner@123');
    const otherAuth = await login('task.view.other', 'Other@123');
    assert.equal(ownerAuth.response.status, 200);
    assert.equal(otherAuth.response.status, 200);

    const created = await api('/api/v1/tasks/views', {
      method: 'POST',
      headers: bearer(ownerAuth.body.token),
      body: JSON.stringify({
        name: 'Owner preset',
        status: 'not_started',
        groupBy: 'project',
        surface: 'kanban',
      }),
    });
    assert.equal(created.response.status, 201);

    const otherList = await api('/api/v1/tasks/views', {
      headers: { Authorization: `Bearer ${otherAuth.body.token}` },
    });
    assert.equal(otherList.response.status, 200);
    assert.deepEqual(otherList.body.items, []);

    const forbiddenDelete = await api(`/api/v1/tasks/views/${created.body.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherAuth.body.token}` },
    });
    assert.equal(forbiddenDelete.response.status, 404);

    const deleted = await api(`/api/v1/tasks/views/${created.body.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerAuth.body.token}` },
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.body.success, true);
  });

  await run('task view presets can be updated and promoted to default by owner', async () => {
    await seedUser({
      username: 'task.view.editor',
      password: 'Editor@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Task View Editor',
    });

    const auth = await login('task.view.editor', 'Editor@123');
    assert.equal(auth.response.status, 200);

    const first = await api('/api/v1/tasks/views', {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        name: 'Delivery lane',
        query: 'delivery',
        status: 'in_progress',
        groupBy: 'taskType',
        surface: 'kanban',
        isDefault: true,
      }),
    });
    const second = await api('/api/v1/tasks/views', {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        name: 'Blocked queue',
        query: '',
        status: '',
        onlyOverdue: false,
        groupBy: 'none',
        surface: 'list',
        isDefault: false,
      }),
    });
    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);

    const updated = await api(`/api/v1/tasks/views/${second.body.id}`, {
      method: 'PATCH',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        name: 'Blocked triage',
        onlyOverdue: true,
        projectId: 'project-99',
        groupBy: 'assignee',
        isDefault: true,
      }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.name, 'Blocked triage');
    assert.equal(updated.body.onlyOverdue, true);
    assert.equal(updated.body.projectId, 'project-99');
    assert.equal(updated.body.groupBy, 'assignee');
    assert.equal(updated.body.isDefault, true);

    const listed = await api('/api/v1/tasks/views', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(listed.response.status, 200);
    const previousDefault = listed.body.items.find((item) => item.id === first.body.id);
    const nextDefault = listed.body.items.find((item) => item.id === second.body.id);
    assert.equal(previousDefault.isDefault, false);
    assert.equal(nextDefault.isDefault, true);
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
