# Phase 1 Execution Plan: Won Quote -> Clean Handoff

> Status: `verified in branch`
> Date: `2026-04-04`
> Input spec: [phase-1-won-quote-clean-handoff-spec.md](C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\docs\phase-1-won-quote-clean-handoff-spec.md)
> Goal: finish the bounded `won quote -> clean handoff` slice without drifting into broader workspace expansion.

## Summary

This plan assumes the backend `handoffActivation` contract now exists in the current branch and has targeted backend coverage.

The remaining work is to:

1. make the same handoff truth visible in the frontend surfaces users actually work from
2. instrument the primary metric, `Handoff Activation SLA`
3. harden workflow and permission regressions around the handoff boundary
4. stop before procurement/finance/legal/workspace-depth expansion

## Current Baseline

Already done in the current branch:

- shared backend `handoffActivation` helper
- backend exposure in project workspace, project list summary, Home highlights, quotation list, and sales-order list
- targeted backend verification:
  - `backend/tests/workspace-api.test.js`
  - `backend/scripts/project-centric.test.ts`
  - backend TypeScript compile pass

This execution plan starts from that baseline. Do not rebuild Task 1 from zero.

## Stop Line

This plan explicitly does **not** include:

- pricing-in-finance convergence
- exchange-rate / QBU warnings
- procurement commitment rollout
- delivery execution expansion
- finance/legal cockpit depth
- ops gantt
- executive dashboard redesign
- mobile/layout cleanup

If a task requires one of those, stop and split it into a later plan.

## Task 1: Frontend Surface Alignment

**Goal:** show the same `handoffActivation` truth in the places users scan first, without inventing a second interpretation layer.

**Files:**
- Modify: `frontend/src/Home.tsx`
- Modify: `frontend/src/MyWork.tsx`
- Modify: `frontend/src/work/phaseDrivenActions.ts`
- Modify: `frontend/src/projects/ProjectWorkspaceHub.tsx`
- Optional helper: `frontend/src/shared/workflow/` or `frontend/src/ui/patterns.tsx` only if a tiny reusable display primitive is genuinely needed

### Steps

- [ ] **Step 1: Add failing frontend tests**
  - Add or extend tests around `Home`, `My Work`, and project workspace behavior so they expect the backend-provided `handoffActivation` shape to drive copy/state instead of ad hoc inference.
  - Minimum test targets:
    - `frontend/src/qa/myWorkWorkflowContract.test.ts`
    - `frontend/src/home/homeNavigation.test.ts` if needed
    - `frontend/src/projects/workspacePermissions.test.ts`

- [ ] **Step 2: Render `handoffActivation` in `Home.tsx`**
  - Use backend state to display:
    - `ready_to_create_sales_order`
    - `awaiting_release_approval`
    - `ready_to_release`
    - `activated`
  - Do not derive a competing state from raw quotation/project fields if `handoffActivation` exists.

- [ ] **Step 3: Align `My Work`**
  - Ensure `My Work` wording and CTA emphasis uses the same handoff state.
  - `phaseDrivenActions.ts` can adapt labels and hints, but must not recalculate workflow truth from scratch.

- [ ] **Step 4: Align `ProjectWorkspaceHub.tsx`**
  - Keep gate buttons as-is where possible.
  - Add a compact summary line or badge that reflects `handoffActivation`.
  - Avoid new tabs, panels, or modal flows.

- [ ] **Step 5: Run frontend verification**

```powershell
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend
node .\scripts\run-vitest-sandbox.mjs src/projects/workspacePermissions.test.ts src/authRolePreview.test.ts
node .\node_modules\typescript\bin\tsc -b
```

## Task 2: Metric Instrumentation

**Goal:** make `Handoff Activation SLA` measurable without opening reporting scope.

**Files:**
- Modify: `backend/src/modules/quotations/service.ts`
- Modify: `backend/src/modules/projects/orchestration.ts`
- Modify: `backend/src/modules/projects/governanceRoutes.ts`
- Modify: `backend/src/modules/platform/reportingRoutes.ts` only if an existing internal endpoint is the least-invasive place to expose the metric
- Optional create: `backend/src/shared/audit/` or `backend/src/shared/workflow/` helper only if instrumentation logic would otherwise duplicate

### Steps

- [ ] **Step 1: Define the event boundary**
  - Start event: quotation enters `won`
  - End event: handoff becomes activated by the Phase 1 definition from the spec
  - Decide once whether SLA is computed from persisted timestamps or emitted events, then keep it boring.

- [ ] **Step 2: Add failing backend tests**
  - Add a focused backend test proving the metric can be computed from the stored flow.
  - Cover at least:
    - quote becomes won but no handoff yet
    - quote becomes won then handoff activates within SLA
    - quote becomes won and misses SLA

- [ ] **Step 3: Implement instrumentation**
  - Prefer reuse of existing entities and timestamps over a brand-new subsystem.
  - If a persisted timestamp is required, store the smallest possible new field or event.
  - If existing audit/timeline events are enough, compute from them and stop.

- [ ] **Step 4: Expose the metric minimally**
  - Expose enough for internal verification or a small operator readout.
  - Do not build a new dashboard in this task.

- [ ] **Step 5: Run backend verification**

```powershell
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend
node .\tests\workspace-api.test.js
npx ts-node .\scripts\project-centric.test.ts
node .\node_modules\typescript\bin\tsc -p .\tsconfig.json --noEmit
```

## Task 3: Workflow Hardening At The Handoff Boundary

