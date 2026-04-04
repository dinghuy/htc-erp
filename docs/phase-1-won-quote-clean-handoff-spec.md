# Phase 1 Spec: Won Quote -> Clean Handoff

> Status: `implemented in branch`
> Date: `2026-04-04`
> Source wedge: [2026-04-04-sales-pm-handoff-design.md](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\docs\office-hours\2026-04-04-sales-pm-handoff-design.md)
> Roadmap context: [master-consolidated-plan.md](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\docs\master-consolidated-plan.md)
> Goal: turn the approved `Sales-PM handoff` wedge into one bounded implementation slice with exact files, one primary metric, workflow/permission regression coverage, and a hard stop before cross-functional expansion.

## Summary

Phase 1 does one thing:

When a quotation becomes `won`, HTC ERP must make the next execution step obvious, allowed, and auditable.

That means the system must expose, within one coherent flow:

- the linked project/workspace
- the next owner role or approval lane
- the next allowed action
- the blockers preventing progression

This is not “build the full cross-functional workspace.” This is “stop won deals from disappearing into spreadsheet rows, chat threads, and tribal memory.”

## Primary Metric

### Handoff Activation SLA

`% of won quotations that reach an activated handoff within 4 business hours`

### Activated handoff definition

A quotation counts as activated only when all of these are true:

1. the quotation is linked to a project workspace
2. the workspace exposes one explicit next-step action for the correct role, for example:
   - `Tạo sales order`
   - `Tạo phê duyệt thương mại`
   - `Phát hành sales order`
3. the relevant gate state is visible in backend payloads and frontend surfaces
4. the same next-step state is visible from at least one list surface, `Home` or `My Work`, and the project workspace itself

### Why this metric

It measures the thing the user actually feels, whether a won deal becomes operationally owned fast enough.

It is better than “number of approvals” or “dashboard accuracy” because it directly captures whether the handoff is alive or dead.

## Problem Statement

Right now the codebase already has many parts of the handoff flow:

- canonical workflow enums
- approval gate types
- sales-order release logic
- project workspace action availability
- home and work-queue hints for commercial and execution flow

But the product promise is still blurry.

The Phase 1 problem is not missing tabs. It is missing confidence at the handoff boundary.

The system must answer:

- Is this quote truly ready to leave commercial flow?
- Who moves next?
- What is the next allowed action?
- What is blocking it?

## What Already Exists

These are real assets, not aspirational docs:

- [domain.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\shared\contracts\domain.ts)
  Already defines roles, action permissions, quotation statuses, project stages, approval gates, approval lanes, and workspace tabs.
- [revenueFlow.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\shared\workflow\revenueFlow.ts)
  Already defines canonical transitions and approval-owner resolution.
- [quotations/service.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\quotations\service.ts)
  Already handles winning-quotation logic and automation hooks.
- [quotations/readService.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\quotations\readService.ts)
  Already exposes quotation action availability and commercial approval state.
- [projects/workspace.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\projects\workspace.ts)
  Already computes approval gate states and workspace action availability.
- [sales-orders/service.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\sales-orders\service.ts)
  Already enforces release logic and approval-gate-aware action availability.
- [ProjectWorkspaceHub.tsx](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\projects\ProjectWorkspaceHub.tsx)
  Already renders gate-driven actions like create/release sales order.
- [Home.tsx](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Home.tsx)
  Already surfaces handoff-oriented next actions and pending gates.
- [phaseDrivenActions.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\work\phaseDrivenActions.ts)
  Already routes role-specific queue actions around commercial, approvals, and execution.
- [workspace-api.test.js](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\tests\workspace-api.test.js)
  Already covers parts of workspace gate state and action availability.

### Reuse vs rebuild

Reuse:

- canonical contracts
- gate-state computation
- workspace action availability
- sales-order transition logic
- home/work queue handoff hints

Do not rebuild:

- a new workflow model in parallel
- a second “handoff dashboard” outside the project workspace
- a custom permission system detached from `ROLE_ACTION_PERMISSIONS`

## NOT In Scope

- procurement line editing or inbound workflow deepening
- delivery execution or delivery-completion UX beyond keeping current gate behavior intact
- finance/legal workspace depth beyond keeping their approval lanes and visibility correct
- pricing-in-finance convergence
- exchange-rate / QBU warning rollout
- ops gantt / workload triage
- executive reporting redesign
- mobile-specific UI work
- Huly-style collaboration features

