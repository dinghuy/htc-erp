require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-task-reorder-'));
process.env.DB_PATH = path.join(tempDir, 'crm-task-reorder.db');

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

  await run('subtask reorder preserves manual sibling order', async () => {
    const db = getDb();
    const userId = await seedUser({
      username: 'task.reorder.manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Task Reorder Manager',
    });

    const accountResult = await db.run(`INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`, [
      'Reorder Customer',
    ]);
    const accountId = accountResult.lastID;
    const projectResult = await db.run(
      `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
      ['RO-001', 'Reorder Project', userId, accountId, 'delivery_active', 'active'],
    );
    const projectId = projectResult.lastID;
    const parentTaskResult = await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, taskType, department, sortOrder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'Parent task', userId, 'active', 'high', 'delivery_handoff', 'Operations', 100],
    );
    const parentTaskId = parentTaskResult.lastID;

    const children = [
      ['Subtask A', 30],
      ['Subtask B', 20],
      ['Subtask C', 10],
    ];
    const childResults = [];
    for (const [name, sortOrder] of children) {
      childResults.push(await db.run(
        `INSERT INTO Task (projectId, parentTaskId, name, assigneeId, status, priority, taskType, department, sortOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId, parentTaskId, name, userId, 'pending', 'medium', 'follow_up', 'Operations', sortOrder],
      ));
    }
    const [subtaskA, subtaskB, subtaskC] = childResults.map((result) => result.lastID);

    const auth = await login('task.reorder.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const reordered = await api(`/api/v1/tasks/${parentTaskId}/subtasks/reorder`, {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        orderedTaskIds: [subtaskC, subtaskA, subtaskB],
      }),
    });
    assert.equal(reordered.response.status, 200);
    assert.equal(reordered.body.items[0].id, subtaskC);
    assert.equal(reordered.body.items[1].id, subtaskA);
    assert.equal(reordered.body.items[2].id, subtaskB);

    const listedAgain = await api(`/api/v1/tasks/${parentTaskId}/subtasks`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(listedAgain.response.status, 200);
    assert.equal(listedAgain.body.items.map((item) => item.id).join(','), [subtaskC, subtaskA, subtaskB].join(','));
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
