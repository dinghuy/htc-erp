require('ts-node/register');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-support-'));
process.env.DB_PATH = path.join(tempDir, 'crm-support.db');

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

async function login(username, password) {
  return api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

async function createUser({ id, fullName, username, password, systemRole }) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 10);
  await db.run(
    `INSERT INTO User (
      id, fullName, gender, email, phone, role, department, status,
      username, passwordHash, systemRole, accountStatus, mustChangePassword, language
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      fullName,
      'unknown',
      `${username}@example.com`,
      '',
      systemRole,
      'Support',
      'Active',
      username,
      passwordHash,
      systemRole,
      'active',
      0,
      'vi',
    ]
  );
}

async function setup() {
  await initDb();
  await createUser({
    id: 'manager-user',
    fullName: 'Support Manager',
    username: 'support.manager',
    password: 'Manager@123',
    systemRole: 'manager',
  });
  await createUser({
    id: 'viewer-user',
    fullName: 'Support Viewer',
    username: 'support.viewer',
    password: 'Viewer@123',
    systemRole: 'viewer',
  });
  await createUser({
    id: 'viewer-user-2',
    fullName: 'Support Viewer Two',
    username: 'support.viewer2',
    password: 'Viewer2@123',
    systemRole: 'viewer',
  });

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

  await run('support ticket creation requires authentication', async () => {
    const result = await api('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'bug',
        subject: 'Cannot export quotation',
        description: 'Export button throws an error.',
      }),
    });

    assert.equal(result.response.status, 401);
  });

  await run('support ticket creation validates required fields', async () => {
    const auth = await login('support.viewer', 'Viewer@123');
    assert.equal(auth.response.status, 200);

    const result = await api('/api/support/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.body.token}`,
      },
      body: JSON.stringify({
        category: '',
        subject: '   ',
        description: '',
      }),
    });

    assert.equal(result.response.status, 400);
    assert.equal(result.body.error, 'Validation failed');
    assert.deepEqual(result.body.fields, {
      category: 'category is required',
      subject: 'subject is required',
      description: 'description is required',
    });
  });

  await run('viewer can create a support ticket and admins/managers receive notifications', async () => {
    const viewerAuth = await login('support.viewer', 'Viewer@123');
    const adminAuth = await login('admin', 'admin123');
    const managerAuth = await login('support.manager', 'Manager@123');
    assert.equal(viewerAuth.response.status, 200);
    assert.equal(adminAuth.response.status, 200);
    assert.equal(managerAuth.response.status, 200);

    const created = await api('/api/support/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerAuth.body.token}`,
      },
      body: JSON.stringify({
        category: 'bug',
        subject: 'Cannot export quotation',
        description: 'Export button throws an error after selecting a customer.',
      }),
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.body.category, 'bug');
    assert.equal(created.body.subject, 'Cannot export quotation');
    assert.equal(created.body.description, 'Export button throws an error after selecting a customer.');
    assert.equal(created.body.status, 'open');
    assert.equal(created.body.responseNote, null);
    assert.equal(created.body.createdByName, 'Support Viewer');
    assert.equal(created.body.updatedBy, null);
    assert.equal(created.body.updatedByName, null);
    assert.match(created.body.id, /\S+/);
    assert.match(created.body.createdAt, /\S+/);
    assert.match(created.body.updatedAt, /\S+/);

    const adminNotifications = await api('/api/notifications', {
      headers: { Authorization: `Bearer ${adminAuth.body.token}` },
    });
    const managerNotifications = await api('/api/notifications', {
      headers: { Authorization: `Bearer ${managerAuth.body.token}` },
    });

    assert.equal(adminNotifications.response.status, 200);
    assert.equal(managerNotifications.response.status, 200);
    assert.equal(adminNotifications.body.items.some((item) => item.entityType === 'SupportTicket' && item.entityId === created.body.id && item.link === 'Support'), true);
    assert.equal(managerNotifications.body.items.some((item) => item.entityType === 'SupportTicket' && item.entityId === created.body.id && item.link === 'Support'), true);
  });

  await run('ticket listing is role-aware: viewers see own tickets, admins see all, scope=mine narrows admin view', async () => {
    const viewerOne = await login('support.viewer', 'Viewer@123');
    const viewerTwo = await login('support.viewer2', 'Viewer2@123');
    const adminAuth = await login('admin', 'admin123');
    assert.equal(viewerOne.response.status, 200);
    assert.equal(viewerTwo.response.status, 200);
    assert.equal(adminAuth.response.status, 200);

    const secondTicket = await api('/api/support/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerTwo.body.token}`,
      },
      body: JSON.stringify({
        category: 'feature-request',
        subject: 'Need project filter',
        description: 'Please add project filtering to support reports.',
      }),
    });
    assert.equal(secondTicket.response.status, 201);

    const viewerList = await api('/api/support/tickets', {
      headers: { Authorization: `Bearer ${viewerOne.body.token}` },
    });
    const adminList = await api('/api/support/tickets', {
      headers: { Authorization: `Bearer ${adminAuth.body.token}` },
    });
    const adminMine = await api('/api/support/tickets?scope=mine', {
      headers: { Authorization: `Bearer ${adminAuth.body.token}` },
    });

    assert.equal(viewerList.response.status, 200);
    assert.equal(viewerList.body.items.length, 1);
    assert.equal(viewerList.body.items[0].createdBy, 'viewer-user');

    assert.equal(adminList.response.status, 200);
    assert.equal(adminList.body.items.length, 2);
    assert.equal(adminList.body.items.some((item) => item.createdBy === 'viewer-user'), true);
    assert.equal(adminList.body.items.some((item) => item.createdBy === 'viewer-user-2'), true);

    assert.equal(adminMine.response.status, 200);
    assert.deepEqual(adminMine.body.items, []);
  });

  await run('only admin or manager can update support ticket status and response note', async () => {
    const viewerAuth = await login('support.viewer', 'Viewer@123');
    const adminAuth = await login('admin', 'admin123');
    assert.equal(viewerAuth.response.status, 200);
    assert.equal(adminAuth.response.status, 200);

    const tickets = await api('/api/support/tickets', {
      headers: { Authorization: `Bearer ${adminAuth.body.token}` },
    });
    const ticket = tickets.body.items.find((item) => item.createdBy === 'viewer-user');
    assert.ok(ticket);

    const forbidden = await api(`/api/support/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerAuth.body.token}`,
      },
      body: JSON.stringify({ status: 'resolved', responseNote: 'Patched in release 1.4.3.' }),
    });
    assert.equal(forbidden.response.status, 403);

    const updated = await api(`/api/support/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.body.token}`,
      },
      body: JSON.stringify({ status: 'resolved', responseNote: 'Patched in release 1.4.3.' }),
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.status, 'resolved');
    assert.equal(updated.body.responseNote, 'Patched in release 1.4.3.');
    assert.equal(updated.body.updatedByName, 'Administrator');
  });

  await teardown();

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  failures += 1;
  console.error(error);
  await teardown();
  process.exitCode = 1;
});
