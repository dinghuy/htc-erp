import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ux audit launcher contracts', () => {
  it('supports CDP fallback after local Playwright launch failures', () => {
    const source = readFileSync(path.resolve(__dirname, '../../scripts/qa/run-ux-audit.mjs'), 'utf8');

    expect(source).toContain('connectOverCDP');
    expect(source).toContain('QA_CDP_URL');
    expect(source).toContain("mode: 'cdp'");
    expect(source).toContain('ensureWindowsCdpBrowser');
  });

  it('bridges PowerShell bootstrap failures back into the Node runner', () => {
    const nodeSource = readFileSync(path.resolve(__dirname, '../../scripts/qa/run-ux-audit.mjs'), 'utf8');
    const wrapperSource = readFileSync(path.resolve(__dirname, '../../scripts/qa/run-ux-audit.ps1'), 'utf8');

    expect(nodeSource).toContain('QA_CDP_BOOTSTRAP_ERROR');
    expect(nodeSource).toContain('throw new Error(process.env.QA_CDP_BOOTSTRAP_ERROR');
    expect(wrapperSource).toContain('$env:QA_CDP_BOOTSTRAP_ERROR');
    expect(wrapperSource).toContain('& node (Join-Path $PSScriptRoot \'run-ux-audit.mjs\')');
  });

  it('keeps the npm launcher pointed at the Windows CDP wrapper', () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    const script = packageJson.scripts['test:ux:audit'];
    const headedScript = packageJson.scripts['test:ux:audit:headed'];

    expect(script).toContain('run-ux-audit.ps1');
    expect(headedScript).toContain('run-ux-audit.ps1 -Headed');
  });
});
