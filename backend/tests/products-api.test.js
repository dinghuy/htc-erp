require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-products-'));
process.env.DB_PATH = path.join(tempDir, 'crm-products.db');

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

async function setup() {
  await initDb();
  const db = getDb();
  await db.run(
    `INSERT INTO Product (
      id, sku, name, category, unit, basePrice, currency, specifications, media, qbuData, technicalSpecs, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'legacy-product-1',
      'LEG-001',
      'Legacy Product One',
      'Legacy',
      'Chiếc',
      12345,
      'USD',
      'plain legacy specification text',
      'not-json-array',
      'not-json-object',
      'Legacy technical specs',
      'available',
    ]
  );

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

  await run('legacy product rows do not crash GET /api/products and return safe fallback types', async () => {
    const result = await api('/api/products');

    assert.equal(result.response.status, 200);
    assert.equal(Array.isArray(result.body), true);

    const row = result.body.find((item) => item.id === 'legacy-product-1');
    assert.ok(row);
    assert.deepEqual(row.specifications, { text: 'plain legacy specification text' });
    assert.deepEqual(row.media, []);
    assert.deepEqual(row.qbuData, {});
  });

  await run('legacy product rows do not crash GET /api/products/:id and return safe fallback types', async () => {
    const result = await api('/api/products/legacy-product-1');

    assert.equal(result.response.status, 200);
    assert.equal(result.body.id, 'legacy-product-1');
    assert.deepEqual(result.body.specifications, { text: 'plain legacy specification text' });
    assert.deepEqual(result.body.media, []);
    assert.deepEqual(result.body.qbuData, {});
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