These are deferred because they add surface area before the handoff wedge is proven.

## User-Facing Outcome

For the combined Sales-PM operator, or the sales user coordinating with PM, a won quote should immediately feel like this:

1. the quote is visibly ready for execution handoff
2. the workspace shows whether the next step is create sales order, request release approval, or release
3. `Home`, `My Work`, and `Approvals` all point at the same truth
4. blockers are explicit instead of implied

If the user still has to ask in chat “who owns this now?” or “can we move?”, Phase 1 failed.

## Architecture

## Bounded architecture choice

Phase 1 should stay inside the current modular-monolith boundaries:

- `quotations` stays the source of commercial state
- `sales-orders` stays the source of sales-order lifecycle
- `projects/workspace` stays the source of cross-module handoff visibility
- frontend `Home`, `My Work`, and `Project Workspace` are the only required surfaces

No new top-level module should be introduced.

## Data flow

```text
Quotation becomes WON
        |
        v
Quotations module marks winning state
        |
        v
Project workspace resolves latest quotation + gate states + action availability
        |
        +------------------------------+
        |                              |
        v                              v
Home / My Work surfaces         Project Workspace Hub
next step + blockers            gate state + executable action
        |                              |
        +--------------+---------------+
                       |
                       v
Sales Order module creates order / requests release approval / releases order
                       |
                       v
Audit + ERP outbox continue downstream
```

## State machine slice covered by Phase 1

```text
Quotation
draft
  -> submitted_for_approval
  -> approved
  -> won

When WON:
  -> Create sales order
  -> Request sales_order_release approval
  -> Release sales order

Phase 1 stops here.
It does NOT expand into procurement commitment, delivery release, or full cross-functional workspace depth.
```

## Exact Files / Modules Touched

## Backend, primary

- [backend/src/shared/contracts/domain.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\shared\contracts\domain.ts)
- [backend/src/shared/workflow/revenueFlow.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\shared\workflow\revenueFlow.ts)
- [backend/src/modules/quotations/service.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\quotations\service.ts)
- [backend/src/modules/quotations/readService.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\quotations\readService.ts)
- [backend/src/modules/projects/workspace.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\projects\workspace.ts)
- [backend/src/modules/projects/readRoutes.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\projects\readRoutes.ts)
- [backend/src/modules/projects/governanceRoutes.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\projects\governanceRoutes.ts)
- [backend/src/modules/projects/orchestration.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\projects\orchestration.ts)
- [backend/src/modules/sales-orders/service.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\sales-orders\service.ts)
- [backend/src/modules/sales-orders/repository.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\sales-orders\repository.ts)
- [backend/src/modules/sales-orders/routes.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\src\modules\sales-orders\routes.ts)

## Frontend, primary

- [frontend/src/shared/domain/contracts.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\shared\domain\contracts.ts)
- [frontend/src/shared/domain/revenueFlow.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\shared\domain\revenueFlow.ts)
- [frontend/src/Home.tsx](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Home.tsx)
- [frontend/src/work/phaseDrivenActions.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\work\phaseDrivenActions.ts)
- [frontend/src/projects/ProjectWorkspaceHub.tsx](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\projects\ProjectWorkspaceHub.tsx)
- [frontend/src/projects/workspacePhaseReadiness.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\projects\workspacePhaseReadiness.ts)

## Tests, required

- [backend/tests/workspace-api.test.js](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\tests\workspace-api.test.js)
- [backend/tests/revenue-flow-contracts.test.js](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\tests\revenue-flow-contracts.test.js)
- [backend/scripts/project-centric.test.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\project-centric.test.ts)
- [frontend/src/shared/domain/revenueFlow.test.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\shared\domain\revenueFlow.test.ts)
- [frontend/src/projects/workspacePermissions.test.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\projects\workspacePermissions.test.ts)
- [frontend/src/projects/workspaceRoleViews.test.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\projects\workspaceRoleViews.test.ts)
- [frontend/src/authRolePreview.test.ts](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\authRolePreview.test.ts)

## Exact Deliverables

## 1. Canonical handoff signal package

The backend must expose one stable handoff truth package for won quotes and linked projects:

- latest quotation status
- whether sales order creation is allowed
- whether release approval can be requested
- whether release can be executed
- blockers for each transition
- approval gate state for `quotation_commercial` and `sales_order_release`

This package already exists in fragments. Phase 1 makes it stable and consistent across list, workspace, and home surfaces.

