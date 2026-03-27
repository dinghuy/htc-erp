# UX Regression Codex Runbook

Runbook này dùng khi local Playwright runner bị chặn trong Codex nhưng vẫn cần chạy full audit bằng Playwright MCP/browser tools.

## Startup

1. Reset QA seed qua backend `/api/qa/reset-ux-seed` hoặc bootstrap fallback.
2. Đảm bảo backend ở `http://127.0.0.1:3001`.
3. Đảm bảo frontend audit ở `http://127.0.0.1:4173` hoặc set `QA_FRONTEND_URL`.
4. Nếu local runner báo `browser_launch_failed`, chuyển sang MCP browser path.

## Journeys

### admin-preview-viewer-escape
- Persona: viewer
- Entry route: Home
- Notes: Regression anchor for the original preview trap: viewer preview must still expose Settings and Back to Admin.
- Expected visible: [data-testid="role-preview-banner"], [data-testid="role-preview-open-settings"], [data-testid="role-preview-back-to-admin"], [data-testid="role-preview-preset-viewer"]
- Expected hidden: [data-testid="nav-item-users"]
- Escape actions: Open Settings from preview banner, Switch preset from preview banner, Back to Admin
- Execution steps:
  - Select Viewer preview preset from banner.
  - Confirm Home renders in read-only persona mode.
  - Open Settings from preview banner.
  - Switch preset to Sales from Settings preview panel.
  - Use Back to Admin and confirm admin navigation is restored.

### sales-commercial-guardrails
- Persona: sales
- Entry route: My Work
- Notes: Sales persona must keep commercial visibility while finance and legal approval surfaces remain hidden.
- Expected visible: [data-testid="route-my-work"], [data-testid="my-work-focus-badge"], [data-testid="workspace-tab-commercial"], [data-testid="project-workspace-preview-notice"]
- Expected hidden: [data-testid="workspace-tab-finance"], [data-testid="workspace-tab-legal"], [data-testid="nav-item-users"]
- Escape actions: Open Settings from preview banner, Back to Admin
- Execution steps:
  - Select Sales preview preset.
  - Confirm My Work commercial focus badge.
  - Open representative workspace from Settings.
  - Verify commercial tab is visible while finance/legal tabs stay hidden.
  - Open Approvals and verify finance/legal approve actions stay hidden.

### pm-execution-read-only-commercial
- Persona: project_manager
- Entry route: My Work
- Notes: Project Manager persona must see execution tabs but hit read-only boundaries in commercial surfaces.
- Expected visible: [data-testid="route-my-work"], [data-testid="my-work-focus-badge"], [data-testid="workspace-tab-timeline"], [data-testid="workspace-tab-delivery"], [data-testid="project-workspace-preview-notice"]
- Expected hidden: [data-testid="workspace-tab-finance"], [data-testid="workspace-tab-legal"]
- Escape actions: Open commercial tab in read-only mode, Back to Admin
- Execution steps:
  - Select Project Manager preview preset.
  - Confirm My Work execution focus badge.
  - Open representative workspace.
  - Verify timeline and delivery tabs are visible.
  - Open commercial tab and confirm read-only preview notice.

### sales-pm-unified-flow
- Persona: sales_pm_combined
- Entry route: My Work
- Notes: Combined persona must surface both commercial and execution flows without any explicit role switching.
- Expected visible: [data-testid="route-my-work"], [data-testid="my-work-focus-badge"], [data-testid="workspace-tab-commercial"], [data-testid="workspace-tab-timeline"]
- Expected hidden: [data-testid="workspace-tab-finance"], [data-testid="workspace-tab-legal"]
- Escape actions: Stay in unified queue without role switch, Back to Admin
- Execution steps:
  - Select Sales + PM preview preset.
  - Confirm combined focus badge on My Work.
  - Open representative workspace.
  - Verify both commercial and timeline tabs exist without mode switching.

### procurement-exception-workspace
- Persona: procurement
- Entry route: Inbox
- Notes: Procurement must focus exception handling and procurement/delivery visibility without pricing or finance leakage.
- Expected visible: [data-testid="route-inbox"], [data-testid="inbox-department-focus-badge"], [data-testid="workspace-tab-procurement"], [data-testid="workspace-tab-delivery"]
- Expected hidden: [data-testid="workspace-tab-commercial"], [data-testid="workspace-tab-finance"], [data-testid="workspace-tab-legal"]
- Escape actions: Back to Admin
- Execution steps:
  - Select Procurement preview preset.
  - Confirm Inbox procurement focus badge.
  - Open representative workspace.
  - Verify procurement and delivery tabs are visible while commercial stays hidden.

### accounting-finance-lane-boundary
- Persona: accounting
- Entry route: Approvals
- Notes: Accounting must be able to act in finance lane only and stay out of legal surfaces.
- Expected visible: [data-testid="route-approvals"], [data-testid="approvals-lane-focus-badge"], [data-testid="workspace-tab-finance"]
- Expected hidden: [data-testid="workspace-tab-legal"], [data-testid="nav-item-users"]
- Escape actions: Switch approval lanes, Back to Admin
- Execution steps:
  - Select Accounting preview preset.
  - Confirm Approvals finance focus badge.
  - Verify finance approve action exists while legal approve action does not.
  - Open representative workspace and confirm finance tab is visible while legal stays hidden.

### legal-approval-boundary
- Persona: legal
- Entry route: Approvals
- Notes: Legal must own contract and legal approval surfaces without finance approval capability.
- Expected visible: [data-testid="route-approvals"], [data-testid="approvals-lane-focus-badge"], [data-testid="workspace-tab-legal"]
- Expected hidden: [data-testid="workspace-tab-finance"]
- Escape actions: Switch approval lanes, Back to Admin
- Execution steps:
  - Select Legal preview preset.
  - Confirm Approvals legal focus badge.
  - Verify legal approve action exists while finance approve action does not.
  - Open representative workspace and confirm legal tab is visible while finance stays hidden.

### director-executive-cockpit
- Persona: director
- Entry route: Approvals
- Notes: Director must stay read-mostly, with executive approvals and report drill-down intact.
- Expected visible: [data-testid="route-approvals"], [data-testid="approvals-lane-focus-badge"], [data-testid="nav-item-reports"]
- Expected hidden: [data-testid="nav-item-users"]
- Escape actions: Navigate to Reports, Back to Admin
- Execution steps:
  - Select Director preview preset.
  - Confirm executive lane focus in Approvals.
  - Navigate to Reports cockpit.
  - Open representative workspace and confirm overview tab stays available.

## Smoke Routes

- Home
- My Work
- Inbox
- Approvals
- Projects
- Tasks
- Reports
- Settings
- Support
- EventLog

