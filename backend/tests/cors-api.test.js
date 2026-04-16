require('ts-node/register');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-cors-'));
process.env.DB_PATH = path.join(tempDir, 'crm-cors.db');
process.env.CORS_ORIGINS = 'http://localhost:5173,http://localhost:4173';
delete process.env.IP_NETWORK;

const { initDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let failures = 0;

async function api(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
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

  await run('loopback GET requests allow Vite fallback ports on localhost and 127.0.0.1', async () => {
    const localhostResponse = await api('/api/health', {
      headers: { Origin: 'http://localhost:5174' },
    });
    assert.equal(localhostResponse.status, 200);
    assert.equal(localhostResponse.headers.get('access-control-allow-origin'), 'http://localhost:5174');

    const loopbackResponse = await api('/api/health', {
      headers: { Origin: 'http://127.0.0.1:5178' },
    });
    assert.equal(loopbackResponse.status, 200);
    assert.equal(loopbackResponse.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5178');
  });

  await run('loopback OPTIONS preflight requests allow Vite fallback ports', async () => {
    const response = await api('/api/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5175',
        'Access-Control-Request-Method': 'GET',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5175');
    assert.match(response.headers.get('access-control-allow-methods') || '', /GET/);
  });

  await run('non-loopback origins remain blocked unless explicitly configured', async () => {
    const response = await api('/api/health', {
      headers: { Origin: 'http://192.168.20.122:5174' },
    });
    const body = await readJson(response);

    assert.equal(response.status, 500);
    assert.deepEqual(body, { error: 'CORS: origin http://192.168.20.122:5174 not allowed' });
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
