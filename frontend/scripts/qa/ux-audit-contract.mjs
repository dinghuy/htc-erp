export const AUDIT_DRIVERS = {
  NODE_PLAYWRIGHT: 'node-playwright',
  CODEX_MCP: 'codex-mcp',
};

export const FAILURE_TYPES = {
  STARTUP_UNREACHABLE: 'startup_unreachable',
  BROWSER_LAUNCH_FAILED: 'browser_launch_failed',
  ROUTE_GUARD_FAILURE: 'route_guard_failure',
  PERMISSION_LEAK: 'permission_leak',
  ESCAPE_HATCH_MISSING: 'escape_hatch_missing',
  UNEXPECTED_VISIBILITY: 'unexpected_visibility',
};

export const DEFAULT_QA_FRONTEND_URL = 'http://127.0.0.1:4173';
export const DEFAULT_QA_BACKEND_URL = 'http://127.0.0.1:3001';

export function resolveFrontendUrl(contractFrontendUrl, envFrontendUrl) {
  return envFrontendUrl || DEFAULT_QA_FRONTEND_URL || contractFrontendUrl;
}

export function classifyFailureType(error) {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes('is not reachable at') || message.includes('start the local service first')) {
    return FAILURE_TYPES.STARTUP_UNREACHABLE;
  }
  if (
    message.includes('không thể khởi chạy browser')
    || message.includes('unable to bootstrap a cdp browser')
    || (message.includes('spawn eperm') && message.includes('browser'))
  ) {
    return FAILURE_TYPES.BROWSER_LAUNCH_FAILED;
  }
  if (message.includes('back to admin') || message.includes('open settings') || message.includes('preview banner disappeared')) {
    return FAILURE_TYPES.ESCAPE_HATCH_MISSING;
  }
  if (message.includes('should not approve') || message.includes('exposed') || message.includes('permission leak')) {
    return FAILURE_TYPES.PERMISSION_LEAK;
  }
  if (message.includes('route') && (message.includes('did not render') || message.includes('missing nav item'))) {
    return FAILURE_TYPES.ROUTE_GUARD_FAILURE;
  }
  return FAILURE_TYPES.UNEXPECTED_VISIBILITY;
}

export function createAuditSummary({
  driver,
  frontendUrl,
  backendUrl,
  contractVersion,
  results,
}) {
  const normalizedResults = Array.isArray(results) ? results : [];
  return {
    generatedAt: new Date().toISOString(),
    driver,
    frontendUrl,
    backendUrl,
    contractVersion,
    totalJourneys: normalizedResults.length,
    passedJourneys: normalizedResults.filter((result) => result.status === 'passed').length,
    failedJourneys: normalizedResults.filter((result) => result.status === 'failed').length,
    failureType: normalizedResults.find((result) => result.status === 'failed')?.failureType ?? null,
    results: normalizedResults,
  };
}

export function createFatalAuditSummary({
  driver,
  frontendUrl,
  backendUrl,
  contractVersion,
  failureType,
  error,
}) {
  return createAuditSummary({
    driver,
    frontendUrl,
    backendUrl,
    contractVersion,
    results: [
      {
        id: 'bootstrap',
        persona: 'admin',
        status: 'failed',
        durationMs: 0,
        failureType,
        screenshot: '',
        error,
      },
    ],
  });
}

export function renderAuditMarkdown(summary) {
  const lines = [
    '# UX Regression Audit Report',
    '',
    `- Generated at: ${summary.generatedAt}`,
    `- Driver: ${summary.driver}`,
    `- Frontend: ${summary.frontendUrl}`,
    `- Backend: ${summary.backendUrl}`,
    `- Contract version: ${summary.contractVersion}`,
    `- Summary: ${summary.passedJourneys}/${summary.totalJourneys} passed`,
    `- Failure type: ${summary.failureType ?? 'none'}`,
    '',
    '## Results',
    '',
  ];

  for (const result of summary.results) {
    lines.push(`### ${result.id}`);
    lines.push(`- Persona: ${result.persona}`);
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Duration: ${result.durationMs}ms`);
    lines.push(`- Failure type: ${result.failureType ?? 'none'}`);
    lines.push(`- Screenshot: ${result.screenshot || 'none'}`);
    lines.push(`- Error: ${result.error || 'none'}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
