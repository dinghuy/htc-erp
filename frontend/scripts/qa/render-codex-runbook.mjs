import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CODEX_RUNBOOK_SECTIONS } from './ux-regression.execution.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..', '..');
const DOC_PATH = path.resolve(FRONTEND_ROOT, '..', 'docs', 'qa', 'ux-regression-codex-runbook.md');

export function renderCodexRunbookMarkdown() {
  const lines = [
    '# UX Regression Codex Runbook',
    '',
    'Runbook này dùng khi local Playwright runner bị chặn trong Codex nhưng vẫn cần chạy full audit bằng Playwright MCP/browser tools.',
    '',
    '## Startup',
    '',
    '1. Reset QA seed qua backend `/api/qa/reset-ux-seed` hoặc bootstrap fallback.',
    '2. Đảm bảo backend ở `http://127.0.0.1:3001`.',
    '3. Đảm bảo frontend audit ở `http://127.0.0.1:4173` hoặc set `QA_FRONTEND_URL`.',
    '4. Nếu local runner báo `browser_launch_failed`, chuyển sang MCP browser path.',
    '',
    '## Journeys',
    '',
  ];

  for (const journey of CODEX_RUNBOOK_SECTIONS.journeys) {
    lines.push(`### ${journey.id}`);
    lines.push(`- Persona: ${journey.persona}`);
    lines.push(`- Entry route: ${journey.entryRoute}`);
    lines.push(`- Notes: ${journey.notes}`);
    lines.push(`- Expected visible: ${journey.expectedVisible.join(', ')}`);
    lines.push(`- Expected hidden: ${journey.expectedHidden.join(', ')}`);
    lines.push(`- Escape actions: ${journey.escapeActions.join(', ')}`);
    lines.push('- Execution steps:');
    for (const step of journey.execution.steps) {
      lines.push(`  - ${step}`);
    }
    lines.push('');
  }

  lines.push('## Smoke Routes');
  lines.push('');
  for (const route of CODEX_RUNBOOK_SECTIONS.smokeRoutes) {
    lines.push(`- ${route}`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(path.dirname(DOC_PATH), { recursive: true });
  await writeFile(DOC_PATH, renderCodexRunbookMarkdown(), 'utf8');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
