require('ts-node/register');

const assert = require('node:assert/strict');

const { normalizeCreateMustChangePassword } = require('../src/modules/users/createPayload.ts');

let failures = 0;

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

async function main() {
  await run('normalizeCreateMustChangePassword preserves explicit false', async () => {
    assert.equal(normalizeCreateMustChangePassword(false), 0);
    assert.equal(normalizeCreateMustChangePassword(0), 0);
  });

  await run('normalizeCreateMustChangePassword defaults everything else to true', async () => {
    assert.equal(normalizeCreateMustChangePassword(true), 1);
    assert.equal(normalizeCreateMustChangePassword(undefined), 1);
    assert.equal(normalizeCreateMustChangePassword(null), 1);
  });

  await run('normalizeCreateMustChangePassword treats omitted value as first-login reset', async () => {
    assert.equal(normalizeCreateMustChangePassword(''), 1);
  });

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
