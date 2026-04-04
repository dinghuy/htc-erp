# HTC ERP Docs/Plan Index

This file is the source-of-truth entrypoint for active documentation and planning in the `htc-erp` repository.

## How To Use This Index

- Start here when you need to understand the current product, architecture, delivery rules, or active documentation work.
- Treat the files in the `Active Canonical Docs` and `Active Workstreams` sections as the default reading set.
- Treat historical `docs/superpowers/*` artifacts as reference-only unless an active doc links to them explicitly.

## Active Canonical Docs

### Product And Architecture

- `product/product-spec.md`: current product scope and success criteria
- `architecture/overview.md`: current modular-monolith architecture direction
- `architecture/huly-work-hub-roadmap.md`: active capability roadmap for Work Hub-style expansion

### Domain And API

- `domain/canonical-model.md`: canonical business entities and status concepts
- `api/api-catalog.md`: current API ownership map and delivery gates
- `api/erp-outbox-contract.md`: stable ERP outbox contract and status model

### Delivery And QA

- `process/definition-of-ready.md`: minimum readiness gate for bounded work
- `process/definition-of-done.md`: completion gate for bounded work
- `process/release-gate.md`: release-blocking requirements
- `process/execution-backlog-core-revenue-flow.md`: active delivery backlog for core revenue flow
- `qa/release-checklist.md`: release checklist
- `qa/uat-checklist-core-revenue-flow.md`: UAT checklist for the core flow
- `qa/ux-regression-core.md`: UX regression scope and invariants
- `qa/ux-regression-codex-runbook.md`: Codex-specific UX audit execution path

### Runbooks And AI Delivery

- `runbooks/developer-runbook.md`: local development workflow and repo conventions
- `runbooks/environment-strategy.md`: environment direction and constraints
- `runbooks/backup-and-rollback.md`: rollback and recovery procedures
- `runbooks/secret-management.md`: secret handling rules
- `runbooks/mcp-orchestrator-setup.md`: project MCP orchestration setup
- `ai/task-template.md`: template for new bounded implementation tasks

## OMX Workflow Skills

Use the project-local OMX skill surface under `.codex/skills/` as follows:

- `app-delivery-orchestrator`: default delivery entrypoint when the task needs Linear, Notion, Figma, or Playwright context
- `frontend-change-flow`: frontend-specific implementation and verification path
- `backend-api-change-flow`: backend/API-specific implementation and verification path
- `release-regression-verification`: cross-surface handoff and regression verification path

Treat `crm-delivery-orchestrator` as legacy compatibility only for historical `crm-app` references. It is not the default for active `htc-erp` work.

If sandbox restrictions prevent direct reads from global skills under `%USERPROFILE%\.codex\skills\`, mirror only the needed skill into `tmp/skills-global/` with:

- `pwsh -NoLogo -NoProfile -File scripts/mirror-global-skills.ps1 -Skill <skill-name>`

Treat `tmp/skills-global/` as a local cache, not as canonical project-owned skills.

## Active Workstreams

The following top-level plans are active or decision-relevant and should be read as planning inputs, not as canonical truth on their own:

- `ai-delivery-governance-plan.md`
- `approval-flow-plan.md`
- `cross-functional-v1-plan.md`
- `home-projects-reports-ui-refactor-plan.md`
- `project-finance-workspace-plan.md`
- `role-permission-matrix-plan.md`
- `ux-audit-plan.md`

These plans must be interpreted alongside the canonical docs above. If a plan conflicts with canonical docs or current code reality, update the plan and/or canonical doc rather than treating the older wording as authoritative.

## Tracking Surfaces

- Linear project: `HTC ERP Docs/Plan Convergence`
- Notion page: `HTC ERP Docs/Plan Convergence`
- Notion task database: `HTC ERP Docs/Plan Tasks`

Use Linear as the execution tracker and Notion as the plan/evidence tracker.

## Reference-Only Material

The following are not active source-of-truth by default:

- `docs/superpowers/plans/*`
- `docs/superpowers/specs/*`
- generated reports, exported PDFs, temporary DOCX files, and one-off report scripts in `docs/`

At the moment, no historical `docs/superpowers/*` artifact is active by default. Promote one only by linking it intentionally from an active canonical doc or active workstream.

Only rely on these reference artifacts when an active canonical doc or active workstream links to them intentionally.
