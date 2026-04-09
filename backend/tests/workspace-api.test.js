require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
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
  const result = await db.run(
    `INSERT INTO User (
      fullName, gender, email, phone, role, department, status,
      username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
  return result.lastID;
}

async function insertAccount(companyName) {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`,
    [companyName],
  );
  return result.lastID;
}

async function insertProject({ code, name, managerId, accountId, projectStage, status }) {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [code, name, managerId, accountId, projectStage, status],
  );
  return result.lastID;
}

async function insertQuotation({ quoteNumber, subject, accountId, projectId, status, grandTotal, isWinningVersion }) {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO Quotation (quoteNumber, subject, accountId, projectId, status, grandTotal, isWinningVersion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [quoteNumber, subject, accountId, projectId, status, grandTotal, isWinningVersion],
  );
  return result.lastID;
}

async function insertTaskRow({ projectId, name, assigneeId, status, priority, dueDate, quotationId, taskType, department, blockedReason }) {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO Task (projectId, name, assigneeId, status, priority, dueDate, quotationId, taskType, department, blockedReason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, name, assigneeId, status, priority, dueDate ?? null, quotationId ?? null, taskType, department, blockedReason ?? null],
  );
  return result.lastID;
}

async function insertApprovalRequest({ projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate }) {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO ApprovalRequest (projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status, dueDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, quotationId ?? null, requestType, title, department, requestedBy ?? null, approverRole ?? null, approverUserId ?? null, status, dueDate],
  );
  return result.lastID;
}

async function insertProjectDocument({ projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage }) {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO ProjectDocument (projectId, quotationId, documentCode, documentName, category, department, status, requiredAtStage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, quotationId ?? null, documentCode, documentName, category, department, status, requiredAtStage],
  );
  return result.lastID;
}

