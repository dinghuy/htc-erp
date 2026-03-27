import { UX_REGRESSION_MANIFEST, UX_SMOKE_ROUTES } from './ux-regression.manifest.mjs';

export const UX_AUDIT_EXECUTION_METADATA = {
  'admin-preview-viewer-escape': {
    steps: [
      'Select Viewer preview preset from banner.',
      'Confirm Home renders in read-only persona mode.',
      'Open Settings from preview banner.',
      'Switch preset to Sales from Settings preview panel.',
      'Use Back to Admin and confirm admin navigation is restored.',
    ],
  },
  'sales-commercial-guardrails': {
    steps: [
      'Select Sales preview preset.',
      'Confirm My Work commercial focus badge.',
      'Open representative workspace from Settings.',
      'Verify commercial tab is visible while finance/legal tabs stay hidden.',
      'Open Approvals and verify finance/legal approve actions stay hidden.',
    ],
  },
  'pm-execution-read-only-commercial': {
    steps: [
      'Select Project Manager preview preset.',
      'Confirm My Work execution focus badge.',
      'Open representative workspace.',
      'Verify timeline and delivery tabs are visible.',
      'Open commercial tab and confirm read-only preview notice.',
    ],
  },
  'sales-pm-unified-flow': {
    steps: [
      'Select Sales + PM preview preset.',
      'Confirm combined focus badge on My Work.',
      'Open representative workspace.',
      'Verify both commercial and timeline tabs exist without mode switching.',
    ],
  },
  'procurement-exception-workspace': {
    steps: [
      'Select Procurement preview preset.',
      'Confirm Inbox procurement focus badge.',
      'Open representative workspace.',
      'Verify procurement and delivery tabs are visible while commercial stays hidden.',
    ],
  },
  'accounting-finance-lane-boundary': {
    steps: [
      'Select Accounting preview preset.',
      'Confirm Approvals finance focus badge.',
      'Verify finance approve action exists while legal approve action does not.',
      'Open representative workspace and confirm finance tab is visible while legal stays hidden.',
    ],
  },
  'legal-approval-boundary': {
    steps: [
      'Select Legal preview preset.',
      'Confirm Approvals legal focus badge.',
      'Verify legal approve action exists while finance approve action does not.',
      'Open representative workspace and confirm legal tab is visible while finance stays hidden.',
    ],
  },
  'director-executive-cockpit': {
    steps: [
      'Select Director preview preset.',
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
