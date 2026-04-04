# HTC ERP Master Consolidated Plan

> Status: `proposed`
> Date: `2026-04-04`
> Purpose: merge the current product, architecture, workflow, UX, and feature plans into one execution plan that can act as the source of truth for implementation sequencing.
> Canonical baseline: `docs/product/product-spec.md`

## Summary

`htc-erp` should keep moving as a modular monolith centered on one revenue workflow:

`Lead -> Account/Contact -> Quotation -> Approval -> Sales Order -> Procurement/Inbound -> Delivery -> ERP outbox`

Everything else is secondary.

The current doc set contains good decisions, but they are spread across too many overlapping plans. The main problems are:

- core workflow decisions are split across product, approval, role, and workspace plans
- shell and UI cleanup is split into several partially overlapping frontend plans
- ops cockpit, project workspace, and home/dashboard improvements are not sequenced against the revenue-flow milestones
- delivery discipline for AI work exists, but it is not yet acting as the gate on every implementation stream

This plan consolidates those decisions into one roadmap with explicit dependencies, scope boundaries, and doc disposition.

## What Already Exists

- The product direction is already clear: a sales-and-operations CRM tightly coupled to ERP handoff, not a general-purpose collaboration suite.
- The repo direction is already clear: keep the current Preact/Vite + Express/TypeScript stack, but continue modularizing it.
- The role model direction is already clear: multi-role users, shared project workspace, approval inbox, combined `sales + project_manager` persona where needed.
- The approval-flow direction is already clear: milestone-based gates, not approval on every field edit.
- Several focused frontend plans already exist and are useful, especially for shell navigation, adaptive home, mobile behavior, UI standardization, and project/workspace refinement.
- QA discipline is already pointed in the right direction: browser-driven regression, deterministic seed data, and explicit UAT/runbooks.

## Current Repo Evidence

The plan should be read against the current codebase, not as a blank-sheet rewrite.

- Canonical domain contracts already exist in `backend/src/shared/contracts/domain.ts`, including roles, action permissions, quotation/project/approval enums, workspace tabs, approval lanes, and audit payload types.
- Shell grouping is already partially implemented in `frontend/src/Layout.tsx` and its extracted navigation helpers. The grouped `Workspace / Master data / Admin` model is not speculative anymore.
- Persona-aware home rendering is already partially implemented in `frontend/src/Home.tsx` with split executive/operator views and a home-specific view-model layer.
- Quotation status helper logic already exists in `backend/quotation-status.ts`, which means quotation-state hardening is a continuation task, not a net-new design task.
- Ops derived-state work already exists in `frontend/src/ops/ganttDerived.ts`, including risk classification, preset handling, assignee-load logic, and auto-expand behavior.

Because of this, several streams in this roadmap are best understood as `stabilize + align + finish` rather than `create from zero`.

## Not In Scope

These items stay out of the mainline until the core roadmap is stable:

- broad collaboration-suite expansion not anchored to the revenue workflow
- full rewrite to a different framework or architecture
- advanced analytics beyond operational reporting
- deep support/chat expansion
- broad visual redesigns that do not improve workflow clarity, speed, or correctness
- large backend API rewrites for ops cockpit features before the core workflow contracts are stable

## Planning Principles

1. Revenue flow first. Any work that does not improve correctness, control, or speed of the revenue flow is secondary.
2. Shared contracts before UI polish. Role, status, approval, workspace, and audit contracts come before surface-level refactors.
3. One project workspace. Pricing, procurement, legal, finance, delivery, tasks, and approvals converge around one central record.
4. Admin is system-only by default. Business approval authority comes from explicit business roles, not from admin status.
5. UX must reduce ambiguity, not add style. Shell, home, dashboard, and reports work only if they make the next action obvious.
6. AI work must be bounded and testable. Every stream needs explicit contracts, test seams, and deterministic verification.

## Master Workstreams

## 1. Platform Foundation And Delivery Governance

This stream stabilizes how the product is built.

Scope:

- modular-monolith boundaries for backend and frontend
- canonical shared enums and contracts
- SQLite local continuity with clean migration path toward PostgreSQL for serious environments
- AI delivery rules, task templates, runbooks, UAT, and regression harnesses

Required outputs:

- canonical domain/status/permission contracts
- module ownership map
- AI-ready execution template and Definition of Ready / Done
- deterministic QA seed and browser-driven UX regression suite

Why first:

Without this stream, every later feature plan keeps reinventing types, route rules, and verification.

