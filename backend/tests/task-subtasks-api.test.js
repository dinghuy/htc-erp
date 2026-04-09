require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-task-subtasks-'));
process.env.DB_PATH = path.join(tempDir, 'crm-task-subtasks.db');

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

  await run('task subtasks list existing children and create a new subtask under parent task', async () => {
    const db = getDb();
    const userId = await seedUser({
      username: 'task.subtasks.manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Task Subtask Manager',
    });

    const accountResult = await db.run(`INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`, [
      'Subtask Customer',
    ]);
    const accountId = accountResult.lastID;
    const projectResult = await db.run(
      `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
      ['ST-001', 'Subtask Project', userId, accountId, 'delivery_active', 'active'],
    );
    const projectId = projectResult.lastID;
    const parentTaskResult = await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'Parent task', userId, 'active', 'high', 'delivery_handoff', 'Operations'],
    );
    const parentTaskId = parentTaskResult.lastID;
    const existingSubtaskResult = await db.run(
      `INSERT INTO Task (projectId, parentTaskId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, parentTaskId, 'Existing subtask', userId, 'pending', 'medium', 'follow_up', 'Operations'],
    );
    const existingSubtaskId = existingSubtaskResult.lastID;
    await db.run(
      `INSERT INTO ToDo (userId, title, description, priority, visibility, doneAt, entityType, entityId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [userId, 'Checklist open', null, 'medium', 'public', null, 'Task', parentTaskId],
    );
    await db.run(
      `INSERT INTO ToDo (userId, title, description, priority, visibility, doneAt, entityType, entityId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))`,
      [userId, 'Checklist done', null, 'medium', 'public', 'Task', parentTaskId],
    );

    const auth = await login('task.subtasks.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const listed = await api(`/api/v1/tasks/${parentTaskId}/subtasks`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.items.length, 1);
    assert.equal(listed.body.items[0].id, existingSubtaskId);
    assert.equal(listed.body.items[0].parentTaskId, parentTaskId);

    const parentTask = await api(`/api/tasks/${parentTaskId}`);
    assert.equal(parentTask.response.status, 200);
    assert.equal(parentTask.body.subtaskCount, 1);
    assert.equal(parentTask.body.completedSubtaskCount, 0);
    assert.equal(parentTask.body.checklistCount, 2);
    assert.equal(parentTask.body.checklistCompletedCount, 1);
    assert.equal(parentTask.body.rollupCompletionPct, 33);

    const created = await api(`/api/v1/tasks/${parentTaskId}/subtasks`, {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        name: 'Created subtask',
        priority: 'low',
        taskType: 'procurement_follow_up',
        status: 'completed',
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.parentTaskId, parentTaskId);
    assert.equal(created.body.projectId, projectId);
    assert.equal(created.body.name, 'Created subtask');

    const listedAgain = await api(`/api/v1/tasks/${parentTaskId}/subtasks`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(listedAgain.response.status, 200);
    assert.equal(listedAgain.body.items.length, 2);

    const projectTasks = await api(`/api/tasks?projectId=${projectId}`);
    const parentRow = projectTasks.body.find((task) => task.id === parentTaskId);
    assert.equal(parentRow.subtaskCount, 2);
    assert.equal(parentRow.completedSubtaskCount, 1);
    assert.equal(parentRow.checklistCount, 2);
    assert.equal(parentRow.checklistCompletedCount, 1);
    assert.equal(parentRow.rollupCompletionPct, 50);

    const deleted = await api(`/api/v1/tasks/${parentTaskId}/subtasks/${existingSubtaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.body.success, true);

    const listedAfterDelete = await api(`/api/v1/tasks/${parentTaskId}/subtasks`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(listedAfterDelete.response.status, 200);
    assert.equal(listedAfterDelete.body.items.length, 1);
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
