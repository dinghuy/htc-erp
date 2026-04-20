import { UX_REGRESSION_MANIFEST, UX_SMOKE_ROUTES } from './ux-regression.manifest.mjs';

export const UX_AUDIT_EXECUTION_METADATA = {
  'admin-settings-real-account': {
    steps: [
      'Login as qa_admin.',
      'Open Settings from navigation.',
      'Confirm admin lane renders operational summary, exposure, and runtime controls.',
    ],
  },
  'sales-commercial-guardrails': {
    steps: [
      'Login as qa_sales.',
      'Confirm My Work commercial focus badge.',
      'Open representative workspace from Projects.',
      'Verify commercial tab is visible while finance/legal tabs stay hidden.',
      'Open Approvals and verify finance/legal approve actions stay hidden.',
    ],
  },
  'pm-execution-read-only-commercial': {
    steps: [
      'Login as qa_pm.',
      'Confirm My Work execution focus badge.',
      'Open representative workspace.',
      'Verify timeline and delivery tabs are visible.',
      'Open commercial tab and confirm read-only workspace notice.',
    ],
  },
  'sales-pm-unified-flow': {
    steps: [
      'Login as qa_sales_pm.',
      'Confirm combined focus badge on My Work.',
      'Open representative workspace.',
      'Verify both commercial and timeline tabs exist without mode switching.',
    ],
  },
  'procurement-exception-workspace': {
    steps: [
      'Login as qa_procurement.',
      'Confirm Inbox procurement focus badge.',
      'Open representative workspace.',
      'Verify procurement and delivery tabs are visible while commercial/finance/legal stay hidden.',
    ],
  },
  'accounting-finance-lane-boundary': {
    steps: [
      'Login as qa_accounting.',
      'Confirm Approvals finance focus badge.',
      'Verify finance approve action exists while legal approve action does not.',
      'Open representative workspace and confirm finance tab is visible while legal stays hidden.',
    ],
  },
  'legal-approval-boundary': {
    steps: [
      'Login as qa_legal.',
      'Confirm Approvals legal focus badge.',
      'Verify legal approve action exists while finance approve action does not.',
      'Open representative workspace and confirm legal tab is visible while finance stays hidden.',
    ],
  },
  'director-executive-cockpit': {
    steps: [
      'Login as qa_director.',
      'Confirm executive lane focus in Approvals.',
      'Navigate to Reports cockpit.',
      'Open representative workspace and confirm overview tab stays available.',
    ],
  },
};

export const CODEX_RUNBOOK_SECTIONS = {
  title: 'Codex UX Audit Runbook',
  journeys: UX_REGRESSION_MANIFEST.map((journey) => ({
    ...journey,
    execution: UX_AUDIT_EXECUTION_METADATA[journey.id],
  })),
  smokeRoutes: UX_SMOKE_ROUTES,
};
