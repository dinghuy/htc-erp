require('ts-node/register');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-api-v1-'));
process.env.DB_PATH = path.join(tempDir, 'crm-api-v1.db');

const { initDb } = require('../sqlite-db.ts');
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

async function loginV1(username, password) {
  return api('/api/v1/auth/login', {
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

  await run('versioned health endpoint resolves through legacy router', async () => {
    const result = await api('/api/v1/health');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.status, 'ok');
  });

  await run('versioned auth login works and returns token payload', async () => {
    const result = await loginV1('admin', 'admin123');
    assert.equal(result.response.status, 200);
    assert.match(result.body.token, /\S+/);
    assert.equal(result.body.user.username, 'admin');
  });

  await run('versioned project route preserves auth enforcement', async () => {
    const unauthenticated = await api('/api/v1/projects');
    assert.equal(unauthenticated.response.status, 401);

    const login = await loginV1('admin', 'admin123');
    const authenticated = await api('/api/v1/projects', {
      headers: { Authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(authenticated.response.status, 200);
    assert.ok(Array.isArray(authenticated.body));
  });

  await run('versioned CRM entity routes preserve legacy mapping', async () => {
    const leads = await api('/api/v1/leads');
    assert.equal(leads.response.status, 200);
    assert.ok(Array.isArray(leads.body));

    const accounts = await api('/api/v1/accounts');
    assert.equal(accounts.response.status, 200);
    assert.ok(Array.isArray(accounts.body));

    const contacts = await api('/api/v1/contacts');
    assert.equal(contacts.response.status, 200);
    assert.ok(Array.isArray(contacts.body));
  });

  await run('versioned quotation route preserves auth while task list remains reachable', async () => {
    const unauthenticatedQuotations = await api('/api/v1/quotations');
    assert.equal(unauthenticatedQuotations.response.status, 401);

    const login = await loginV1('admin', 'admin123');
    const quotations = await api('/api/v1/quotations', {
      headers: { Authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(quotations.response.status, 200);
    assert.ok(Array.isArray(quotations.body));

    const tasks = await api('/api/v1/tasks');
    assert.equal(tasks.response.status, 200);
    assert.ok(Array.isArray(tasks.body));
  });

  await run('versioned sales order route preserves auth and alias mapping', async () => {
    const unauthenticated = await api('/api/v1/sales-orders');
    assert.equal(unauthenticated.response.status, 401);

    const login = await loginV1('admin', 'admin123');
    const authenticated = await api('/api/v1/sales-orders', {
      headers: { Authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(authenticated.response.status, 200);
    assert.ok(Array.isArray(authenticated.body));
  });

  await run('versioned ERP outbox route is mounted on the documented v1 namespace', async () => {
    const unauthenticated = await api('/api/v1/integrations/erp/outbox');
    assert.equal(unauthenticated.response.status, 401);

    const login = await loginV1('admin', 'admin123');
    const authenticated = await api('/api/v1/integrations/erp/outbox', {
      headers: { Authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(authenticated.response.status, 200);
    assert.equal(typeof authenticated.body, 'object');
    assert.ok(Array.isArray(authenticated.body.items));
    assert.equal(typeof authenticated.body.stats, 'object');
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
