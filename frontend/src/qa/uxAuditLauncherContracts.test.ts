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
});