## 2. Identity, Role, Navigation, And Workspace Architecture

This stream defines how users move through the product and what they are allowed to do.

Scope:

- multi-role users and persona composition
- role homes, shared `My Work`, `Inbox`, `Approvals`
- one grouped shell navigation model across desktop and mobile
- project workspace as the central record
- tab visibility and action availability by capability

Required outputs:

- `ROLE_MODULE_ACCESS`, `ROLE_WORKSPACE_TABS`, `ROLE_ACTION_PERMISSIONS`, `APPROVAL_PERMISSION_MAP`
- grouped shell taxonomy: `Workspace`, `Master data`, `Admin`
- persona-aware home routing and template mapping
- audit fields that preserve `actingCapability`

Why second:

Revenue-flow and frontend decisions both depend on stable navigation and permission contracts.

## 3. Revenue Workflow And Approval State Machine

This stream is the actual business engine.

Scope:

- quotation lifecycle
- approval gates
- sales-order release
- procurement/inbound gating
- delivery release and completion
- ERP outbox trigger boundaries

Required outputs:

- normalized workflow enums and guard logic
- milestone-based approval gates by role
- structured server-side transition validation
- read-only behavior for locked or terminal workflow states
- auditable state transitions and outbox events

Why third:

Once identity and workspace structure are stable, the workflow engine becomes the highest-leverage product work.

## 4. Project Workspace Convergence

This stream makes the project workspace the place where the workflow actually lives.

Scope:

- pricing inside finance / `Quản lý chi phí`
- commercial, procurement, delivery, finance, legal, tasks, timeline, and documents in one workspace
- role-specific tabs and read/write boundaries
- project handoff quality and risk visibility

Required outputs:

- project workspace tab composition
- embedded pricing in finance tab
- procurement / legal / finance / director review surfaces
- clean handoff from quotation to execution

Why fourth:

The workflow engine is only useful if users can execute it in one coherent workspace instead of bouncing between modules.

## 5. UI System, Shell Simplification, And Core Surface Cleanup

This stream improves how the product reads, not what the product fundamentally does.

Scope:

- token-preserving UI standardization
- shell navigation simplification
- adaptive home by persona
- refactor of `Home`, `Projects`, `Reports`
- mobile responsive pass
- overlay/modal standardization
- small targeted UI corrections already planned

Required outputs:

- shared UI primitives and tokenized styles
- one primary navigation surface
- KPI-first executive home and action-first operator home
- responsive shell and mobile data-card patterns
- fewer duplicate actions, duplicated badges, and noisy header layers

Why fifth:

This work matters, but it should ride on top of stable role/workspace/workflow contracts instead of leading them.

## 6. Ops Lead Cockpit And Operational Triage

This stream upgrades `Vận hành > Gantt` into an actual coordination tool.

Scope:

- risk model
- assignee load
- command bar
- preset filters
- smarter expansion
- safe fallback for missing timeline data

Required outputs:

- derived ops state layer
- explicit risk classification
- actionable metric strip
- project-first default with ops triage overlays

Why sixth:

Ops Gantt is high-value, but it should consume the stabilized workflow/project data instead of driving it prematurely.

## 7. Deferred But Valid Follow-On Work

These remain valid, but they are not on the critical path:

- quotation PDF pixel-perfect rebuild
- CSV export + bulk selection
- user-language i18n
- image upload compression
- Huly-inspired work hub expansion after Phase 1

These should stay visible in backlog, not disappear, but they should not compete with the core path.

## Execution Phases

## Phase 0. Plan Convergence And Governance Lock

Objective:
turn the current doc collection into one navigable source of truth and lock the execution rules.

Deliver:

- this master plan
- explicit status on source plans: adopt, merge, defer, archive
- AI execution rules aligned to `spec -> task -> code -> test -> UAT -> merge`
- deterministic QA seed and regression ownership model confirmed

Exit criteria:

- future implementation work can point to one master plan plus one focused spec
- no new overlapping top-level plan is created without a clear relationship to this plan

## Phase 1. Canonical Contracts

Objective:
freeze and finish the shared contracts that later streams depend on.

Deliver:

- canonical role, permission, persona, workflow, approval, and audit contracts, with the current partial implementations promoted to source-of-truth status
- multi-role user model completed end-to-end where still partial
- route/module/tab/action capability maps aligned across backend and frontend
- workflow enums for quotation, approval, sales order, procurement, inbound, delivery, and project stage, with no parallel drift

Exit criteria:

