require('ts-node/register');

const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { v4: uuidv4 } = require('uuid');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-qa-seed-'));
process.env.DB_PATH = path.join(tempDir, 'crm-qa-seed.db');

const { initDb, getDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
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
      'male',
      `${username}@example.com`,
      '',
      systemRole,
      'IT',
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

async function main() {
  await initDb();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  await seedUser({
    username: 'qa_admin_api',
    password: 'QaAdmin@123',
    systemRole: 'admin',
    roleCodes: ['admin'],
    fullName: 'QA Admin API',
  });

  const bootstrap = await api('/api/qa/bootstrap-ux-seed', {
    method: 'POST',
    headers: {
      'x-qa-bootstrap': 'ux-seed-local-only',
    },
  });
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.ok, true);
  assert.equal(bootstrap.body.bootstrap, true);
  assert.equal(bootstrap.body.contract.admin.username, 'qa_admin');

  const auth = await login('qa_admin', 'admin123');
  assert.equal(auth.response.status, 200);

  const reset = await api('/api/qa/reset-ux-seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.body.token}`,
    },
  });

  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.ok, true);
  assert.equal(reset.body.contract.admin.username, 'qa_admin');
  assert.equal(reset.body.contract.personas.sales.username, 'qa_sales');
  assert.equal(reset.body.contract.sampleIds.projects.delivery, 'qa-project-delivery');
  assert.equal(reset.body.contract.baseUrl.frontend, 'http://127.0.0.1:4173');

  const db = getDb();
  const userCount = await db.get(`SELECT COUNT(*) AS count FROM User`);
  const projectCount = await db.get(`SELECT COUNT(*) AS count FROM Project`);
  const approvalCount = await db.get(`SELECT COUNT(*) AS count FROM ApprovalRequest`);
  const documentCount = await db.get(`SELECT COUNT(*) AS count FROM ProjectDocument`);

  assert.equal(userCount.count, 8);
  assert.equal(projectCount.count, 3);
  assert.equal(approvalCount.count, 5);
  assert.equal(documentCount.count, 2);

  const viewerLogin = await login('qa_viewer', 'QaRole@123');
  assert.equal(viewerLogin.response.status, 200);

  const viewerReset = await api('/api/qa/reset-ux-seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${viewerLogin.body.token}`,
    },
  });
  assert.equal(viewerReset.response.status, 403);

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

main().catch(async (error) => {
  console.error(error);
  if (server) {
    await new Promise((resolve) => server.close(() => resolve()));
  }
  process.exitCode = 1;
});
