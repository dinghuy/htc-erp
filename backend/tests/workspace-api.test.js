require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-workspace-'));
process.env.DB_PATH = path.join(tempDir, 'crm-workspace.db');

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
  const id = uuidv4();
  await db.run(
    `INSERT INTO User (
      id, fullName, gender, email, phone, role, department, status,
      username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      fullName,
      'male',
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

  await run('login returns normalized multi-role session payload', async () => {
    await seedUser({
      username: 'salespm',
      password: 'SalesPm@123',
      systemRole: 'sales',
      roleCodes: ['sales', 'project_manager'],
      fullName: 'Sales PM Combined',
    });

    const result = await login('salespm', 'SalesPm@123');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.user.systemRole, 'sales');
    assert.deepEqual(result.body.user.roleCodes, ['sales', 'project_manager']);
    assert.equal(result.body.user.isSalesProjectManager, true);
  });

  await run('workspace endpoints return combined sales-pm home and unified work queue', async () => {
    const db = getDb();
    const combinedUserId = await seedUser({
      username: 'hybrid_operator',
      password: 'Hybrid@123',
      systemRole: 'sales',
      roleCodes: ['sales', 'project_manager'],
      fullName: 'Hybrid Operator',
    });

    const accountId = uuidv4();
    const projectId = uuidv4();
    const quotationId = uuidv4();
    const taskId = uuidv4();
    const approvalId = uuidv4();
    const documentId = uuidv4();

    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`,
      [accountId, 'Hybrid Customer']
    );
    await db.run(
      `INSERT INTO Project (id, code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'HYB-001', 'Hybrid Delivery Project', combinedUserId, accountId, 'won', 'active']
    );
    await db.run(
      `INSERT INTO Quotation (id, quoteNumber, subject, accountId, projectId, status, grandTotal, isWinningVersion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [quotationId, 'Q-001', 'Hybrid Quote', accountId, projectId, 'accepted', 150000000, 1]
    );
    await db.run(
      `INSERT INTO Task (id, projectId, name, assigneeId, status, priority, dueDate, quotationId, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, date('now', '+1 day'), ?, ?, ?)`,
      [taskId, projectId, 'Follow commercial handoff', combinedUserId, 'active', 'high', quotationId, 'handoff', 'Operations']
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+2 day'))`,
      [approvalId, projectId, quotationId, 'contract-review', 'Legal review contract', 'Legal', combinedUserId, 'legal', combinedUserId, 'pending']
    );
    await db.run(
      `INSERT INTO ProjectDocument (id, projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [documentId, projectId, quotationId, 'HDMB', 'Hop dong mua ban', 'Contract', 'Legal', 'missing', 'legal_review']
    );

    const auth = await login('hybrid_operator', 'Hybrid@123');
    assert.equal(auth.response.status, 200);

    const home = await api('/api/workspace/home', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(home.response.status, 200);
    assert.equal(home.body.persona.mode, 'sales_pm_combined');
    assert.equal(home.body.priorities[0].metricKey, 'handoff_pending');
    assert.ok(home.body.highlights.some((item) => item.projectId === projectId));

    const myWork = await api('/api/workspace/my-work', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(myWork.response.status, 200);
    assert.equal(myWork.body.persona.mode, 'sales_pm_combined');
    assert.equal(myWork.body.view.title, 'My Work');
    assert.equal(myWork.body.view.taskTitle, 'Deals + Projects');
    assert.equal(myWork.body.summary.taskCount, 1);
    assert.equal(myWork.body.summary.pendingApprovalCount, 1);
    assert.equal(myWork.body.cards[0].label, 'Deals cần chốt');
    assert.ok(myWork.body.tasks.some((item) => item.id === taskId));
    assert.ok(myWork.body.approvals.some((item) => item.id === approvalId));

    const inbox = await api('/api/workspace/inbox', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(inbox.response.status, 200);
    assert.equal(inbox.body.persona.mode, 'sales_pm_combined');
    assert.equal(inbox.body.view.title, 'Unified Inbox');
    assert.equal(inbox.body.summary.documentCount, 1);
    assert.equal(inbox.body.summary.blockedTaskCount, 0);
    assert.ok(inbox.body.cards.some((item) => item.label === 'Missing documents' && item.value === 1));
    assert.ok(inbox.body.items.some((item) => item.entityId === documentId));

    const approvals = await api('/api/workspace/approvals', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(approvals.response.status, 200);
    assert.equal(approvals.body.persona.mode, 'sales_pm_combined');
    assert.equal(approvals.body.view.title, 'Unified Approvals');
    assert.equal(approvals.body.summary.pendingCount, 1);
    assert.ok(approvals.body.cards.some((item) => item.label === 'Pending approvals' && item.value === 1));
    assert.ok(approvals.body.approvals.some((item) => item.id === approvalId));
  });

  await run('admin home uses admin persona and admin-only users cannot approve business requests', async () => {
    const db = getDb();
    const adminUserId = await seedUser({
      username: 'system_admin',
      password: 'Admin@123',
      systemRole: 'admin',
      roleCodes: ['admin'],
      fullName: 'System Admin',
    });
    const accountingUserId = await seedUser({
      username: 'finance_owner',
      password: 'Finance@123',
      systemRole: 'accounting',
      roleCodes: ['accounting'],
      fullName: 'Finance Owner',
    });

    const accountId = uuidv4();
    const projectId = uuidv4();
    const approvalId = uuidv4();

    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`,
      [accountId, 'Admin Persona Customer']
    );
    await db.run(
      `INSERT INTO Project (id, code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'ADM-001', 'Admin Persona Project', adminUserId, accountId, 'won', 'active']
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [approvalId, projectId, 'payment-milestone', 'Finance milestone approval', 'Finance', adminUserId, 'accounting', accountingUserId, 'pending']
    );

    const auth = await login('system_admin', 'Admin@123');
    assert.equal(auth.response.status, 200);

    const home = await api('/api/workspace/home', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(home.response.status, 200);
    assert.equal(home.body.persona.mode, 'admin');

    const decision = await api(`/api/approval-requests/${approvalId}/decision`, {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(decision.response.status, 403);

    const previewHome = await api('/api/workspace/home', {
      headers: {
        Authorization: `Bearer ${auth.body.token}`,
        'x-role-preview': 'sales,project_manager',
      },
    });
    assert.equal(previewHome.response.status, 200);
    assert.equal(previewHome.body.persona.mode, 'sales_pm_combined');

    const previewDecision = await api(`/api/approval-requests/${approvalId}/decision`, {
      method: 'POST',
      headers: {
        ...bearer(auth.body.token),
        'x-role-preview': 'sales',
      },
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(previewDecision.response.status, 403);
  });

  await run('matching business roles can approve assigned requests and approval activity keeps actor metadata', async () => {
    const db = getDb();
    const requesterUserId = await seedUser({
      username: 'sales_requester',
      password: 'Sales@123',
      systemRole: 'sales',
      roleCodes: ['sales'],
      fullName: 'Sales Requester',
    });
    const accountingUserId = await seedUser({
      username: 'accounting_actor',
      password: 'Accounting@123',
      systemRole: 'accounting',
      roleCodes: ['accounting'],
      fullName: 'Accounting Actor',
    });
    const legalUserId = await seedUser({
      username: 'legal_actor',
      password: 'Legal@123',
      systemRole: 'legal',
      roleCodes: ['legal'],
      fullName: 'Legal Actor',
    });
    const directorUserId = await seedUser({
      username: 'director_actor',
      password: 'Director@123',
      systemRole: 'director',
      roleCodes: ['director'],
      fullName: 'Director Actor',
    });
    const procurementUserId = await seedUser({
      username: 'procurement_actor',
      password: 'Procure@123',
      systemRole: 'procurement',
      roleCodes: ['procurement'],
      fullName: 'Procurement Actor',
    });

    const accountId = uuidv4();
    const projectId = uuidv4();
    const financeApprovalId = uuidv4();
    const legalApprovalId = uuidv4();
    const executiveApprovalId = uuidv4();
    const procurementApprovalId = uuidv4();

    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`,
      [accountId, 'Approval Matrix Customer']
    );
    await db.run(
      `INSERT INTO Project (id, code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'APR-001', 'Approval Matrix Project', requesterUserId, accountId, 'won', 'active']
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [financeApprovalId, projectId, 'payment-milestone', 'Finance approval', 'Finance', requesterUserId, 'accounting', accountingUserId, 'pending']
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [legalApprovalId, projectId, 'contract-review', 'Legal approval', 'Legal', requesterUserId, 'legal', legalUserId, 'pending']
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [executiveApprovalId, projectId, 'margin-exception', 'Executive approval', 'BOD', requesterUserId, 'director', directorUserId, 'pending']
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [procurementApprovalId, projectId, 'po-approval', 'Procurement approval', 'Procurement', requesterUserId, 'procurement', procurementUserId, 'pending']
    );

    const accountingAuth = await login('accounting_actor', 'Accounting@123');
    const accountingDecision = await api(`/api/approval-requests/${financeApprovalId}/decision`, {
      method: 'POST',
      headers: bearer(accountingAuth.body.token),
      body: JSON.stringify({ decision: 'approved', note: 'Finance cleared' }),
    });
    assert.equal(accountingDecision.response.status, 200);
    assert.equal(accountingDecision.body.status, 'approved');

    const auditRow = await db.get(
      `SELECT * FROM Activity WHERE title = 'Approval decision' ORDER BY createdAt DESC, id DESC LIMIT 1`
    );
    assert.equal(auditRow.actorUserId, accountingUserId);
    assert.equal(auditRow.actingCapability, 'accounting');
    assert.equal(auditRow.entityType, 'Project');
    assert.equal(auditRow.entityId, projectId);
    assert.ok(String(auditRow.actorRoles || '').includes('accounting'));
    assert.equal(auditRow.action, 'approval_decision');

    const legalAuth = await login('legal_actor', 'Legal@123');
    const legalDecision = await api(`/api/approval-requests/${legalApprovalId}/decision`, {
      method: 'POST',
      headers: bearer(legalAuth.body.token),
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(legalDecision.response.status, 200);

    const directorAuth = await login('director_actor', 'Director@123');
    const executiveDecision = await api(`/api/approval-requests/${executiveApprovalId}/decision`, {
      method: 'POST',
      headers: bearer(directorAuth.body.token),
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(executiveDecision.response.status, 200);

    const procurementAuth = await login('procurement_actor', 'Procure@123');
    const procurementDecision = await api(`/api/approval-requests/${procurementApprovalId}/decision`, {
      method: 'POST',
      headers: bearer(procurementAuth.body.token),
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(procurementDecision.response.status, 200);
  });

  await run('director cockpit endpoint returns executive summary for director roles', async () => {
    const db = getDb();
    const directorUserId = await seedUser({
      username: 'director_cockpit',
      password: 'Director@123',
      systemRole: 'director',
      roleCodes: ['director'],
      fullName: 'Director Cockpit',
    });
    const accountingUserId = await seedUser({
      username: 'director_finance_owner',
      password: 'Finance@123',
      systemRole: 'accounting',
      roleCodes: ['accounting'],
      fullName: 'Director Finance Owner',
    });

    const accountId = uuidv4();
    const projectId = uuidv4();
    const taskId = uuidv4();
    const financeApprovalId = uuidv4();
    const executiveApprovalId = uuidv4();
    const documentId = uuidv4();

    await db.run(
      `INSERT INTO Account (id, companyName, accountType, status) VALUES (?, ?, 'Customer', 'active')`,
      [accountId, 'Executive Cockpit Customer']
    );
    await db.run(
      `INSERT INTO Project (id, code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'DIR-001', 'Executive Cockpit Project', directorUserId, accountId, 'won', 'active']
    );
    await db.run(
      `INSERT INTO Task (id, projectId, name, assigneeId, status, priority, taskType, department)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [taskId, projectId, 'Escalated delivery blocker', directorUserId, 'active', 'high', 'follow_up', 'Operations']
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [financeApprovalId, projectId, 'payment-milestone', 'Finance review', 'Finance', directorUserId, 'accounting', accountingUserId, 'pending']
    );
    await db.run(
      `INSERT INTO ApprovalRequest (id, projectId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now', '+1 day'))`,
      [executiveApprovalId, projectId, 'margin-exception', 'Executive review', 'BOD', directorUserId, 'director', directorUserId, 'pending']
    );
    await db.run(
      `INSERT INTO ProjectDocument (id, projectId, documentCode, documentName, category, department, status, requiredAtStage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [documentId, projectId, 'APP-01', 'Approval appendix', 'Contract', 'Legal', 'missing', 'legal_review']
    );

    const auth = await login('director_cockpit', 'Director@123');
    assert.equal(auth.response.status, 200);

    const cockpit = await api('/api/workspace/executive-cockpit', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });

    assert.equal(cockpit.response.status, 200);
    assert.equal(cockpit.body.persona.mode, 'director');
    assert.ok(cockpit.body.summary.pendingExecutiveApprovals >= 1);
    assert.ok(cockpit.body.summary.totalOpenTasks >= 1);
    assert.ok(cockpit.body.summary.totalMissingDocuments >= 1);
    assert.ok(cockpit.body.summary.topRiskProjects.some((item) => item.projectId === projectId));
    assert.ok(cockpit.body.summary.executiveApprovals.some((item) => item.id === executiveApprovalId));
    assert.ok(cockpit.body.summary.bottlenecksByDepartment.some((item) => item.department === 'Finance'));
    assert.ok(cockpit.body.summary.bottlenecksByDepartment.some((item) => item.department === 'BOD'));
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
