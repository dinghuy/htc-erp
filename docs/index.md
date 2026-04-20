# HTC ERP Docs/Plan Index

This file is the source-of-truth entrypoint for active documentation and planning in the `htc-erp` repository.

## How To Use This Index

- Start here when you need to understand the current product, architecture, delivery rules, or active documentation work.
- Treat the files in the `Active Canonical Docs` and `Active Workstreams` sections as the default reading set.
- Treat archived historical material as reference-only unless an active doc links to it explicitly.

## Active Canonical Docs

### Product And Architecture

- `product/product-spec.md`: current product scope and success criteria
- `architecture/overview.md`: current modular-monolith architecture direction
- `architecture/huly-work-hub-roadmap.md`: active capability roadmap for Work Hub-style expansion
- `architecture/database-doctrine.md`: repo-specific database design doctrine for `htc-erp`
- `architecture/database-table-rationalization.md`: active keep/merge/remove/defer matrix for current SQLite tables
- `adr/ADR-0001-modular-monolith.md`: decision record for keeping the current stack and modular-monolith direction
- `adr/ADR-0002-backend-contract-ownership.md`: decision record for shared contract ownership boundaries
- `adr/ADR-0003-erp-outbox-state-model.md`: decision record for ERP outbox state normalization
- `adr/ADR-0004-sqlite-bootstrap-and-postgres-path.md`: decision record for local SQLite and production PostgreSQL path
- `adr/ADR-0005-module-boundary-rules.md`: decision record for thin handlers and module-owned workflow logic

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
- `runbooks/erp-outbox-operations.md`: ERP outbox inspection, retry, and dead-letter operator runbook
- `runbooks/mcp-orchestrator-setup.md`: project MCP orchestration setup
- `runbooks/ui-theme-principles.md`: UI theme and token discipline for frontend changes
- `ai/task-template.md`: template for new bounded implementation tasks

## OMX Workflow Skills

This checkout does not currently ship a repo-local OMX skill surface under `.codex/skills/`.

Use the installed global skill registry instead. If sandbox restrictions prevent direct reads from global skills under `%USERPROFILE%\.codex\skills\`, mirror only the needed skill into `tmp/skills-global/` with:

- `pwsh -NoLogo -NoProfile -File scripts/mirror-global-skills.ps1 -Skill <skill-name>`

Treat `tmp/skills-global/` as a local cache, not as canonical project-owned skills.

## Active Workstreams

The following workstream plans are active or decision-relevant and should be read as planning inputs, not as canonical truth on their own:

- `workstreams/ai-delivery-governance-plan.md`: delivery governance and AI execution discipline still shaping active implementation work
- `workstreams/approval-flow-plan.md`: approval-state expansion from quotation through delivery and ERP handoff
- `workstreams/cross-functional-v1-plan.md`: cross-role convergence plan for shell, persona, and workflow alignment
- `workstreams/home-projects-reports-ui-refactor-plan.md`: UI refactor plan for home, project, and reporting surfaces
- `workstreams/project-finance-workspace-plan.md`: project finance workspace convergence and pricing-in-workspace direction
- `workstreams/quotation-ui-convergence-plan.md`: active two-phase quotation UI cleanup and alternative-offer convergence plan
- `workstreams/role-permission-matrix-plan.md`: active role surface and permission convergence plan for UI and workspace behavior
- `workstreams/ux-ui-rebuild-plan.md`: active shell-first UX/UI rebuild plan bridging the extracted design bundle into the current frontend and revenue-flow surfaces
- `workstreams/ux-audit-plan.md`: deterministic UX audit and regression-suite plan for browser-driven verification

These plans must be interpreted alongside the canonical docs above. If a plan conflicts with canonical docs or current code reality, update the plan and/or canonical doc rather than treating the older wording as authoritative.

## Tracking Surfaces

- Linear project: `HTC ERP Docs/Plan Convergence`
- Notion page: `HTC ERP Docs/Plan Convergence`
- Notion task database: `HTC ERP Docs/Plan Tasks`

Use Linear as the execution tracker and Notion as the plan/evidence tracker.

## Lean Docs Rule

Keep `docs/` focused on active canonical docs, active workstreams, and current runbooks only.

Do not reintroduce the following into `docs/` unless they are explicitly promoted as active references:

- historical plan archives and branch-specific execution plans
- generated reports, exported PDFs, and temporary DOCX files
- one-off report-generation scripts
- large speculative or consolidated plans that duplicate canonical docs

If historical material must be preserved, keep it outside the default docs reading set and link it intentionally from an active canonical doc or workstream.

Current archive location for reference-only material:

- `archive/docs-reference/`

Agents should ignore this archive during normal work unless the user explicitly asks for historical context or file recovery.

## File Classification Rule

Use this rule when creating or moving files:

- Put repeated source-of-truth material in the active docs tree and link it from this index.
- Put active implementation plans that still drive execution in `docs/workstreams/` and list them in the `Active Workstreams` set.
- Put superseded plans, generated reports, exports, temporary document variants, and branch-specific execution notes in `archive/`.
- Put scratch work and disposable artifacts in `tmp/`, not in `docs/`.
- If a file should not be opened during routine task startup, do not leave it in the active docs reading set.
- When a workstream stops directing current execution, archive it and update this index in the same change.
