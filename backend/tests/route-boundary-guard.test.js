const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');

const coreRouteFiles = [
  'src/modules/auth/routes.ts',
  'src/modules/crm/routes.ts',
  'src/modules/tasks/routes.ts',
  'src/modules/projects/governanceRoutes.ts',
  'src/modules/projects/logisticsRoutes.ts',
  'src/modules/projects/readRoutes.ts',
  'src/modules/projects/supplierQuoteRoutes.ts',
  'src/modules/projects/workflowRoutes.ts',
  'src/modules/projects/writeRoutes.ts',
  'src/modules/platform/workspaceRoutes.ts',
  'src/modules/platform/reportingRoutes.ts',
  'src/modules/collaboration/routes.ts',
  'src/modules/quotations/routes/mutationRoutes.ts',
];

let failures = 0;

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

function containsDirectGetDbUsage(content) {
  return /\bgetDb\s*\(/.test(content);
}

run('core route files do not access sqlite directly via getDb', () => {
  const violations = [];

  for (const relativeFile of coreRouteFiles) {
    const absoluteFile = path.join(repoRoot, relativeFile);
    const content = fs.readFileSync(absoluteFile, 'utf8');
    if (containsDirectGetDbUsage(content)) {
      violations.push(relativeFile);
    }
  }

  assert.deepEqual(violations, []);
});

if (failures > 0) {
  process.exitCode = 1;
}