## 2. Consistent handoff surfaces

The same handoff truth must appear in:

- `Home`
- `My Work`
- `Project Workspace`
- list APIs where users scan quotes, projects, or sales orders

The user should not see “ready to move” in one surface and “blocked” in another.

## 3. Permission-correct action visibility

The next action must only appear when the actor is allowed to execute it.

Example:

- sales can see commercial progress and handoff blockers
- project manager can request release approval where appropriate
- director can release sales order when the gate is approved
- admin can support the system, but should not silently inherit business-approval power

## 4. Audit-ready handoff progression

When the handoff advances, the audit trail must show:

- who triggered the move
- under which capability
- which gate or status changed
- which entity moved

## Explicit Stop Line

Phase 1 stops after the handoff becomes active and release-ready.

It does not include:

- procurement commitment rollout
- inbound or delivery execution UX expansion
- finance/legal cockpit deepening
- pricing tab convergence
- exchange-rate warning flow
- director cockpit redesign
- ops gantt integration

If a task proposal requires any of those, it is outside Phase 1.

## Test Review Diagram

```text
Codepath A
Quotation -> WON
  backend: quotations/service.ts + lifecycle.ts + readService.ts
  tests:
    - backend contract/integration
    - frontend shared-domain contract

Codepath B
Won quotation -> sales order can be created
  backend: projects/workspace.ts + sales-orders/service.ts
  frontend: Home.tsx + ProjectWorkspaceHub.tsx
  tests:
    - workspace-api.test.js
    - project-centric.test.ts

Codepath C
Draft sales order -> release approval requested
  backend: sales-orders/service.ts + repository.ts
  frontend: ProjectWorkspaceHub.tsx
  tests:
    - workspace-api.test.js
    - revenueFlow.test.ts

Codepath D
Approved release gate -> director can release sales order
  backend: revenueFlow.ts + sales-orders/service.ts
  frontend: ProjectWorkspaceHub.tsx + Home.tsx
  tests:
    - revenue-flow-contracts.test.js
    - revenueFlow.test.ts

Codepath E
Role-specific surfaces show same next step
  frontend: Home.tsx + phaseDrivenActions.ts + ProjectWorkspaceHub.tsx
  tests:
    - authRolePreview.test.ts
    - workspacePermissions.test.ts
```

## Workflow And Permission Regression Tests

## Backend regression set

1. Quotation in `approved` can show create-sales-order readiness, but sales-order release still requires `won`.
2. Quotation in `won` creates a stable handoff package in project workspace and quotation list payloads.
3. Sales order release request cannot be created twice when a pending approval already exists.
4. Sales order release cannot execute if gate is not approved.
5. Admin without business role cannot bypass finance/legal/executive approval permissions.
6. Project handoff route rejects quotations that are not winning/won.

## Frontend regression set

1. `Home` for `sales_pm_combined` shows the same next-step truth as project workspace.
2. `My Work` commercial/execution focus points at the same lane and same project state.
3. `ProjectWorkspaceHub` only renders create/release actions when backend `actionAvailability` allows them.
4. Role preview for accounting/legal/director only shows their approval lanes and does not accidentally grant action buttons outside scope.
5. `Home` and `ProjectWorkspaceHub` do not diverge on whether a project is ready to create or release a sales order.

## Verification Commands

Run from repo root unless noted:

```powershell
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend
node .\tests\workspace-api.test.js
node .\tests\revenue-flow-contracts.test.js
npx ts-node .\scripts\project-centric.test.ts
```

```powershell
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend
node .\scripts\run-vitest-sandbox.mjs src/shared/domain/revenueFlow.test.ts src/projects/workspacePermissions.test.ts src/projects/workspaceRoleViews.test.ts src/authRolePreview.test.ts
node .\node_modules\typescript\bin\tsc -b
```

## Failure Modes

| Codepath | Realistic failure | Test covers it? | Error handling exists? | User sees clear error? | Notes |
|---|---|---|---|---|---|
| Quotation -> won | legacy status alias leaves quote in inconsistent state | partial | partial | partial | normalize legacy status everywhere or list/workspace drift appears |
| Won quote -> create sales order | workspace says ready but sales-order service rejects due to stale quotation state | partial | yes | yes | list/workspace/API consistency check required |
| Release approval request | duplicate pending approval rows created under refresh/retry | yes | yes | yes | keep idempotent pending lookup path |
| Release sales order | director sees release button before gate approval has propagated | partial | yes | partial | UI must trust backend actionAvailability, not local inference |
| Role preview / permissions | admin preview or mixed-role session leaks action button not truly allowed | yes | partial | partial | treat as high-risk regression surface |
| Handoff metric | system records won quote but never records an activated handoff artifact | no | no | no | **critical gap** until metric instrumentation exists |

