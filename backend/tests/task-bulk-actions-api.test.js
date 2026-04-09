require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-task-bulk-'));
process.env.DB_PATH = path.join(tempDir, 'crm-task-bulk.db');

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

  await run('bulk task actions update status assignee and priority for selected tasks only', async () => {
    const db = getDb();
    const managerId = await seedUser({
      username: 'task.bulk.manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Task Bulk Manager',
    });
    const assigneeId = await seedUser({
      username: 'task.bulk.assignee',
      password: 'Assignee@123',
      systemRole: 'sales',
      roleCodes: ['sales'],
      fullName: 'Task Bulk Assignee',
    });

    const accountResult = await db.run(`INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`, [
      'Bulk Customer',
    ]);
    const accountId = accountResult.lastID;
    const projectResult = await db.run(
      `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
      ['BK-001', 'Bulk Project', managerId, accountId, 'delivery_active', 'active'],
    );
    const projectId = projectResult.lastID;

    const taskAResult = await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'Task A', managerId, 'pending', 'medium', 'delivery_handoff', 'Operations'],
    );
    const taskBResult = await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'Task B', managerId, 'pending', 'medium', 'delivery_handoff', 'Operations'],
    );
    const taskCResult = await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'Task C', managerId, 'pending', 'medium', 'delivery_handoff', 'Operations'],
    );
    const taskA = taskAResult.lastID;
    const taskB = taskBResult.lastID;
    const taskC = taskCResult.lastID;

    const auth = await login('task.bulk.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const updated = await api('/api/v1/tasks/bulk-update', {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        taskIds: [taskA, taskB],
        changes: {
          status: 'active',
          priority: 'high',
          assigneeId,
        },
      }),
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.updatedCount, 2);
    assert.equal(updated.body.items.length, 2);
    assert.ok(updated.body.items.every((item) => item.status === 'active'));
    assert.ok(updated.body.items.every((item) => item.priority === 'high'));
    assert.ok(updated.body.items.every((item) => item.assigneeId === assigneeId));

    const untouched = await db.get(`SELECT status, priority, assigneeId FROM Task WHERE id = ?`, [taskC]);
    assert.deepEqual(untouched, {
      status: 'pending',
      priority: 'medium',
      assigneeId: managerId,
    });
  });

  await teardown();
  if (failures > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  failures += 1;
  console.error(error);
  await teardown().catch(() => {});
  process.exitCode = 1;
});