- frontend and backend stop carrying parallel copies of business logic
- route protection and action gating can be asserted deterministically

## Phase 2. Shell And Workspace Skeleton

Objective:
stabilize the shell and workspace structure before deeper feature work.

Deliver:

- simplified shell navigation, finishing the grouped shell model already present in code
- persona-aware `Home`, finishing and de-risking the executive/operator split already present in code
- grouped desktop/mobile navigation with no duplicate chrome
- shared project workspace shell with role-safe tab composition
- pricing convergence into finance tab

Exit criteria:

- one navigation model across device sizes
- one project workspace shape across roles
- no standalone pricing route/module left in primary navigation

## Phase 3. Revenue Workflow Hardening

Objective:
lock the business engine and approval boundaries around the existing partial workflow helpers.

Deliver:

- quotation status transition validation and remind logic, completed through API and UI surfaces instead of helper-only partials
- approval-gate engine
- sales-order release rules
- project handoff controls
- ERP outbox trigger boundaries and auditability

Exit criteria:

- critical transitions are guarded server-side
- users cannot bypass workflow through direct form updates
- approval ownership is role-based and explicit

## Phase 4. Cross-Functional Workspace Depth

Objective:
make the workspace usable by every participating role in the flow.

Deliver:

- procurement, accounting, legal, and director cockpit layers in workspace
- queue/inbox/approval convergence
- workspace tab read/write rules
- financial warnings such as exchange-rate/QBU drift where relevant

Exit criteria:

- each role sees one coherent view of the same project record
- execution handoff quality improves without Excel-only side channels

## Phase 5. Core Surface Cleanup

Objective:
reduce ambiguity and density on the highest-traffic screens.

Deliver:

- tokenized UI cleanup
- `Home + Projects + Reports` refactor
- overlay/modal standardization
- mobile responsive behavior for key flows
- targeted visual fixes that survived earlier plans

Exit criteria:

- users can identify goal, state, and next action quickly on primary screens
- mobile view is usable for view/approve and lightweight execution
- shell/header no longer competes with content

## Phase 6. Ops Lead Triage Surface

Objective:
make operations coordination fast and risk-aware.

Deliver:

- Phase 1 ops gantt improvements from derived state
- command metrics, preset filters, risk rollup, assignee-load view

Exit criteria:

- ops lead can answer “what needs intervention now?” from the first screenful

## Dependencies That Must Be Respected

1. Role and workflow contracts must land before broad workspace/UI convergence.
2. Shell simplification and adaptive home must use the final role/persona model, not invent a competing one.
3. Pricing-in-finance convergence must follow workspace-tab contract finalization.
4. Exchange-rate/QBU warning work should land after workspace finance composition is stable.
5. Ops Gantt should consume stable project/task/workflow semantics rather than define them.
6. Broad mobile/responsive cleanup should follow the shell/workspace composition pass, otherwise the team will make the same layout decisions twice.

## Source Artifact Disposition

## Adopt Directly Into The Master Plan

- `docs/product/product-spec.md`
- `docs/ai-delivery-governance-plan.md`
- `docs/role-permission-matrix-plan.md`
- `docs/cross-functional-v1-plan.md`
- `docs/approval-flow-plan.md`
- `docs/project-finance-workspace-plan.md`
- `docs/ux-audit-plan.md`

These contain foundational decisions and should be treated as merged into this plan, not as separate competing roadmaps.

## Merge As Supporting Specs Under Active Workstreams

### Identity / shell / home / UI

- `docs/home-projects-reports-ui-refactor-plan.md`
- `docs/superpowers/plans/2026-03-23-ui-standardization-plan.md`
- `docs/superpowers/specs/2026-03-23-ui-standardization-design.md`
- `docs/superpowers/plans/2026-03-23-mobile-ui-responsive-plan.md`
- `docs/superpowers/specs/2026-03-23-mobile-ui-responsive-design.md`
- `docs/superpowers/plans/2026-03-27-shell-navigation-simplification-plan.md`
- `docs/superpowers/specs/2026-03-27-shell-navigation-simplification-design.md`
- `docs/superpowers/plans/2026-03-28-adaptive-home-by-persona-plan.md`
- `docs/superpowers/specs/2026-03-28-adaptive-home-by-persona-design.md`
- `docs/superpowers/plans/2026-03-23-overlay-modal-implementation-plan.md`
- `docs/superpowers/specs/2026-03-23-overlay-modal-design.md`
- `docs/superpowers/plans/2026-03-23-content-padding-10px-plan.md`
- `docs/superpowers/specs/2026-03-23-content-padding-10px-design.md`
- `docs/superpowers/plans/2026-03-23-hide-leads-reports-plan.md`
- `docs/superpowers/specs/2026-03-23-hide-leads-reports-design.md`
- `docs/superpowers/plans/2026-03-23-ui-optimization-full-plan.md`
- `docs/superpowers/specs/2026-03-23-ui-optimization-full-design.md`

