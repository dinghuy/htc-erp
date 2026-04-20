require('ts-node/register');

const assert = require('node:assert/strict');
const path = require('node:path');

const { resolveDefaultSqliteDbPath, resolveSqliteDbPath } = require('../src/persistence/sqlite/runtime.ts');

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run('uses backend/crm.db for ts-node runtime', () => {
  const runtimeDir = path.resolve(__dirname, '..');
  const resolved = resolveDefaultSqliteDbPath(runtimeDir);
  assert.equal(resolved, path.join(runtimeDir, 'crm.db'));
});

run('uses backend/crm.db for built dist runtime', () => {
  const backendRoot = path.resolve(__dirname, '..');
  const runtimeDir = path.join(backendRoot, 'dist');
  const resolved = resolveDefaultSqliteDbPath(runtimeDir);
  assert.equal(resolved, path.join(backendRoot, 'crm.db'));
});

run('prefers DB_PATH when explicitly provided', () => {
  const backendRoot = path.resolve(__dirname, '..');
  const fallback = resolveDefaultSqliteDbPath(backendRoot);
  const resolved = resolveSqliteDbPath('  ./tmp/custom.db  ', fallback);
  assert.equal(resolved, path.resolve('./tmp/custom.db'));
});