### Critical gaps

- There is no explicit persisted instrumentation yet for `Handoff Activation SLA`. Current code can infer readiness from workflow artifacts, but the metric itself is not first-class.

## Architecture Review

This plan is good because it stays inside existing modules and leans on current primitives.

The main architectural rule is:

`Do not add a new handoff subsystem. Finish the handoff truth inside quotations, projects/workspace, and sales-orders.`

That means:

- shared contracts remain canonical
- workflow guards remain in shared workflow code
- project workspace remains the handoff aggregator
- Home and My Work remain consumers, not alternative sources of truth

## Code Quality Review

Good:

- existing code already uses `actionAvailability` and `approvalGateStates` as semantic payloads instead of relying entirely on frontend inference
- role/approval helpers already exist on both backend and frontend shared-domain layers

Risks:

- several surfaces carry overlapping handoff language, `Home`, `phaseDrivenActions`, `ProjectWorkspaceHub`, workspace summaries
- if each surface adds its own “special case” logic, the wedge will rot into UI disagreement fast

Recommendation:

- prefer tightening shared selectors and payload builders over adding more conditional text in UI files

## Performance Review

The slice is not computationally heavy. The real performance risk is duplicated fetch/derivation, not algorithmic cost.

Watch for:

- multiple surfaces recomputing or refetching handoff state independently
- list views and workspace details drifting because they use different query paths

The safe choice is to keep deriving handoff truth close to current backend workspace and read-service builders, then expose it outward.

## Parallelization Strategy

| Step | Modules touched | Depends on |
|------|----------------|------------|
| Canonical handoff metric + contract alignment | `backend/src/shared/`, `frontend/src/shared/domain/` | — |
| Backend handoff truth hardening | `backend/src/modules/quotations/`, `backend/src/modules/projects/`, `backend/src/modules/sales-orders/` | Canonical handoff metric + contract alignment |
| Frontend surface alignment | `frontend/src/Home.tsx`, `frontend/src/work/`, `frontend/src/projects/` | Canonical handoff metric + contract alignment |
| Regression expansion | `backend/tests/`, `frontend/src/**/*.test.ts`, `frontend/scripts/` | Backend handoff truth hardening, Frontend surface alignment |

### Parallel lanes

- Lane A: Canonical handoff metric + contract alignment
- Lane B: Backend handoff truth hardening, sequential after Lane A
- Lane C: Frontend surface alignment, sequential after Lane A
- Lane D: Regression expansion, sequential after B + C

### Execution order

Launch Lane A first.

Then launch Lane B and Lane C in parallel worktrees.

Merge both, then run Lane D.

### Conflict flags

- Lanes B and C both depend on shared contract shape changes from Lane A. Do not start either lane until contract names and metric definition are frozen.
- Sequential implementation inside `backend/src/modules/projects/` is safer than splitting multiple backend workers there, because workspace aggregation is the integration seam.

## Acceptance Criteria

1. A `won` quotation exposes one consistent next step across backend payloads and the three primary frontend surfaces.
2. The system can distinguish between:
   - not ready to create sales order
   - ready to create sales order
   - waiting on release approval
   - ready to release
3. Permission boundaries are preserved across role preview and real sessions.
4. No new cross-functional workspace depth is added beyond what is required for the handoff wedge.
5. The team can measure `Handoff Activation SLA` or, at minimum, log the artifacts required to compute it without manual reconstruction.

## Unresolved Decisions That May Bite Later

- Where exactly `Handoff Activation SLA` is persisted, computed server-side from existing artifacts vs logged as a first-class event.
- Whether the SLA clock uses pure business hours or elapsed hours in Phase 1.
- Whether the first owner of the handoff is always `project_manager`, or whether combined `sales_pm` ownership remains valid until sales-order-release approval is requested.

## Recommendation

Implement this as one bounded wedge.

Do not open procurement, finance, legal, delivery, or reporting expansion work in the same spec. If the handoff slice works, those expansions get easier. If it does not, those expansions become expensive camouflage.