### Workflow / quotation / workspace

- `docs/superpowers/plans/2026-03-23-quotation-status-remind-plan.md`
- `docs/superpowers/specs/2026-03-23-quotation-status-remind-design.md`
- `docs/superpowers/plans/2026-03-23-exchange-rate-qbu-plan.md`
- `docs/superpowers/specs/2026-03-23-exchange-rate-qbu-design.md`
- `docs/superpowers/plans/2026-03-23-quotations-action-panel-position-plan.md`
- `docs/superpowers/specs/2026-03-23-quotations-action-panel-position-design.md`
- `docs/superpowers/plans/2026-03-23-quotations-action-buttons-horizontal-plan.md`
- `docs/superpowers/specs/2026-03-23-quotations-action-buttons-horizontal-design.md`

### Ops cockpit

- `docs/superpowers/plans/2026-03-26-ops-gantt-phase-1-implementation.md`
- `docs/superpowers/specs/2026-03-26-ops-gantt-hybrid-lens-design.md`

These remain useful as execution-level plans/specs inside their workstreams, but they should no longer be read as standalone product-roadmap sources.

## Defer To Backlog After Core Roadmap

- `docs/architecture/huly-work-hub-roadmap.md`
- `docs/superpowers/plans/2026-03-22-quotation-pdf-implementation.md`
- `docs/superpowers/specs/2026-03-22-quotation-pdf-design.md`
- `docs/superpowers/plans/2026-03-22-db-persistence-supabase-plan.md`
- `docs/superpowers/specs/2026-03-22-db-persistence-supabase-design.md`
- `docs/superpowers/specs/2026-03-23-csv-export-bulk-selection-design.md`
- `docs/superpowers/specs/2026-03-24-user-language-i18n-design.md`
- `docs/superpowers/specs/2026-03-27-image-compression-design.md`

They are still valid, but they should not outrank the mainline phases above.

## Risks

## 1. Too Many Frontend Plans For The Same Surfaces

There are several valid shell/home/UI plans, but they overlap heavily. If executed independently, they will cause churn and duplicate refactors.

Decision:
execute them as one coordinated shell-and-surface stream, not as unrelated tasks.

## 2. Workflow Contracts Could Still Drift

Role model, approval model, workspace tabs, and quotation state rules are all specified, but not yet clearly frozen in one place.

Decision:
Phase 1 must produce the canonical contract package before large feature work resumes.

## 3. Workspace Convergence Can Turn Into Module Sprawl

Pricing, procurement, delivery, finance, legal, and reports can easily become a collection of tabs with no shared orchestration model.

Decision:
every tab added to the workspace must answer one question: how does it move or control the revenue flow?

## 4. QA Discipline Exists On Paper Faster Than In Daily Habit

The UX regression and AI governance docs are strong. The risk is execution drift.

Decision:
each active workstream must specify its deterministic test seam and browser/UAT path before code starts.

## Taste Decisions

These are viable in both directions, but the master plan recommends one path:

- Keep `admin` in the executive home family for now, but revisit later if system-ops needs diverge too far from director needs.
- Keep the current visual identity and dark palette while cleaning information hierarchy. Do not rebrand mid-roadmap.
- Treat Huly-style collaboration as a later expansion, not a current architecture driver.

## Recommended Next Slice

The highest-leverage next implementation slice is:

1. freeze canonical role, permission, persona, workflow, and audit contracts
2. simplify shell navigation and home composition around those contracts
3. converge pricing into workspace finance
4. enforce quotation and approval state transitions server-side

That sequence kills the most ambiguity with the least wasted work.

## Verification Standard

Every implementation plan derived from this master plan must include:

- exact files/modules touched
- contract changes, if any
- backend/frontend tests or browser/UAT steps
- role/permission regression checks when navigation or workflow is touched
- audit or outbox verification when business state changes are involved

## Final Direction

Treat this document as the top-level roadmap.

Use focused spec files for one bounded workstream at a time, but do not create new top-level plans that compete with it unless the product direction itself changes.
