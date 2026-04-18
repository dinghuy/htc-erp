require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-work-hub-'));
process.env.DB_PATH = path.join(tempDir, 'crm-work-hub.db');

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

  await run('v1 project workspace summary returns compact work hub contract', async () => {
    const db = getDb();
    const managerUserId = await seedUser({
      username: 'workhub.manager',
      password: 'Manager@123',
      systemRole: 'project_manager',
      roleCodes: ['project_manager'],
      fullName: 'Work Hub Manager',
    });

    const accountResult = await db.run(`INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`, [
      'Work Hub Customer',
    ]);
    const accountId = accountResult.lastID;
    const projectResult = await db.run(
      `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
      ['WH-001', 'Work Hub Project', managerUserId, accountId, 'delivery_active', 'active'],
    );
    const projectId = projectResult.lastID;
    await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, dueDate, taskType, department)
       VALUES (?, ?, ?, ?, ?, date('now', '+1 day'), ?, ?)`,
      [projectId, 'Open execution task', managerUserId, 'active', 'high', 'delivery_handoff', 'Operations'],
    );
    await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, dueDate, taskType, department, blockedReason)
       VALUES (?, ?, ?, ?, ?, date('now', '-1 day'), ?, ?, ?)`,
      [projectId, 'Blocked task', managerUserId, 'pending', 'high', 'follow_up', 'Operations', 'Waiting supplier reply'],
    );
    await db.run(
      `INSERT INTO ApprovalRequest (projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [projectId, 'delivery_release', 'Delivery gate approval', 'Operations', managerUserId, 'director', managerUserId, 'pending'],
    );
    await db.run(
      `INSERT INTO ProjectMilestone (projectId, title, note, status, plannedDate, actualDate)
       VALUES (?, ?, ?, ?, date('now', '-2 day'), date('now', '-2 day'))`,
      [projectId, 'Kickoff done', 'Kickoff completed', 'completed'],
    );
    await db.run(
      `INSERT INTO ProjectMilestone (projectId, title, note, status, plannedDate)
       VALUES (?, ?, ?, ?, date('now', '-1 day'))`,
      [projectId, 'Pending delivery prep', 'Still waiting', 'pending'],
    );
    await db.run(
      `INSERT INTO Activity (title, description, category, entityId, entityType, link, actorUserId, actorRoles, actingCapability, action, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ['Delivery plan updated', 'Execution lane refreshed', 'Project', projectId, 'Project', 'Projects', managerUserId, 'project_manager', 'project_manager', 'workspace_refresh'],
    );

    const auth = await login('workhub.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const result = await api(`/api/v1/projects/${projectId}/workspace`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });

    assert.equal(result.response.status, 200);
    assert.equal(Number(result.body.projectId), projectId);
    assert.equal(result.body.activeTab, 'delivery');
    assert.equal(result.body.taskSummary.total, 2);
    assert.equal(result.body.taskSummary.active, 1);
    assert.equal(result.body.taskSummary.blocked, 1);
    assert.equal(result.body.taskSummary.overdue, 1);
    assert.equal(result.body.approvalSummary.pending, 1);
    assert.ok(result.body.approvalSummary.byLane.delivery >= 1);
    assert.equal(result.body.milestoneSummary.total, 2);
    assert.equal(result.body.milestoneSummary.completed, 1);
    assert.equal(result.body.milestoneSummary.overdue, 1);
    assert.ok(Array.isArray(result.body.recentActivities));
    assert.ok(result.body.recentActivities.some((item) => item.activityType === 'workspace_refresh'));
  });

  await run('v1 approval queue returns lane-aware queue items', async () => {
    const db = getDb();
    const salesUserId = await seedUser({
      username: 'workhub.sales',
      password: 'Sales@123',
      systemRole: 'sales',
      roleCodes: ['sales'],
      fullName: 'Work Hub Sales',
    });

    const accountResult = await db.run(`INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`, [
      'Approval Queue Customer',
    ]);
    const accountId = accountResult.lastID;
    const projectResult = await db.run(
      `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
      ['AQ-001', 'Approval Queue Project', salesUserId, accountId, 'internal-review', 'active'],
    );
    const projectId = projectResult.lastID;
    const approvalResult = await db.run(
      `INSERT INTO ApprovalRequest (projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', '+2 day'))`,
      [projectId, 'contract-review', 'Queue legal review', 'Legal', salesUserId, 'legal', salesUserId, 'pending'],
    );
    const approvalId = approvalResult.lastID;

    const auth = await login('workhub.sales', 'Sales@123');
    const result = await api('/api/v1/approvals/queue', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });

    assert.equal(result.response.status, 200);
    assert.ok(Array.isArray(result.body.items));
    const row = result.body.items.find((item) => item.approvalRequestId === approvalId);
    assert.ok(row);
    assert.equal(row.lane, 'legal');
    assert.equal(row.status, 'pending');
    assert.equal(row.projectId, projectId);
  });

  await run('task dependencies and worklogs expose v1 work hub routes', async () => {
    const db = getDb();
    const ownerUserId = await seedUser({
      username: 'workhub.owner',
      password: 'Owner@123',
      systemRole: 'project_manager',
      roleCodes: ['project_manager'],
      fullName: 'Work Hub Owner',
    });

    const accountResult = await db.run(`INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`, [
      'Task Graph Customer',
    ]);
    const accountId = accountResult.lastID;
    const projectResult = await db.run(
      `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
      ['TG-001', 'Task Graph Project', ownerUserId, accountId, 'delivery_active', 'active'],
    );
    const projectId = projectResult.lastID;
    const taskResult = await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'Main task', ownerUserId, 'active', 'high', 'delivery_handoff', 'Operations'],
    );
    const taskId = taskResult.lastID;
    const relatedTaskResult = await db.run(
      `INSERT INTO Task (projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'Dependency task', ownerUserId, 'pending', 'medium', 'procurement_follow_up', 'Procurement'],
    );
    const relatedTaskId = relatedTaskResult.lastID;

    const auth = await login('workhub.owner', 'Owner@123');
    assert.equal(auth.response.status, 200);

    const createDependency = await api(`/api/v1/tasks/${taskId}/dependencies`, {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        relatedTaskId: String(relatedTaskId),
        kind: 'blocked_by',
        note: 'Need supplier confirmation first',
      }),
    });
    assert.equal(createDependency.response.status, 201);
    assert.equal(Number(createDependency.body.taskId), taskId);
    assert.equal(Number(createDependency.body.relatedTaskId), relatedTaskId);
    assert.equal(createDependency.body.kind, 'blocked_by');

    const dependencyList = await api(`/api/v1/tasks/${taskId}/dependencies`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(dependencyList.response.status, 200);
    assert.equal(dependencyList.body.items.length, 1);
    assert.equal(dependencyList.body.items[0].context?.taskName, 'Dependency task');

    const createWorklog = await api(`/api/v1/tasks/${taskId}/worklogs`, {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        reportDate: '2026-03-30',
        hours: 2.5,
        description: 'Checked delivery readiness',
      }),
    });
    assert.equal(createWorklog.response.status, 201, JSON.stringify(createWorklog.body));
    assert.equal(Number(createWorklog.body.taskId), taskId);
    assert.equal(createWorklog.body.durationMinutes, 150);
    assert.equal(createWorklog.body.summary, 'Checked delivery readiness');

    const worklogList = await api(`/api/v1/tasks/${taskId}/worklogs`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(worklogList.response.status, 200);
    assert.equal(worklogList.body.items.length, 1);
    assert.equal(worklogList.body.items[0].durationMinutes, 150);
    assert.equal(Number(worklogList.body.items[0].authorUserId), ownerUserId);
  });

  await teardown();
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  failures += 1;
  await teardown().catch(() => {});
  process.exitCode = 1;
});
