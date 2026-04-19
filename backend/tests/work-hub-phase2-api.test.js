require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

function parseInsertedId(result, entityName) {
  const id = Number(result?.lastID);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(`Failed to insert ${entityName}`);
  }
  return id;
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-work-hub-phase2-'));
process.env.DB_PATH = path.join(tempDir, 'crm-work-hub-phase2.db');

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
  return parseInsertedId(result, 'User');
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

  await run('v1 entity threads create and list messages for project document context', async () => {
    const db = getDb();
    const authorUserId = await seedUser({
      username: 'thread.author',
      password: 'Author@123',
      systemRole: 'project_manager',
      roleCodes: ['project_manager'],
      fullName: 'Thread Author',
    });

    const accountResult = await db.run(
      `INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`,
      ['Thread Customer'],
    );
    const accountId = parseInsertedId(accountResult, 'Account');

    const projectResult = await db.run(
      `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
      ['THR-001', 'Thread Project', authorUserId, accountId, 'delivery_active', 'active'],
    );
    const projectId = parseInsertedId(projectResult, 'Project');

    const documentResult = await db.run(
      `INSERT INTO ProjectDocument (projectId, documentCode, documentName, category, department, status, requiredAtStage)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'DOC-001', 'Delivery checklist', 'Delivery', 'Operations', 'missing', 'delivery'],
    );
    const documentId = parseInsertedId(documentResult, 'ProjectDocument');

    const auth = await login('thread.author', 'Author@123');
    assert.equal(auth.response.status, 200);

    const createdThread = await api('/api/v1/threads', {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        entityType: 'ProjectDocument',
        entityId: documentId,
        title: 'Delivery checklist discussion',
      }),
    });
    assert.equal(createdThread.response.status, 201);
    assert.equal(createdThread.body.entityType, 'ProjectDocument');
    assert.equal(createdThread.body.entityId, documentId);
    assert.equal(createdThread.body.status, 'active');

    const createdMessage = await api(`/api/v1/threads/${createdThread.body.id}/messages`, {
      method: 'POST',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        content: 'Need updated signed checklist before release.',
      }),
    });
    assert.equal(createdMessage.response.status, 201);
    assert.equal(createdMessage.body.threadId, createdThread.body.id);
    assert.equal(createdMessage.body.content, 'Need updated signed checklist before release.');

    const threadList = await api(`/api/v1/threads?entityType=ProjectDocument&entityId=${documentId}`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(threadList.response.status, 200);
    assert.equal(threadList.body.items.length, 1);
    assert.equal(threadList.body.items[0].messageCount, 1);

    const messageList = await api(`/api/v1/threads/${createdThread.body.id}/messages`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(messageList.response.status, 200);
    assert.equal(messageList.body.items.length, 1);
    assert.equal(messageList.body.items[0].content, 'Need updated signed checklist before release.');
  });

  await run('document review-state mutation is reflected in project workspace documents', async () => {
    const db = getDb();
    const managerUserId = await seedUser({
      username: 'review.manager',
      password: 'Manager@123',
      systemRole: 'manager',
      roleCodes: ['manager'],
      fullName: 'Review Manager',
    });
    const reviewerUserId = await seedUser({
      username: 'review.legal',
      password: 'Legal@123',
      systemRole: 'legal',
      roleCodes: ['legal'],
      fullName: 'Legal Reviewer',
    });

    const accountResult = await db.run(
      `INSERT INTO Account (companyName, accountType, status) VALUES (?, 'Customer', 'active')`,
      ['Review Customer'],
    );
    const accountId = parseInsertedId(accountResult, 'Account');

    const projectResult = await db.run(
      `INSERT INTO Project (code, name, managerId, accountId, projectStage, status) VALUES (?, ?, ?, ?, ?, ?)`,
      ['REV-001', 'Review Project', managerUserId, accountId, 'internal-review', 'active'],
    );
    const projectId = parseInsertedId(projectResult, 'Project');

    const documentResult = await db.run(
      `INSERT INTO ProjectDocument (projectId, documentCode, documentName, category, department, status, requiredAtStage)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, 'DOC-REVIEW', 'Contract appendix', 'Contract', 'Legal', 'requested', 'legal_review'],
    );
    const documentId = parseInsertedId(documentResult, 'ProjectDocument');

    const auth = await login('review.manager', 'Manager@123');
    assert.equal(auth.response.status, 200);

    const patched = await api(`/api/project-documents/${documentId}/review-state`, {
      method: 'PATCH',
      headers: bearer(auth.body.token),
      body: JSON.stringify({
        reviewStatus: 'changes_requested',
        reviewerUserId,
        reviewNote: 'Clause 4 needs clarification',
        storageKey: 'documents/review/contract-appendix-v2.pdf',
      }),
    });
    assert.equal(patched.response.status, 200);
    assert.equal(patched.body.reviewStatus, 'changes_requested');
    assert.equal(patched.body.reviewerUserId, reviewerUserId);
    assert.equal(patched.body.reviewNote, 'Clause 4 needs clarification');
    assert.equal(patched.body.storageKey, 'documents/review/contract-appendix-v2.pdf');
    assert.ok(patched.body.reviewedAt);

    const workspace = await api(`/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${auth.body.token}` },
    });
    assert.equal(workspace.response.status, 200);
    const documentRow = workspace.body.documents.find((item) => item.id === documentId);
    assert.ok(documentRow);
    assert.equal(documentRow.reviewStatus, 'changes_requested');
    assert.equal(documentRow.reviewerUserId, reviewerUserId);
    assert.equal(documentRow.reviewNote, 'Clause 4 needs clarification');
    assert.equal(documentRow.storageKey, 'documents/review/contract-appendix-v2.pdf');
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
