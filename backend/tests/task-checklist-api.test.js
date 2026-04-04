require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-task-checklist-'));
process.env.DB_PATH = path.join(tempDir, 'crm-task-checklist.db');

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

  await run('task checklist creates lists updates and completes checklist items', async () => {
    const db = getDb();
    const userId = await seedUser({
      username: 'task.checklist.manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Task Checklist Manager',
    });

    const accountId = uuidv4();
    const projectId = uuidv4();
    const taskId = uuidv4();

    await db.run(`INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`, [
      accountId,
      'Checklist Customer',
    ]);
    await db.run(
      `INSERT INTO Project (id, code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'CL-001', 'Checklist Project', userId, accountId, 'delivery_active', 'active'],
    );
    await db.run(
      `INSERT INTO Task (id, projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [taskId, projectId, 'Checklist Task', userId, 'active', 'high', 'delivery_handoff', 'Operations'],
    );

    const auth = await login('task.checklist.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const created = await api(`/api/v1/tasks/${taskId}/checklist`, {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        title: 'Confirm delivery checklist',
        description: 'Signed by warehouse',
        priority: 'high',
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.title, 'Confirm delivery checklist');
    assert.equal(created.body.entityType, 'Task');
    assert.equal(created.body.entityId, taskId);

    const listed = await api(`/api/v1/tasks/${taskId}/checklist`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.items.length, 1);

    const updated = await api(`/api/v1/tasks/${taskId}/checklist/${created.body.id}`, {
      method: 'PATCH',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        title: 'Confirm delivery checklist v2',
        description: 'Signed by warehouse and PM',
      }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.title, 'Confirm delivery checklist v2');

    const done = await api(`/api/v1/tasks/${taskId}/checklist/${created.body.id}/done`, {
      method: 'POST',
      headers: bearer(auth.body.token),
    });
    assert.equal(done.response.status, 200);
    assert.ok(done.body.doneAt);

    const undone = await api(`/api/v1/tasks/${taskId}/checklist/${created.body.id}/undone`, {
      method: 'POST',
      headers: bearer(auth.body.token),
    });
    assert.equal(undone.response.status, 200);
    assert.equal(undone.body.doneAt, null);

    const deleted = await api(`/api/v1/tasks/${taskId}/checklist/${created.body.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.body.success, true);
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
