require('ts-node/register');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-project-activity-stream-'));
process.env.DB_PATH = path.join(tempDir, 'crm-project-activity-stream.db');

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
    ]
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

  await run('project activity stream returns tracker-like merged activity items with source filters', async () => {
    const db = getDb();
    const managerUserId = await seedUser({
      username: 'project.activity.manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Project Activity Manager',
    });

    const accountId = uuidv4();
    const projectId = uuidv4();
    const taskId = uuidv4();
    const approvalId = uuidv4();
    const timelineEventId = uuidv4();
    const activityId = uuidv4();

    await db.run(`INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`, [
      accountId,
      'Activity Stream Customer',
    ]);
    await db.run(
      `INSERT INTO Project (id, code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'PA-001', 'Project Activity Stream', managerUserId, accountId, 'delivery_active', 'active'],
    );
    await db.run(
      `INSERT INTO Task (id, projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [taskId, projectId, 'Task linked to stream', managerUserId, 'active', 'high', 'delivery_handoff', 'Operations'],
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [approvalId, projectId, 'delivery_release', 'Delivery release approval', 'Operations', managerUserId, 'director', managerUserId, 'pending'],
    );
    await db.run(
      `INSERT INTO ProjectTimelineEvent (id, projectId, eventType, title, description, entityType, entityId, createdBy, eventDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [timelineEventId, projectId, 'delivery.release_requested', 'Timeline delivery request', 'Timeline detail', 'ApprovalRequest', approvalId, managerUserId],
    );
    await db.run(
      `INSERT INTO Activity (
        id, title, description, category, entityId, entityType, link, actorUserId, actorRoles, actingCapability, action, timestamp, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [activityId, 'Activity refresh', 'Activity detail', 'Project', taskId, 'Task', 'Tasks', managerUserId, 'manager', 'manager', 'task_refreshed'],
    );

    const auth = await login('project.activity.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const stream = await api(`/api/v1/projects/${projectId}/activities?limit=20`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(stream.response.status, 200);
    assert.ok(Array.isArray(stream.body.items));
    assert.ok(stream.body.items.some((item) => item.source === 'activity'));
    assert.ok(stream.body.items.some((item) => item.source === 'timeline'));
    assert.ok(stream.body.items.some((item) => item.source === 'approval'));
    assert.ok(stream.body.summary.total >= 3);
    assert.ok(stream.body.summary.bySource.activity >= 1);

    const activityOnly = await api(`/api/v1/projects/${projectId}/activities?source=activity&limit=20`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(activityOnly.response.status, 200);
    assert.ok(activityOnly.body.items.length >= 1);
    assert.ok(activityOnly.body.items.every((item) => item.source === 'activity'));
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
