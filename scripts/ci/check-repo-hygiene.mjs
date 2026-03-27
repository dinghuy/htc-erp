import { spawnSync } from 'node:child_process';

function listTrackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to list tracked files.');
  }
  const text = result.stdout || '';
  return text.split('\0').filter(Boolean);
}

const rules = [
  { label: 'node_modules', test: (path) => /(^|\/)node_modules\//.test(path) },
  { label: 'dist output', test: (path) => /(^|\/)dist\//.test(path) },
  { label: 'tmp workspace', test: (path) => /(^|\/)tmp\//.test(path) },
  { label: 'npm cache', test: (path) => /(^|\/)\.npm-cache\//.test(path) },
  { label: 'sqlite runtime data', test: (path) => /\.(db|db-shm|db-wal|sqlite|sqlite3)$/i.test(path) },
  { label: 'log artifact', test: (path) => /\.(log|err\.log|out\.log|err\.txt|out\.txt)$/i.test(path) },
  {
    label: 'dotenv secrets',
    test: (path) => {
      if (!/(^|\/)\.env(\.|$)/.test(path)) return false;
      return !/\.env\.example$/.test(path);
    },
  },
];

const trackedFiles = listTrackedFiles();
const violations = [];

for (const path of trackedFiles) {
  for (const rule of rules) {
    if (rule.test(path)) {
      violations.push({ path, rule: rule.label });
      break;
    }
  }
}

if (violations.length) {
  console.error('Repository hygiene check failed. Remove these tracked runtime/generated artifacts:');
  for (const violation of violations) {
    console.error(`- [${violation.rule}] ${violation.path}`);
  }
  process.exit(1);
}

console.log('Repository hygiene check passed.');
