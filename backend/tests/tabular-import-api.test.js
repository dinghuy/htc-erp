require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-tabular-import-'));
process.env.DB_PATH = path.join(tempDir, 'crm-tabular-import.db');

const { initDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let authToken = '';
let failures = 0;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function fetchBinary(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer };
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

function buildWorkbookBuffer(rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
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

async function main() {
  await setup();

  await run('accounts import accepts xlsx and returns row-level report', async () => {
    const buffer = buildWorkbookBuffer([
      { companyName: 'Cang Sai Gon', shortName: 'CSG', accountType: 'Customer', status: 'active' },
      { companyName: '', shortName: 'BAD', accountType: 'Customer', status: 'active' },
    ]);
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'accounts.xlsx');

    const result = await api('/api/accounts/import', withAuth({ method: 'POST', body: form }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.created, 1);
    assert.equal(result.body.errors, 1);
    assert.equal(result.body.rows[1].rowNumber, 3);
  });

  await run('leads import accepts xlsx and validates required fields', async () => {
    const buffer = buildWorkbookBuffer([
      { companyName: 'HTG Port', contactName: 'Nguyen Van A', status: 'New' },
      { companyName: 'Missing Contact', contactName: '' },
    ]);
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'leads.xlsx');

    const result = await api('/api/leads/import', withAuth({ method: 'POST', body: form }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.created, 1);
    assert.equal(result.body.errors, 1);
    assert.match(result.body.rows[1].messages[0], /Thiếu người liên hệ/);
  });

  await run('users import accepts xlsx and normalizes row report', async () => {
    const buffer = buildWorkbookBuffer([
      { fullName: 'Nguyen Van B', gender: 'male', email: 'b@example.com', status: 'Active' },
      { fullName: '', email: 'missing@example.com' },
    ]);
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'users.xlsx');

    const result = await api('/api/users/import', withAuth({ method: 'POST', body: form }));

    assert.equal(result.response.status, 200);
    assert.equal(result.body.created, 1);
    assert.equal(result.body.errors, 1);
    assert.equal(result.body.rows[0].action, 'created');
    assert.equal(result.body.rows[1].action, 'error');
  });

  await run('suppliers import accepts xlsx and suppliers export supports xlsx', async () => {
    const importBuffer = buildWorkbookBuffer([
      { code: 'SUP-001', company: 'Komatsu VN', tag: 'Heavy Equipment', country: 'Vietnam', status: 'active' },
    ]);
    const form = new FormData();
    form.append('file', new Blob([importBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'suppliers.xlsx');

    const importResult = await api('/api/suppliers/import', withAuth({ method: 'POST', body: form }));
    assert.equal(importResult.response.status, 200);
    assert.equal(importResult.body.created, 1);

    const exportResult = await fetchBinary('/api/suppliers/export?format=xlsx');
    assert.equal(exportResult.response.status, 200);
    const workbook = XLSX.read(exportResult.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    assert.equal(rows.length >= 1, true);
    assert.equal(rows[0].company, 'Komatsu VN');
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
