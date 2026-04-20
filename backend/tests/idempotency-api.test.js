require('ts-node/register');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-idempotency-'));
process.env.DB_PATH = path.join(tempDir, 'crm-idempotency.db');

const { initDb, getDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let failures = 0;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
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
  const result = await api('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(result.response.status, 200);
  return result.body.token;
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

async function seedDirectorUser() {
  const db = getDb();
  await db.run(
    `INSERT INTO User (
      id, fullName, email, username, passwordHash, systemRole, roleCodes, accountStatus, mustChangePassword
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      9001,
      'Test Director',
      'test-director@example.local',
      'test_director',
      await bcrypt.hash('Director@123', 10),
      'director',
      JSON.stringify(['director']),
      'active',
      0,
    ],
  );
  return 9001;
}

async function main() {
  await setup();

  await run('duplicate quotation create replays cached response for same idempotency key', async () => {
    const token = await login('admin', 'admin123');
    const body = {
      quoteNumber: 'IDEMP-Q-001',
      subject: 'Idempotent quotation create',
      status: 'draft',
    };
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'quote-create-fixed-key',
    };

    const first = await api('/api/v1/quotations', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const second = await api('/api/v1/quotations', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);
    assert.equal(second.body.id, first.body.id);

    const row = await getDb().get(
      `SELECT COUNT(*) AS count FROM Quotation WHERE quoteNumber = ?`,
      [body.quoteNumber],
    );
    assert.equal(Number(row.count), 1);
  });

  await run('same idempotency key with different request body is rejected', async () => {
    const token = await login('admin', 'admin123');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'quote-create-reused-key',
    };

    const first = await api('/api/v1/quotations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ quoteNumber: 'IDEMP-Q-002', status: 'draft' }),
    });
    const second = await api('/api/v1/quotations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ quoteNumber: 'IDEMP-Q-003', status: 'draft' }),
    });

    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 409);
    assert.equal(second.body.code, 'IDEMPOTENCY_KEY_REUSED');
  });

  await run('duplicate approval decision replays response and enqueues one ERP event', async () => {
    const directorId = await seedDirectorUser();
    const token = await login('test_director', 'Director@123');
    const db = getDb();

    await db.run(
      `INSERT INTO Project (id, code, name, projectStage, status) VALUES (?, ?, ?, ?, ?)`,
      [8101, 'IDEMP-PROJ', 'Idempotency Project', 'quoting', 'active'],
    );
    await db.run(
      `INSERT INTO Quotation (id, quoteNumber, status, currency, subtotal, taxTotal, grandTotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['idem-quotation-approval', 'IDEMP-Q-APPROVAL', 'submitted_for_approval', 'VND', 0, 0, 0],
    );
    const approval = await db.run(
      `INSERT INTO ApprovalRequest (
        projectId, quotationId, requestType, title, department, requestedBy, approverRole, approverUserId, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        '8101',
        'idem-quotation-approval',
        'quotation_commercial',
        'Approve quotation once',
        'Commercial',
        null,
        'director',
        String(directorId),
        'pending',
      ],
    );
    const approvalId = String(approval.lastID);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': 'approval-decision-fixed-key',
    };

    const first = await api(`/api/v1/approvals/${approvalId}/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ decision: 'approved' }),
    });
    const second = await api(`/api/v1/approvals/${approvalId}/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ decision: 'approved' }),
    });

    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.equal(second.body.id, first.body.id);
    assert.equal(second.body.status, 'approved');

    const outbox = await db.get(
      `SELECT COUNT(*) AS count
       FROM ErpOutbox
       WHERE eventType = 'quotation.status_changed'
         AND entityId = ?
         AND payload LIKE ?`,
      ['idem-quotation-approval', `%${approvalId}%`],
    );
    assert.equal(Number(outbox.count), 1);
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
