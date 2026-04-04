require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-project-task-reorder-'));
process.env.DB_PATH = path.join(tempDir, 'crm-project-task-reorder.db');

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

  await run('project task reorder preserves manual order for top-level tasks only', async () => {
    const db = getDb();
    const userId = await seedUser({
      username: 'project.task.reorder.manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Project Task Reorder Manager',
    });

    const accountId = uuidv4();
    const projectId = uuidv4();
    const taskA = uuidv4();
    const taskB = uuidv4();
    const taskC = uuidv4();

    await db.run(`INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`, [
      accountId,
      'Project Reorder Customer',
    ]);
    await db.run(
      `INSERT INTO Project (id, code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'PR-001', 'Project Reorder', userId, accountId, 'delivery_active', 'active'],
    );

    const rows = [
      [taskA, 'Task A', 30],
      [taskB, 'Task B', 20],
      [taskC, 'Task C', 10],
    ];
    for (const [taskId, name, sortOrder] of rows) {
      await db.run(
        `INSERT INTO Task (id, projectId, name, assigneeId, sortOrder, status, priority, taskType, department)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskId, projectId, name, userId, sortOrder, 'pending', 'medium', 'follow_up', 'Operations'],
      );
    }

    const auth = await login('project.task.reorder.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const reordered = await api(`/api/v1/projects/${projectId}/tasks/reorder`, {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        orderedTaskIds: [taskC, taskA, taskB],
      }),
    });
    assert.equal(reordered.response.status, 200);
    assert.equal(reordered.body.items.map((item) => item.id).join(','), [taskC, taskA, taskB].join(','));

    const listed = await api(`/api/tasks?projectId=${projectId}`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.slice(0, 3).map((item) => item.id).join(','), [taskC, taskA, taskB].join(','));
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
