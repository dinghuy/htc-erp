const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const bootstrapPath = path.join(repoRoot, 'src', 'persistence', 'sqlite', 'bootstrap.ts');

const TARGET_TABLES = [
  'Account',
  'Contact',
  'Lead',
  'Project',
  'Task',
  'ApprovalRequest',
  'ProjectDocument',
  'SalesOrder',
  'SupplierQuote',
  'ProjectProcurementLine',
  'ProjectInboundLine',
  'ProjectDeliveryLine',
  'ProjectMilestone',
  'ProjectExecutionBaseline',
  'Department',
  'HrRequest',
  'PublicHoliday',
  'Funnel',
  'ExchangeRate',
  'ContactChannel',
  'ProductCategory',
];

const FILES_TO_SCAN = [
  'src/modules/crm/repository.ts',
  'src/modules/crm/routes.ts',
  'src/modules/crm/channelRepository.ts',
  'src/modules/hr/repository.ts',
  'src/modules/hr/service.ts',
  'src/modules/funnel/repository.ts',
  'src/modules/funnel/service.ts',
  'src/modules/projects/repositoryProjectSummary.ts',
  'src/modules/projects/repositoryProjectWorkflow.ts',
  'src/modules/projects/repositoryProjectExecution.ts',
  'src/modules/projects/orchestration.ts',
  'src/modules/projects/writeRoutes.ts',
  'src/modules/projects/governanceRoutes.ts',
  'src/modules/projects/logisticsRoutes.ts',
  'src/modules/tasks/repository.ts',
  'src/modules/tasks/routes.ts',
  'src/modules/tasks/todoRepository.ts',
  'src/modules/tasks/timeSpendRepository.ts',
  'src/shared/exchange-rate/vcb.ts',
  'src/modules/products/categoryRepository.ts',
  'src/modules/platform/qaSeed.ts',
];

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function parseBootstrapPkTypes(source) {
  const map = new Map();
  const regex = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\)\s*`/g;
  let match;
  while ((match = regex.exec(source))) {
    const [, table, body] = match;
    const idLine = body
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/,+$/, ''))
      .find((line) => /^id\s+/i.test(line));
    map.set(table, idLine || 'unknown');
  }
  return map;
}

function collectTableFacts(table, bootstrapPkMap) {
  const facts = {
    table,
    bootstrapPk: bootstrapPkMap.get(table) || 'missing',
    modules: [],
    explicitIdInsert: false,
    uuidWritePath: false,
    usesLastId: false,
  };

  for (const relPath of FILES_TO_SCAN) {
    const absPath = path.join(repoRoot, relPath);
    const source = read(absPath);
    if (!source) continue;

    const mentionsTable = source.includes(table);
    const hasInsert = new RegExp(`INSERT INTO\\s+${table}\\b`).test(source);
    if (!mentionsTable && !hasInsert) continue;

    facts.modules.push(relPath);
    if (new RegExp(`INSERT INTO\\s+${table}\\s*\\(\\s*id\\b`).test(source)) {
      facts.explicitIdInsert = true;
    }
    if (hasInsert) {
      const insertRegex = new RegExp(`INSERT INTO\\s+${table}\\b([\\s\\S]{0,900})`, 'g');
      let insertMatch;
      while ((insertMatch = insertRegex.exec(source))) {
        const snippet = insertMatch[0];
        if (snippet.includes('uuidv4(') || snippet.includes('randomUUID(') || snippet.includes('createId(')) {
          facts.uuidWritePath = true;
          break;
        }
      }
    }
    if (source.includes('lastID')) {
      facts.usesLastId = true;
    }
  }

  facts.modules = Array.from(new Set(facts.modules));
  const pkText = facts.bootstrapPk.toLowerCase();
  const isIntegerPk = pkText.includes('integer primary key');
  if (!isIntegerPk) {
    facts.verdict = facts.explicitIdInsert || facts.uuidWritePath ? 'aligned-non-integer' : 'out-of-scope';
  } else if (facts.explicitIdInsert || facts.uuidWritePath) {
    facts.verdict = facts.usesLastId ? 'mixed' : 'mismatch';
  } else {
    facts.verdict = 'aligned';
  }
  return facts;
}

function toMarkdown(rows) {
  const lines = [
    '| Table | Bootstrap PK | Explicit id insert | UUID path | lastID | Verdict | Modules |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.table} | \`${row.bootstrapPk}\` | ${row.explicitIdInsert ? 'yes' : 'no'} | ${row.uuidWritePath ? 'yes' : 'no'} | ${row.usesLastId ? 'yes' : 'no'} | **${row.verdict}** | ${row.modules.join('<br>')} |`
    );
  }
  return lines.join('\n');
}

const bootstrapSource = read(bootstrapPath);
const bootstrapPkMap = parseBootstrapPkTypes(bootstrapSource);
const rows = TARGET_TABLES.map((table) => collectTableFacts(table, bootstrapPkMap));

const output = {
  generatedAt: new Date().toISOString(),
  rows,
};

const jsonPath = path.join(repoRoot, 'tmp', 'id-consistency-audit.json');
const mdPath = path.join(repoRoot, 'tmp', 'id-consistency-audit.md');
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
fs.writeFileSync(mdPath, toMarkdown(rows));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
console.log(toMarkdown(rows));
