const { spawn } = require('node:child_process');
const path = require('node:path');

const suites = {
  core: [
    'tests/auth-api.test.js',
    'tests/admin-settings-api.test.js',
    'tests/security-hardening-api.test.js',
    'tests/workspace-api.test.js',
    'tests/qa-seed-api.test.js',
    'tests/api-v1-alias.test.js',
    'tests/pricing-api.test.js',
    'tests/pricing-compute.test.js',
    'tests/activities-api.test.js',
    'tests/db-init.test.js',
    'tests/quotation-create-flow.test.js',
    'tests/revenue-flow-contracts.test.js',
    'tests/route-boundary-guard.test.js',
    'tests/work-hub-api.test.js',
    'tests/work-hub-phase2-api.test.js',
    'tests/task-view-presets-api.test.js',
    'tests/project-activity-stream-api.test.js',
    'tests/task-checklist-api.test.js',
    'tests/task-subtasks-api.test.js',
    'tests/task-bulk-actions-api.test.js',
    'tests/task-reorder-api.test.js',
    'tests/project-task-reorder-api.test.js',
  ],
  noncore: [
    'tests/gender-api.test.js',
    'tests/support-api.test.js',
    'tests/products-api.test.js',
    'tests/tabular-import-api.test.js',
  ],
};

function runNodeTest(testFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['-r', './tests/bootstrap-test-env.js', testFile],
      {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
        },
      },
    );

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${testFile} exited with code ${code}`));
    });

    child.on('error', reject);
  });
}

async function main() {
  const suiteName = process.argv[2];
  const tests = suites[suiteName];
  if (!tests) {
    console.error(`Unknown suite "${suiteName}". Expected one of: ${Object.keys(suites).join(', ')}`);
    process.exit(1);
  }

  for (const testFile of tests) {
    await runNodeTest(testFile);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
