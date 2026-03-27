import { describe, expect, it } from 'vitest';

import {
  AUDIT_DRIVERS,
  FAILURE_TYPES,
  resolveFrontendUrl,
  classifyFailureType,
  createFatalAuditSummary,
  renderAuditMarkdown,
} from '../../scripts/qa/ux-audit-contract.mjs';

describe('ux audit contracts', () => {
  it('prefers explicit env URL over contract URL', () => {
    expect(resolveFrontendUrl('http://127.0.0.1:5173', 'http://127.0.0.1:4999')).toBe('http://127.0.0.1:4999');
  });

  it('falls back to QA audit default frontend URL', () => {
    expect(resolveFrontendUrl('http://127.0.0.1:5173')).toBe('http://127.0.0.1:4173');
  });

  it('classifies startup and browser launch failures', () => {
    expect(classifyFailureType(new Error('Frontend is not reachable at http://127.0.0.1:4173'))).toBe(
      FAILURE_TYPES.STARTUP_UNREACHABLE,
    );
    expect(classifyFailureType(new Error('Không thể khởi chạy browser cho UX audit. Chi tiết: spawn EPERM'))).toBe(
      FAILURE_TYPES.BROWSER_LAUNCH_FAILED,
    );
    expect(classifyFailureType(new Error('selector stayed visible unexpectedly'))).toBe(
      FAILURE_TYPES.UNEXPECTED_VISIBILITY,
    );
  });

  it('creates fatal summary with unified driver and failure type fields', () => {
    const summary = createFatalAuditSummary({
      driver: AUDIT_DRIVERS.NODE_PLAYWRIGHT,
      frontendUrl: 'http://127.0.0.1:4173',
      backendUrl: 'http://127.0.0.1:3001',
      contractVersion: 'ux-regression-v1',
      failureType: FAILURE_TYPES.STARTUP_UNREACHABLE,
      error: 'Frontend is not reachable',
    });

    expect(summary.driver).toBe(AUDIT_DRIVERS.NODE_PLAYWRIGHT);
    expect(summary.failureType).toBe(FAILURE_TYPES.STARTUP_UNREACHABLE);
    expect(summary.failedJourneys).toBe(1);
    expect(summary.results[0]?.failureType).toBe(FAILURE_TYPES.STARTUP_UNREACHABLE);
  });

  it('renders markdown with driver and failure type', () => {
    const markdown = renderAuditMarkdown({
      generatedAt: '2026-03-27T05:00:00.000Z',
      driver: AUDIT_DRIVERS.CODEX_MCP,
      frontendUrl: 'http://127.0.0.1:4173',
      backendUrl: 'http://127.0.0.1:3001',
      contractVersion: 'ux-regression-v1',
      totalJourneys: 1,
      passedJourneys: 0,
      failedJourneys: 1,
      failureType: FAILURE_TYPES.BROWSER_LAUNCH_FAILED,
      results: [
        {
          id: 'bootstrap',
          persona: 'admin',
          status: 'failed',
          durationMs: 1,
          failureType: FAILURE_TYPES.BROWSER_LAUNCH_FAILED,
          screenshot: '',
          error: 'spawn EPERM',
        },
      ],
    });

    expect(markdown).toContain('Driver: codex-mcp');
    expect(markdown).toContain('Failure type: browser_launch_failed');
  });
});
