declare module '../../scripts/qa/ux-audit-contract.mjs' {
  export const AUDIT_DRIVERS: any;
  export const FAILURE_TYPES: any;
  export function resolveFrontendUrl(...args: any[]): any;
  export function classifyFailureType(...args: any[]): any;
  export function createFatalAuditSummary(...args: any[]): any;
  export function renderAuditMarkdown(...args: any[]): any;
}

declare module '../../scripts/qa/ux-regression.manifest.mjs' {
  export const UX_REGRESSION_MANIFEST: any[];
  export const UX_SMOKE_ROUTES: any[];
}

declare module '../../scripts/qa/ux-regression.execution.mjs' {
  export const UX_AUDIT_EXECUTION_METADATA: Record<string, any>;
  export const CODEX_RUNBOOK_SECTIONS: Record<string, any>;
}
