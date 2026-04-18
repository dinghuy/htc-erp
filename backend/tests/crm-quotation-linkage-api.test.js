require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-quotation-linkage-'));
process.env.DB_PATH = path.join(tempDir, 'crm-quotation-linkage.db');

const { initDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let failures = 0;
let authToken = '';

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

function withAuth(options = {}) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    },
  };
}

async function login() {
  const result = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(result.response.status, 200);
  authToken = result.body.token;
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

async function setup() {
  await initDb();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await login();
}

async function teardown() {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function createAccount(companyName) {
  const result = await api('/api/accounts', withAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName, accountType: 'Customer', status: 'active' }),
  }));
  assert.equal(result.response.status, 201);
  return result.body;
}

async function createContact(payload) {
  return api('/api/contacts', withAuth({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

async function updateContact(contactId, payload) {
  return api(`/api/contacts/${contactId}`, withAuth({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

async function main() {
  await setup();

  await run('contacts enforce valid account linkage and preserve account filter', async () => {
    const accountA = await createAccount('Account A');
    const accountB = await createAccount('Account B');

    const createdA = await createContact({
      accountId: accountA.id,
      lastName: 'Pham',
      firstName: 'Linh',
      department: 'Sales',
      jobTitle: 'AM',
      gender: 'female',
      email: 'linh.account-a@example.com',
      phone: '0900111000',
      isPrimaryContact: true,
    });
    assert.equal(createdA.response.status, 201);

    const createdB = await createContact({
      accountId: accountB.id,
      lastName: 'Nguyen',
      firstName: 'Minh',
      department: 'Sales',
      jobTitle: 'AM',
      gender: 'male',
      email: 'minh.account-b@example.com',
      phone: '0900222000',
      isPrimaryContact: false,
    });
    assert.equal(createdB.response.status, 201);

    const filtered = await api(`/api/contacts?accountId=${encodeURIComponent(accountA.id)}`, withAuth());
    assert.equal(filtered.response.status, 200);
    assert.equal(Array.isArray(filtered.body), true);
    assert.equal(filtered.body.length, 1);
    assert.equal(filtered.body[0].id, createdA.body.id);
    assert.equal(filtered.body[0].accountId, accountA.id);

    const missingAccountIdCreate = await createContact({
      lastName: 'No',
      firstName: 'Account',
      email: 'missing-account-id@example.com',
    });
    assert.equal(missingAccountIdCreate.response.status, 400);
    assert.deepEqual(missingAccountIdCreate.body, { error: 'accountId is required' });

    const invalidAccountCreate = await createContact({
      accountId: 'missing-account',
      lastName: 'Invalid',
      firstName: 'Linkage',
      email: 'invalid-account@example.com',
    });
    assert.equal(invalidAccountCreate.response.status, 400);
    assert.deepEqual(invalidAccountCreate.body, { error: 'Invalid accountId' });

    const missingAccountIdUpdate = await updateContact(createdA.body.id, {
      lastName: 'Pham',
      firstName: 'Linh',
      email: 'linh.account-a@example.com',
    });
    assert.equal(missingAccountIdUpdate.response.status, 400);
    assert.deepEqual(missingAccountIdUpdate.body, { error: 'accountId is required' });

    const invalidAccountUpdate = await updateContact(createdA.body.id, {
      accountId: 'missing-account',
      lastName: 'Pham',
      firstName: 'Linh',
      email: 'linh.account-a@example.com',
    });
    assert.equal(invalidAccountUpdate.response.status, 400);
    assert.deepEqual(invalidAccountUpdate.body, { error: 'Invalid accountId' });
  });

  await teardown();
  if (failures > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  failures += 1;
  await teardown();
  process.exit(1);
});