async function insertSalesOrder({ quotationId, orderNumber, accountId, status }) {
  const db = getDb();
  const result = await db.run(
    `INSERT INTO SalesOrder (quotationId, orderNumber, accountId, status)
     VALUES (?, ?, ?, ?)`,
    [quotationId, orderNumber, accountId, status],
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

    const accountId = await insertAccount('Hybrid Customer');
    const projectId = await insertProject({
      code: 'HYB-001',
      name: 'Hybrid Delivery Project',
      managerId: combinedUserId,
      accountId,
      projectStage: 'won',
      status: 'active',
    });
    const quotationId = await insertQuotation({
      quoteNumber: 'Q-001',
      subject: 'Hybrid Quote',
      accountId,
      projectId,
      status: 'accepted',
      grandTotal: 150000000,
      isWinningVersion: 1,
    });
    const taskId = await insertTaskRow({
      projectId,
      name: 'Follow commercial handoff',
      assigneeId: combinedUserId,
      status: 'active',
      priority: 'high',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      quotationId,
      taskType: 'handoff',
      department: 'Operations',
    });
    const approvalId = await insertApprovalRequest({
      projectId,
      quotationId,
      requestType: 'contract-review',
      title: 'Legal review contract',
      department: 'Legal',
      requestedBy: combinedUserId,
      approverRole: 'legal',
      approverUserId: combinedUserId,
      status: 'pending',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    const documentId = await insertProjectDocument({
      projectId,
      quotationId,
      documentCode: 'HDMB',
      documentName: 'Hop dong mua ban',
      category: 'Contract',
      department: 'Legal',
      status: 'missing',
      requiredAtStage: 'legal_review',
    });

    const auth = await login('hybrid_operator', 'Hybrid@123');
    assert.equal(auth.response.status, 200);

    const home = await api('/api/workspace/home', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(home.response.status, 200);
    assert.equal(home.body.persona.mode, 'sales_pm_combined');
    assert.equal(home.body.priorities[0].metricKey, 'handoff_pending');
    assert.equal(home.body.priorities[0].value, 1);
    assert.equal(home.body.priorities[1].value, 1);
    assert.equal(home.body.priorities[2].value, 1);
    assert.ok(home.body.highlights.some((item) => item.projectId === projectId));
    const highlightedHomeProject = home.body.highlights.find((item) => item.projectId === projectId);
    assert.ok(highlightedHomeProject?.handoffActivation, 'home highlight should expose handoff activation');
    assert.equal(highlightedHomeProject.handoffActivation.status, 'ready_to_create_sales_order');
    assert.equal(highlightedHomeProject.handoffActivation.nextActionKey, 'create_sales_order');

    const opsSummary = await api('/api/ops/summary', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(opsSummary.response.status, 200);
    assert.equal(opsSummary.body.tasks.total, 1);
    assert.equal(opsSummary.body.tasks.active, 1);
    assert.equal(opsSummary.body.projects.total, 1);
    const recentProject = opsSummary.body.recentProjects.find((item) => item.id === projectId);
    assert.ok(recentProject);
    assert.equal(recentProject.taskCount, 1);

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
    const taskRow = myWork.body.tasks.find((item) => item.id === taskId);
    assert.ok(taskRow);
    assert.equal(taskRow.actionAvailability.workspaceTab, 'commercial');
    assert.equal(taskRow.actionAvailability.canOpenProject, true);
    const myWorkApprovalRow = myWork.body.approvals.find((item) => item.id === approvalId);
    assert.ok(myWorkApprovalRow);
    assert.equal(myWorkApprovalRow.actionAvailability.lane, 'legal');

    const inbox = await api('/api/workspace/inbox', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(inbox.response.status, 200);
    assert.equal(inbox.body.persona.mode, 'sales_pm_combined');
    assert.equal(inbox.body.view.title, 'Unified Inbox');
    assert.equal(inbox.body.summary.documentCount, 1);
    assert.equal(inbox.body.summary.blockedTaskCount, 0);
    assert.ok(inbox.body.cards.some((item) => item.label === 'Missing documents' && item.value === 1));
    const inboxDocumentRow = inbox.body.items.find((item) => item.entityId === documentId);
    assert.ok(inboxDocumentRow);
    assert.equal(inboxDocumentRow.actionAvailability.workspaceTab, 'documents');
    assert.equal(inboxDocumentRow.actionAvailability.canOpenProject, true);

    const approvals = await api('/api/workspace/approvals', {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(approvals.response.status, 200);
    assert.equal(approvals.body.persona.mode, 'sales_pm_combined');
    assert.equal(approvals.body.view.title, 'Unified Approvals');
    assert.equal(approvals.body.summary.pendingCount, 1);
    assert.ok(approvals.body.cards.some((item) => item.label === 'Pending approvals' && item.value === 1));
    const approvalRow = approvals.body.approvals.find((item) => item.id === approvalId);
    assert.ok(approvalRow);
    assert.equal(approvalRow.actionAvailability.lane, 'legal');
    assert.equal(approvalRow.actionAvailability.canDecide, false);
  });

  await run('project workspace exposes action availability and gate state from backend', async () => {
    const db = getDb();
    const directorUserId = await seedUser({
      username: 'workspace_director',
      password: 'Director@123',
      systemRole: 'director',
      roleCodes: ['director'],
      fullName: 'Workspace Director',
    });
    const salesUserId = await seedUser({
      username: 'workspace_sales',
      password: 'Sales@123',
      systemRole: 'sales',
      roleCodes: ['sales'],
      fullName: 'Workspace Sales',
    });

    const accountId = await insertAccount('Workspace Action Customer');
    const projectId = await insertProject({
      code: 'WS-001',
      name: 'Workspace Action Project',
      managerId: directorUserId,
      accountId,
      projectStage: 'won',
      status: 'active',
    });
    const quotationId = await insertQuotation({
      quoteNumber: 'WS-Q-001',
      subject: 'Workspace Action Quote',
      accountId,
      projectId,
      status: 'won',
      grandTotal: 99000000,
      isWinningVersion: 1,
    });
    const salesOrderId = await insertSalesOrder({
      quotationId,
      orderNumber: 'SO-WS-001',
      accountId,
      status: 'draft',
    });
    const deliveryApprovalId = await insertApprovalRequest({
      projectId,
      quotationId,
      requestType: 'delivery_completion',
      title: 'Delivery completion approval',
      department: 'Operations',
      requestedBy: directorUserId,
      approverRole: 'sales',
      approverUserId: salesUserId,
      status: 'pending',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });

    const directorAuth = await login('workspace_director', 'Director@123');
    assert.equal(directorAuth.response.status, 200);

    const workspace = await api(`/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${directorAuth.body.token}` },
    });
    assert.equal(workspace.response.status, 200);
    assert.equal(workspace.body.actionAvailability.quotation.canCreateSalesOrder, true);
    assert.equal(workspace.body.actionAvailability.salesOrder.canReleaseLatest, false);
    assert.equal(workspace.body.actionAvailability.project.canFinalizeDeliveryCompletion, false);
    assert.ok(Array.isArray(workspace.body.pendingApproverState));
    assert.ok(workspace.body.handoffActivation, 'workspace should expose handoff activation');
    assert.equal(workspace.body.handoffActivation.status, 'awaiting_release_approval');
    assert.equal(workspace.body.handoffActivation.nextActionKey, 'request_sales_order_release_approval');

    const deliveryGate = workspace.body.approvalGateStates.find((gate) => gate.gateType === 'delivery_completion');
    assert.ok(deliveryGate);
    assert.equal(deliveryGate.pendingCount, 1);
    assert.equal(deliveryGate.pendingApprovers[0].approverRole, 'sales');
  });

  await run('quotation and sales-order list APIs expose workflow actions for list screens', async () => {
    const db = getDb();
    const salesUserId = await seedUser({
      username: 'list_sales_user',
      password: 'ListSales@123',
      systemRole: 'sales',
      roleCodes: ['sales'],
      fullName: 'List Sales User',
    });
    await seedUser({
      username: 'list_director_user',
      password: 'ListDirector@123',
      systemRole: 'director',
      roleCodes: ['director'],
      fullName: 'List Director User',
    });

    const accountId = await insertAccount('List Screen Customer');
    const projectId = await insertProject({
      code: 'LIST-001',
      name: 'List Screen Project',
      managerId: salesUserId,
      accountId,
      projectStage: 'won',
      status: 'active',
    });
    const quotationId = await insertQuotation({
      quoteNumber: 'LIST-Q-001',
      subject: 'List Screen Quote',
      accountId,
      projectId,
      status: 'won',
      grandTotal: 88000000,
      isWinningVersion: 1,
    });
    const approvalId = await insertApprovalRequest({
      projectId,
      quotationId,
      requestType: 'sales_order_release',
      title: 'Release sales order',
      department: 'Operations',
      requestedBy: salesUserId,
      approverRole: 'director',
      approverUserId: null,
      status: 'pending',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    const salesOrderId = await insertSalesOrder({
      quotationId,
      orderNumber: 'SO-LIST-001',
      accountId,
      status: 'draft',
    });

    const salesAuth = await login('list_sales_user', 'ListSales@123');
    const quotationList = await api('/api/quotations', {
      headers: { Authorization: `Bearer ${salesAuth.body.token}` },
    });
    assert.equal(quotationList.response.status, 200);
    const quotationRow = quotationList.body.find((item) => item.id === quotationId);
    assert.ok(quotationRow);
    assert.equal(quotationRow.actionAvailability.canCreateSalesOrder, true);
    assert.equal(quotationRow.approvalGateState.gateType, 'quotation_commercial');
    assert.ok(quotationRow.handoffActivation, 'quotation list row should expose handoff activation');
    assert.equal(quotationRow.handoffActivation.status, 'awaiting_release_approval');

    const salesHome = await api('/api/workspace/home', {
      headers: { Authorization: `Bearer ${salesAuth.body.token}` },
    });
    assert.equal(salesHome.response.status, 200);
    const highlightedProject = salesHome.body.highlights.find((item) => item.projectId === projectId);
    assert.ok(highlightedProject);
    assert.ok(Array.isArray(highlightedProject.approvalGateStates));
    assert.ok(highlightedProject.approvalGateStates.some((gate) => gate.gateType === 'sales_order_release'));
    assert.ok(highlightedProject.handoffActivation, 'home highlight should carry handoff activation');
    assert.equal(highlightedProject.handoffActivation.status, 'awaiting_release_approval');

    const directorAuth = await login('list_director_user', 'ListDirector@123');
    const salesOrderList = await api('/api/sales-orders?limit=20', {
      headers: { Authorization: `Bearer ${directorAuth.body.token}` },
    });
    assert.equal(salesOrderList.response.status, 200);
    const salesOrderRow = salesOrderList.body.find((item) => item.id === salesOrderId);
    assert.ok(salesOrderRow);
    assert.equal(salesOrderRow.actionAvailability.canRelease, false);
    assert.equal(salesOrderRow.approvalGateState.gateType, 'sales_order_release');
    assert.equal(salesOrderRow.approvalGateState.pendingCount, 1);
    assert.ok(salesOrderRow.handoffActivation, 'sales order row should expose handoff activation');
    assert.equal(salesOrderRow.handoffActivation.status, 'awaiting_release_approval');

    const projectList = await api('/api/projects', {
      headers: { Authorization: `Bearer ${directorAuth.body.token}` },
    });
    assert.equal(projectList.response.status, 200);
    const projectRow = projectList.body.find((item) => item.id === projectId);
    assert.ok(projectRow);
    assert.ok(Array.isArray(projectRow.approvalGateStates));
    assert.equal(projectRow.actionAvailability.salesOrder.canReleaseLatest, false);
    assert.ok(Array.isArray(projectRow.pendingApproverState));
    assert.ok(projectRow.handoffActivation, 'project row should expose handoff activation');
    assert.equal(projectRow.handoffActivation.status, 'awaiting_release_approval');
  });

  await run('release-ready handoff state stays consistent across workspace and list surfaces', async () => {
    const db = getDb();
    const directorUserId = await seedUser({
      username: 'release_ready_director',
      password: 'Director@123',
      systemRole: 'director',
      roleCodes: ['director'],
      fullName: 'Release Ready Director',
    });

    const accountId = await insertAccount('Release Ready Customer');
    const projectId = await insertProject({ code: 'RELREADY-001', name: 'Release Ready Project', managerId: directorUserId, accountId, projectStage: 'won', status: 'active' });
    const quotationId = await insertQuotation({ quoteNumber: 'RELREADY-Q-001', subject: 'Release Ready Quote', accountId, projectId, status: 'won', grandTotal: 54000000, isWinningVersion: 1 });
    const salesOrderId = await insertSalesOrder({ quotationId, orderNumber: 'SO-RELREADY-001', accountId, status: 'draft' });
    const approvalId = await insertApprovalRequest({
      projectId,
      quotationId,
      requestType: 'sales_order_release',
      title: 'Release sales order',
      department: 'Operations',
      requestedBy: directorUserId,
      approverRole: 'director',
      approverUserId: directorUserId,
      status: 'approved',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });

    const directorAuth = await login('release_ready_director', 'Director@123');

    const workspace = await api(`/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${directorAuth.body.token}` },
    });
    assert.equal(workspace.response.status, 200);
    assert.equal(workspace.body.handoffActivation.status, 'ready_to_release');
    assert.equal(workspace.body.actionAvailability.salesOrder.canReleaseLatest, true);

    const quotationList = await api('/api/quotations', {
      headers: { Authorization: `Bearer ${directorAuth.body.token}` },
    });
    const quotationRow = quotationList.body.find((item) => item.id === quotationId);
    assert.ok(quotationRow);
    assert.equal(quotationRow.handoffActivation.status, 'ready_to_release');

    const salesOrderList = await api('/api/sales-orders?limit=20', {
      headers: { Authorization: `Bearer ${directorAuth.body.token}` },
    });
    const salesOrderRow = salesOrderList.body.find((item) => item.id === salesOrderId);
    assert.ok(salesOrderRow);
    assert.equal(salesOrderRow.handoffActivation.status, 'ready_to_release');
    assert.equal(salesOrderRow.actionAvailability.canRelease, true);

    const projectList = await api('/api/projects', {
      headers: { Authorization: `Bearer ${directorAuth.body.token}` },
    });
    const projectRow = projectList.body.find((item) => item.id === projectId);
    assert.ok(projectRow);
    assert.equal(projectRow.handoffActivation.status, 'ready_to_release');

    const home = await api('/api/workspace/home', {
      headers: { Authorization: `Bearer ${directorAuth.body.token}` },
    });
    const highlightedProject = home.body.highlights.find((item) => item.projectId === projectId);
    assert.ok(highlightedProject);
    assert.equal(highlightedProject.handoffActivation.status, 'ready_to_release');
  });

  await run('sales-order release approval endpoint creates and reuses pending approval requests', async () => {
    const db = getDb();
    const directorUserId = await seedUser({
      username: 'release_director_user',
      password: 'ReleaseDirector@123',
      systemRole: 'director',
      roleCodes: ['director'],
      fullName: 'Release Director User',
    });
    const pmUserId = await seedUser({
      username: 'release_pm_user',
      password: 'ReleasePm@123',
      systemRole: 'project_manager',
      roleCodes: ['project_manager'],
      fullName: 'Release PM User',
    });

    const accountId = await insertAccount('Release Approval Customer');
    const projectId = await insertProject({ code: 'REL-001', name: 'Release Approval Project', managerId: pmUserId, accountId, projectStage: 'won', status: 'active' });
    const quotationId = await insertQuotation({ quoteNumber: 'REL-Q-001', subject: 'Release Approval Quote', accountId, projectId, status: 'won', grandTotal: 76000000, isWinningVersion: 1 });
    const salesOrderId = await insertSalesOrder({ quotationId, orderNumber: 'SO-REL-001', accountId, status: 'draft' });

    const pmAuth = await login('release_pm_user', 'ReleasePm@123');
    assert.equal(pmAuth.response.status, 200);

    const createApproval = await api(`/api/sales-orders/${salesOrderId}/release-approval`, {
      method: 'POST',
      headers: bearer(pmAuth.body.token),
      body: JSON.stringify({ note: 'Xin phe duyet release' }),
    });
    assert.equal(createApproval.response.status, 201);
    assert.equal(createApproval.body.requestType, 'sales_order_release');
    assert.equal(createApproval.body.projectId, projectId);
    assert.equal(createApproval.body.quotationId, quotationId);
    assert.equal(createApproval.body.approverRole, 'director');
    assert.equal(createApproval.body.approverUserId, directorUserId);
    assert.equal(createApproval.body.status, 'pending');

    const secondAttempt = await api(`/api/sales-orders/${salesOrderId}/release-approval`, {
      method: 'POST',
      headers: bearer(pmAuth.body.token),
      body: JSON.stringify({ note: 'Thu lai' }),
    });
    assert.equal(secondAttempt.response.status, 200);
    assert.equal(secondAttempt.body.id, createApproval.body.id);
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

    const accountId = await insertAccount('Admin Persona Customer');
    const projectId = await insertProject({ code: 'ADM-001', name: 'Admin Persona Project', managerId: adminUserId, accountId, projectStage: 'won', status: 'active' });
    const approvalId = await insertApprovalRequest({
      projectId,
      quotationId: null,
      requestType: 'payment-milestone',
      title: 'Finance milestone approval',
      department: 'Finance',
      requestedBy: adminUserId,
      approverRole: 'accounting',
      approverUserId: accountingUserId,
      status: 'pending',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });

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

    const accountId = await insertAccount('Approval Matrix Customer');
    const projectId = await insertProject({ code: 'APR-001', name: 'Approval Matrix Project', managerId: requesterUserId, accountId, projectStage: 'won', status: 'active' });
    const financeApprovalId = await insertApprovalRequest({ projectId, quotationId: null, requestType: 'payment-milestone', title: 'Finance approval', department: 'Finance', requestedBy: requesterUserId, approverRole: 'accounting', approverUserId: accountingUserId, status: 'pending', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    const legalApprovalId = await insertApprovalRequest({ projectId, quotationId: null, requestType: 'contract-review', title: 'Legal approval', department: 'Legal', requestedBy: requesterUserId, approverRole: 'legal', approverUserId: legalUserId, status: 'pending', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    const executiveApprovalId = await insertApprovalRequest({ projectId, quotationId: null, requestType: 'margin-exception', title: 'Executive approval', department: 'BOD', requestedBy: requesterUserId, approverRole: 'director', approverUserId: directorUserId, status: 'pending', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    const procurementApprovalId = await insertApprovalRequest({ projectId, quotationId: null, requestType: 'po-approval', title: 'Procurement approval', department: 'Procurement', requestedBy: requesterUserId, approverRole: 'procurement', approverUserId: procurementUserId, status: 'pending', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });

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

    const accountId = await insertAccount('Executive Cockpit Customer');
    const projectId = await insertProject({ code: 'DIR-001', name: 'Executive Cockpit Project', managerId: directorUserId, accountId, projectStage: 'won', status: 'active' });
    const taskId = await insertTaskRow({ projectId, name: 'Escalated delivery blocker', assigneeId: directorUserId, status: 'active', priority: 'high', taskType: 'follow_up', department: 'Operations' });
    const financeApprovalId = await insertApprovalRequest({ projectId, quotationId: null, requestType: 'payment-milestone', title: 'Finance review', department: 'Finance', requestedBy: directorUserId, approverRole: 'accounting', approverUserId: accountingUserId, status: 'pending', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    const executiveApprovalId = await insertApprovalRequest({ projectId, quotationId: null, requestType: 'margin-exception', title: 'Executive review', department: 'BOD', requestedBy: directorUserId, approverRole: 'director', approverUserId: directorUserId, status: 'pending', dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    const documentId = await insertProjectDocument({ projectId, quotationId: null, documentCode: 'APP-01', documentName: 'Approval appendix', category: 'Contract', department: 'Legal', status: 'missing', requiredAtStage: 'legal_review' });

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