**Goal:** remove the last ambiguous transitions that let the same deal look “ready” in one surface and “blocked” in another.

**Files:**
- Modify: `backend/src/modules/quotations/readService.ts`
- Modify: `backend/src/modules/projects/workspace.ts`
- Modify: `backend/src/modules/sales-orders/service.ts`
- Modify: `backend/src/modules/projects/readRoutes.ts`
- Modify: `frontend/src/shared/domain/revenueFlow.ts` only if the frontend canonical contract needs to mirror backend semantics more tightly

### Steps

- [ ] **Step 1: Add failing regression tests**
  - Cover disagreement cases:
    - quotation list says create SO, workspace says blocked
    - workspace says awaiting release approval, sales-order list says ready to release
    - role preview leaks action wording that implies permission where none exists

- [ ] **Step 2: Tighten shared handoff rules**
  - Keep the canonical decision in backend shared workflow/builders.
  - Reduce UI-side inference, not increase it.

- [ ] **Step 3: Re-run end-to-end flow tests**

```powershell
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend
node .\tests\workspace-api.test.js
npx ts-node .\scripts\project-centric.test.ts
```

## Task 4: Permission And Preview Regression Sweep

**Goal:** prove that the handoff wedge respects real permissions and role preview does not create fake authority.

**Files:**
- Modify tests first:
  - `frontend/src/authRolePreview.test.ts`
  - `frontend/src/navContext.test.ts`
  - `frontend/src/projects/workspacePermissions.test.ts`
  - `frontend/src/shared/domain/roleAccess.test.ts`
  - backend approval/workspace tests if gaps remain

### Steps

- [ ] **Step 1: Add failing tests for edge roles**
  - `sales`
  - `project_manager`
  - `sales_pm_combined`
  - `director`
  - `admin` support-only case

- [ ] **Step 2: Fix any permission drift**
  - The rule is simple:
    - admin can support
    - business approvals remain owned by business roles
    - UI must not imply more power than backend allows

- [ ] **Step 3: Run verification**

```powershell
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend
node .\scripts\run-vitest-sandbox.mjs src/authRolePreview.test.ts src/navContext.test.ts src/projects/workspacePermissions.test.ts src/shared/domain/roleAccess.test.ts
node .\node_modules\typescript\bin\tsc -b
```

## Task 5: Final Phase 1 Release Check

**Goal:** prove the wedge works before any expansion work starts.

**Files:**
- No net-new feature files
- Update docs only if needed:
  - `docs/phase-1-won-quote-clean-handoff-spec.md`
  - `docs/qa/uat-checklist-core-revenue-flow.md`

### Steps

- [ ] **Step 1: Manual flow check**
  - run one full flow:
    - quotation submitted
    - quotation approved
    - quotation won
    - handoff signal appears
    - create sales order
    - request release approval

- [ ] **Step 2: Validate metric path**
  - confirm the data needed for `Handoff Activation SLA` is present and queryable

- [ ] **Step 3: Confirm stop line**
  - no procurement/deep finance/legal/workspace-depth work slipped into the branch

- [ ] **Step 4: Update docs**
  - move this execution plan and the Phase 1 spec from `planned/proposed` to the appropriate status
  - capture the actual verification commands that passed

## Failure Modes To Watch

- UI surfaces drift because one surface still derives handoff state from raw fields instead of `handoffActivation`
- metric instrumentation becomes a mini reporting subsystem, scope blow-up
- admin preview accidentally implies business approval authority
- handoff status looks “activated” before any role can actually move the next step
- tests pass on one list route but miss the workspace/home inconsistency

## Sequential vs Parallel

### Dependency table

| Step | Modules touched | Depends on |
|------|----------------|------------|
| Task 1: Frontend surface alignment | `frontend/src/`, `frontend/src/work/`, `frontend/src/projects/` | current backend handoffActivation baseline |
| Task 2: Metric instrumentation | `backend/src/modules/quotations/`, `backend/src/modules/projects/`, `backend/src/modules/platform/`, `backend/src/shared/` | current backend handoffActivation baseline |
| Task 3: Workflow hardening | `backend/src/modules/quotations/`, `backend/src/modules/projects/`, `backend/src/modules/sales-orders/`, optional `frontend/src/shared/domain/` | Task 2 |
| Task 4: Permission sweep | backend/frontend test surfaces only, plus any tiny permission fixes | Task 1 + Task 3 |
| Task 5: Final release check | docs + QA paths | all prior tasks |

### Parallel lanes

- Lane A: Task 1, frontend surface alignment
- Lane B: Task 2, metric instrumentation
- Lane C: Task 3, workflow hardening, sequential after Lane B
- Lane D: Task 4, permission sweep, sequential after A + C
- Lane E: Task 5, final release check, sequential after D

### Execution order

Launch Lane A and Lane B in parallel if you have clean worktrees.

Then run Lane C.

Then Lane D.

Then Lane E.

### Conflict flags

- Task 2 and Task 3 both touch `backend/src/modules/projects/` and `backend/src/modules/quotations/`. Do not run those in parallel.
- Task 1 should stay frontend-only. If it starts changing backend semantics, the lane is wrong.

## Recommendation

Start with Task 1 if you want the fastest visible progress.

Start with Task 2 if you want the primary metric locked before UI polish.

If one person is doing this alone, the best order is:

1. Task 2
2. Task 3
3. Task 1
4. Task 4
5. Task 5

That order gets the truth model stable before the UI learns how to speak it.
