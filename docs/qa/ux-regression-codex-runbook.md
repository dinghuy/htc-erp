# UX Regression Codex Runbook

Runbook này dùng khi local Playwright runner bị chặn trong Codex nhưng vẫn cần chạy audit bằng browser/MCP tools.

## Startup

1. Reset QA seed qua backend `/api/qa/reset-ux-seed` hoặc bootstrap fallback.
2. Đảm bảo backend ở `http://127.0.0.1:3001`.
3. Đảm bảo frontend audit ở `http://127.0.0.1:4173` hoặc set `QA_FRONTEND_URL`.
4. Runtime role preview đã bị loại khỏi app; mọi journey phải dùng seeded QA account thật.

## Filtered Runs

Khi runner Node/Playwright chạy được, có thể giới hạn phạm vi bằng env vars:

```powershell
$env:QA_PERSONAS='accounting,legal'
cd frontend
npm run test:ux:audit
Remove-Item Env:QA_PERSONAS
```

```powershell
$env:QA_JOURNEY_IDS='accounting-finance-lane-boundary,legal-approval-boundary'
cd frontend
npm run test:ux:audit
Remove-Item Env:QA_JOURNEY_IDS
```

`QA_INCLUDE_SMOKE=1` bật smoke routes cho filtered run; nếu không set, smoke chỉ chạy mặc định khi không có filter.

## Journeys

### admin-settings-real-account
- Persona: `qa_admin`
- Entry route: Settings
- Notes: Regression anchor cho admin surface sau khi bỏ runtime role preview.
- Expected visible: [data-testid="route-settings"], [data-testid="settings-lane-nav"], [data-testid="settings-admin-summary-card"], [data-testid="settings-admin-runtime-card"]
- Execution steps:
  - Login as `qa_admin`.
  - Open `Settings`.
  - Confirm admin lane renders operational summary, module exposure, runtime controls, and policy cards.

### sales-commercial-guardrails
- Persona: `qa_sales`
- Entry route: My Work
- Expected visible: [data-testid="route-my-work"], [data-testid="my-work-focus-badge"], [data-testid="workspace-tab-commercial"]
- Expected hidden: finance/legal approval buttons for seeded sample approvals
- Execution steps:
  - Login as `qa_sales`.
  - Confirm My Work commercial focus badge.
  - Open representative workspace and verify commercial tab is editable.
  - Open Approvals and verify finance/legal approve actions stay hidden.

### pm-execution-read-only-commercial
- Persona: `qa_project_manager`
- Entry route: My Work
- Expected visible: [data-testid="route-my-work"], [data-testid="my-work-focus-badge"], [data-testid="workspace-tab-timeline"], [data-testid="workspace-tab-delivery"]
- Execution steps:
  - Login as `qa_project_manager`.
  - Confirm My Work execution focus badge.
  - Open representative workspace.
  - Verify timeline and delivery tabs are visible.
  - Open commercial tab and confirm actions stay read-only.

### sales-pm-unified-flow
- Persona: `qa_sales_pm`
- Entry route: My Work
- Expected visible: [data-testid="route-my-work"], [data-testid="my-work-focus-badge"], [data-testid="workspace-tab-commercial"], [data-testid="workspace-tab-timeline"]
- Execution steps:
  - Login as `qa_sales_pm`.
  - Confirm combined focus badge on My Work.
  - Open representative workspace.
  - Verify both commercial and timeline tabs exist without mode switching.

### procurement-exception-workspace
- Persona: `qa_procurement`
- Entry route: Inbox
- Expected visible: [data-testid="route-inbox"], [data-testid="inbox-department-focus-badge"], [data-testid="workspace-tab-procurement"], [data-testid="workspace-tab-delivery"]
- Expected hidden: [data-testid="workspace-tab-finance"], [data-testid="workspace-tab-legal"]
- Execution steps:
  - Login as `qa_procurement`.
  - Confirm Inbox procurement focus badge.
  - Open representative workspace.
  - Verify procurement and delivery tabs are visible while finance/legal stay hidden.

### accounting-finance-lane-boundary
- Persona: `qa_accounting`
- Entry route: Approvals
- Expected visible: [data-testid="route-approvals"], [data-testid="approvals-lane-focus-badge"], [data-testid="workspace-tab-finance"]
- Expected hidden: [data-testid="workspace-tab-legal"]
- Execution steps:
  - Login as `qa_accounting`.
  - Confirm Approvals finance focus badge.
  - Verify finance approve action exists while legal approve action does not.
  - Open representative workspace and confirm finance tab is visible while legal stays hidden.

### legal-approval-boundary
- Persona: `qa_legal`
- Entry route: Approvals
- Expected visible: [data-testid="route-approvals"], [data-testid="approvals-lane-focus-badge"], [data-testid="workspace-tab-legal"]
- Expected hidden: [data-testid="workspace-tab-finance"]
- Execution steps:
  - Login as `qa_legal`.
  - Confirm Approvals legal focus badge.
  - Verify legal approve action exists while finance approve action does not.
  - Open representative workspace and confirm legal tab is visible while finance stays hidden.

### director-executive-cockpit
- Persona: `qa_director`
- Entry route: Approvals
- Expected visible: [data-testid="route-approvals"], [data-testid="approvals-lane-focus-badge"], [data-testid="nav-item-reports"]
- Execution steps:
  - Login as `qa_director`.
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
