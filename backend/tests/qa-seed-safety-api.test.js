require('ts-node/register');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpRoot = os.tmpdir();
const guardDir = fs.mkdtempSync(path.join(tmpRoot, 'live-primary-db-'));
const dbPath = path.join(guardDir, 'primary.db');
process.env.DB_PATH = dbPath;

const { initDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
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

  const bootstrap = await api('/api/qa/bootstrap-ux-seed', {
    method: 'POST',
    headers: {
      'x-qa-bootstrap': 'ux-seed-local-only',
    },
  });

  assert.equal(bootstrap.response.status, 409);
  assert.match(bootstrap.body.error, /blocked for the primary database/i);

  const auth = await login('admin', 'admin123');
  assert.equal(auth.response.status, 200);

  const reset = await api('/api/qa/reset-ux-seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.body.token}`,
    },
  });

  assert.equal(reset.response.status, 409);
  assert.match(reset.body.error, /blocked for the primary database/i);

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

main().catch(async (error) => {
  console.error(error);
  if (server) {
    await new Promise((resolve) => server.close(() => resolve()));
  }
  process.exitCode = 1;
});
