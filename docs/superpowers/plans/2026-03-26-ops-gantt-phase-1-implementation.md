# Ops Gantt Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing `Vận hành > Gantt` screen into a Phase 1 `Ops lead` view with explicit risk signals, clickable ops summary controls, preset filters, smarter auto-expand behavior, and a visible fallback for records missing timeline dates.

**Architecture:** Keep the current `projects` + `tasks` data flow and monthly Gantt structure, but extract a derived ops model so risk, owner workload, preset filtering, and visibility decisions are computed outside the main render path. Implement the new command bar and preset controls in focused UI helpers, then refactor `GanttView` to consume derived state instead of embedding more logic inline.

**Tech Stack:** Preact, TypeScript, Vite, inline style objects, Vitest for new pure-logic coverage

---

## Implementation Notes

- Scope this plan to `Phase 1` only from the approved spec at [2026-03-26-ops-gantt-hybrid-lens-design.md](/C:/Users/dinghuy/OneDrive%20-%20HUYNH%20THY%20GROUP/Antigravity%20Workspace/crm-app/docs/superpowers/specs/2026-03-26-ops-gantt-hybrid-lens-design.md).
- Do not implement owner lens grouping, priority lens grouping, or advanced inline mutation in this plan.
- The current workspace is not a git repository, so `commit` steps become `checkpoint` steps. Do not invent git commands that cannot run here.
- Prefer extracting pure helpers and small view components rather than doing a broad visual-system rewrite.
- All verification commands in this plan must be executed from the `frontend` working directory.
- Treat Task 1 as already completed in the current workspace baseline. Do not re-baseline the Vitest harness unless it becomes broken.
- Use the currently working verification commands for this workspace:
  - `node ./scripts/run-vitest-sandbox.mjs`
  - `node ./node_modules/typescript/bin/tsc -b`
- Keep `vite build` as an optional environment-dependent check until the current Tailwind/native module blocker is resolved.

## File Structure

### Existing files to modify

- Modify: `frontend/package.json`
  Purpose: add test script and test dependency entry points for frontend logic coverage.
- Modify: `frontend/src/ops/GanttView.tsx`
  Purpose: consume the derived ops model, render the command bar and preset controls, show risk-aware context, and apply smarter auto-expand and fallback visibility.
- Modify: `frontend/src/ops/ganttUtils.ts`
  Purpose: keep low-level date helpers focused, and only adjust shared utility behavior if needed for deterministic testing or timeline fallback integration.

### New files to create

- Create: `frontend/src/ops/GanttCommandBar.tsx`
  Purpose: render clickable KPI-style ops metrics and preset shortcuts without bloating `GanttView.tsx`.

### Existing files that may already exist locally and should be stabilized, not recreated

- Modify: `frontend/vitest.config.ts`
  Purpose: keep the Vitest setup minimal and working in this Windows environment.
- Modify: `frontend/src/ops/ganttDerived.ts`
  Purpose: centralize Phase 1 derived ops state such as risk classification, assignee load, preset filters, row visibility, and auto-expand decisions.
- Modify: `frontend/src/ops/__tests__/ganttDerived.test.ts`
  Purpose: cover risk rules, assignee overload thresholds, missing-timeline fallback, preset filtering, and auto-expand logic.

## Task 1: Frontend Test Harness And Derived Ops Scaffold

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vitest.config.ts`
- Modify: `frontend/src/ops/ganttDerived.ts`
- Modify: `frontend/src/ops/__tests__/ganttDerived.test.ts`

- [x] **Step 1: Normalize the existing Task 1 baseline and write the failing test scaffold**

```ts
import { describe, expect, it } from 'vitest';
import { classifyTaskRisk } from '../ganttDerived';

describe('classifyTaskRisk', () => {
  it('marks overdue incomplete tasks as critical', () => {
    expect(
      classifyTaskRisk(
        {
          status: 'active',
          priority: 'high',
          startDate: '2026-03-01',
          dueDate: '2026-03-10',
          completionPct: 40,
          assigneeName: 'Nam',
        },
        { today: new Date('2026-03-20T00:00:00'), assigneeLoad: { activeCount: 1, urgentHighCount: 0 } },
      ),
    ).toBe('Critical');
  });
});
```

- [x] **Step 2: Stabilize the minimal test runner wiring**

Completed in the current workspace. Preserve the existing Windows-safe runner and shared config instead of reverting to a simpler baseline.

Current state in `frontend/package.json`:

```json
{
  "scripts": {
    "test": "node ./scripts/run-vitest-sandbox.mjs"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

Current state in `frontend/vitest.config.ts`:

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import sharedConfig from './vitest.shared.mjs';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
    },
  }),
);
```

- [x] **Step 3: Run test to verify the scaffold still fails for the right reason**

Completed previously while stabilizing the harness.

Run: `node ./scripts/run-vitest-sandbox.mjs`

Expected:
- the targeted tests run in this Windows environment without npm shim failures

- [x] **Step 4: Normalize the minimal implementation scaffold**

Keep `frontend/src/ops/ganttDerived.ts` at the smallest compilable surface:

```ts
export type RiskState = 'Critical' | 'Warning' | 'Watch' | 'Healthy';

type LoadSnapshot = {
  activeCount: number;
  urgentHighCount: number;
};

type RiskInput = {
  today: Date;
  assigneeLoad: LoadSnapshot;
};

type RiskTask = {
  status?: string | null;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  completionPct?: number | string | null;
  assigneeName?: string | null;
};

export function classifyTaskRisk(_task: RiskTask, _input: RiskInput): RiskState {
  return 'Healthy';
}
```

- [x] **Step 5: Run test to verify it still fails for the right reason**

Completed previously against the minimal scaffold.

Run: `node ./scripts/run-vitest-sandbox.mjs`

Expected:
- Vitest runs
- the test fails on an assertion, proving the harness works and the logic is still incomplete

- [x] **Step 6: Checkpoint**

Record a local checkpoint note that test harness and derived-state scaffold are in place.

## Task 2: Define The Derived Ops Contract And Implement Phase 1 Logic

**Files:**
- Modify: `frontend/src/ops/ganttDerived.ts`
- Modify: `frontend/src/ops/__tests__/ganttDerived.test.ts`
- Modify: `frontend/src/ops/ganttUtils.ts`

- [ ] **Step 1: Add failing tests for the derived-state contract, risk matrix, and fallback rules**

Add tests covering:

```ts
it('builds a stable derived-state contract for command metrics and visible rows', () => {});
it('marks due-in-7-days tasks as warning', () => {});
it('marks paused urgent tasks as watch', () => {});
it('marks overloaded assignee tasks as warning', () => {});
it('keeps active tasks with missing dates visible in fallback state', () => {});
it('classifies active missing-timeline tasks as watch', () => {});
it('auto-expands only risky projects when no manual filter is active', () => {});
```

- [ ] **Step 2: Run tests to verify the new cases fail**

Run: `node ./scripts/run-vitest-sandbox.mjs`

Expected:
- new tests fail with wrong risk results or missing helper functions

- [ ] **Step 3: Implement the derived helpers and explicit contract**

Expand `frontend/src/ops/ganttDerived.ts` to include:

```ts
export function getAssigneeLoad(tasks: GanttTask[]): Map<string, LoadSnapshot> { /* ... */ }
export function classifyTaskRisk(task: RiskTask, input: RiskInput): RiskState { /* ... */ }
export function classifyProjectRisk(taskRisks: RiskState[]): RiskState | null { /* ... */ }
export function isTimelineMissing(task: { startDate?: string | null; dueDate?: string | null }): boolean { /* ... */ }
export function buildCommandMetrics(/* ... */): CommandMetric[] { /* ... */ }
export function getPresetMatch(/* ... */): boolean { /* ... */ }
export function getAutoExpandedProjectIds(/* ... */): Set<string> { /* ... */ }
export function buildGanttDerivedState(/* ... */): DerivedGanttState { /* ... */ }
```

Implementation rules must match the spec exactly:
- overdue incomplete task => `Critical`
- due in `<= 7` days => `Warning`
- due in `8-14` days => `Watch`
- paused `high/urgent` => `Watch`
- overloaded assignee if `activeCount > 8` or `urgentHighCount >= 3`
- behind-schedule warning only when both dates exist, elapsed schedule percentage is at least `60`, and `completionPct` trails elapsed schedule by at least `20`
- define preset keys, command metric keys, and expand precedence explicitly in the returned `DerivedGanttState`
- include a failure-safe result shape so `GanttView.tsx` can fall back to base project/task rendering if derived computation fails

- [ ] **Step 4: Keep date logic deterministic for tests**

If any helper currently depends on `new Date()` directly, change the derived layer to accept `today: Date` as an explicit input instead of hard-coding the clock.

If `frontend/src/ops/ganttUtils.ts` needs changes, keep them minimal and low-level:

```ts
export function isTaskOverdue(task: Pick<GanttTask, 'status' | 'dueDate'>, today = new Date()): boolean {
  // existing logic, but based on injected `today`
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node ./scripts/run-vitest-sandbox.mjs`

Run: `node .\\node_modules\\typescript\\bin\\tsc -b`

Expected:
- all `ganttDerived.test.ts` cases pass
- TypeScript build passes for the frontend package even if full `vite build` remains environment-blocked

- [ ] **Step 6: Checkpoint**

Record a local checkpoint note that Phase 1 derived ops rules are stable and covered by tests.

## Task 3: Build The Ops Command Bar And Preset Controls

**Files:**
- Create: `frontend/src/ops/GanttCommandBar.tsx`
- Modify: `frontend/src/ops/GanttView.tsx`
- Modify: `frontend/src/ui/styles.ts`

- [ ] **Step 1: Write the failing UI-level expectation in the derived test file or a small smoke assertion**

Add a narrow smoke-style expectation for the command-bar payload shape in `frontend/src/ops/__tests__/ganttDerived.test.ts`:

```ts
it('builds clickable summary metrics for overdue, due soon, overloaded owners, and avg progress', () => {
  expect(buildCommandMetrics(/* derived state */)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'overdue' }),
      expect.objectContaining({ key: 'dueSoon' }),
      expect.objectContaining({ key: 'overloadedOwners' }),
    ]),
  );
});
```

Keep this as a pure helper test against command-bar data rather than DOM rendering.

- [ ] **Step 2: Run tests to verify the new expectation fails**

Run: `node ./scripts/run-vitest-sandbox.mjs`

Expected:
- failure due to missing command-bar summary builder or incomplete payload shape

- [ ] **Step 3: Create the focused UI component**

Create `frontend/src/ops/GanttCommandBar.tsx`:

```tsx
type CommandMetric = {
  key: string;
  label: string;
  value: string;
  tone: 'neutral' | 'warn' | 'bad' | 'good';
  active?: boolean;
  onClick: () => void;
};

export function GanttCommandBar(props: {
  metrics: CommandMetric[];
  presets: Array<{ key: string; label: string; active?: boolean; onClick: () => void }>;
}) {
  return (
    <div>
      {/* metrics row */}
      {/* preset row */}
    </div>
  );
}
```

Use style patterns already present in `frontend/src/ui/styles.ts` and `frontend/src/ops/OperationsOverview.tsx` rather than inventing a new visual system.

- [ ] **Step 4: Wire the component into `GanttView.tsx` with static placeholder data first**

Render `GanttCommandBar` under the page heading before replacing the existing passive chip row.

Expected interim behavior:
- the command bar appears
- buttons are clickable
- no derived filtering is connected yet

- [ ] **Step 5: Run verification**

Run: `node ./scripts/run-vitest-sandbox.mjs`

Run: `node ./node_modules/typescript/bin/tsc -b`

Expected:
- tests pass
- TypeScript verification succeeds
- optional: run `vite build` only if the environment blocker is known to be resolved

- [ ] **Step 6: Checkpoint**

Record a local checkpoint note that the command bar exists as a separate component and builds cleanly.

## Task 4: Refactor GanttView To Consume Derived Ops State

**Files:**
- Modify: `frontend/src/ops/GanttView.tsx`
- Modify: `frontend/src/ops/ganttDerived.ts`
- Modify: `frontend/src/ops/GanttCommandBar.tsx`

- [ ] **Step 1: Add failing tests for preset filtering and smarter expansion**

Add test cases such as:

```ts
it('returns only overdue rows when the overdue preset is active', () => {});
it('keeps projects visible when matching tasks are missing timeline dates', () => {});
it('auto-expands risky projects without forcing all projects open', () => {});
```

- [ ] **Step 2: Run tests to verify the current behavior fails**

Run: `node ./scripts/run-vitest-sandbox.mjs`

Expected:
- tests fail because the current filtering and expansion rules are still inline and incomplete

- [ ] **Step 3: Replace inline filtering and stats logic with derived-state calls**

Refactor `frontend/src/ops/GanttView.tsx` so that it:
- builds assignee load once
- builds risk state once
- computes command metrics once
- computes preset-aware visible rows once
- derives auto-expanded project ids from state and preset context

Target shape:

```ts
const derived = useMemo(
  () => buildGanttDerivedState({
    projects,
    tasks,
    viewMonth,
    searchQuery,
    activePreset,
    manualExpandedProjectIds: expandedProjectIds,
    today: new Date(),
  }),
  [projects, tasks, viewMonth, searchQuery, activePreset, expandedProjectIds],
);
```

The `DerivedGanttState` contract must expose:
- command metrics
- active preset key
- visible project/task rows
- fallback rows for missing-timeline items
- effective auto-expanded project ids
- a safe `mode: 'derived' | 'fallback'` indicator

- [ ] **Step 4: Implement the visible fallback for missing timeline records**

When tasks are relevant but missing one or both timeline dates:
- do not drop them entirely
- show them in the left rail with a fallback marker such as `Thiếu timeline`
- render the timeline side in a neutral placeholder state instead of a normal bar
- if derived-state construction fails on malformed data, keep the base project/task rendering available and suppress only the derived overlays instead of breaking the screen

- [ ] **Step 5: Update row copy for clarified terminology**

In `frontend/src/ops/GanttView.tsx`:
- use `project manager` labeling for project metadata
- use `assignee` labeling for task workload and filters
- only rename existing copy that already appears in the UI; do not invent a new row action in Phase 1

- [ ] **Step 6: Run verification**

Run: `node ./scripts/run-vitest-sandbox.mjs`

Run: `node ./node_modules/typescript/bin/tsc -b`

Expected:
- all derived tests pass
- TypeScript verification succeeds
- no TypeScript regressions
- optional: run `vite build` only if the environment blocker is known to be resolved

- [ ] **Step 7: Checkpoint**

Record a local checkpoint note that `GanttView` now depends on a derived ops model rather than inline Phase 1 logic.

## Task 5: Final Phase 1 Polish And Release Verification

**Files:**
- Modify: `frontend/src/ops/GanttView.tsx`
- Modify: `frontend/src/ops/GanttCommandBar.tsx`
- Modify: `frontend/src/ops/__tests__/ganttDerived.test.ts`

- [ ] **Step 1: Add final regression tests for accepted Phase 1 behavior**

Add explicit coverage for:
- overdue metric count
- due soon metric count
- overloaded assignee threshold
- project risk roll-up
- risk-only preset behavior
- search + preset interaction
- timeline clipping within the selected month
- graceful fallback when derived-state computation cannot be completed

- [ ] **Step 2: Run tests to verify the new regressions fail first**

Run: `node ./scripts/run-vitest-sandbox.mjs`

Expected:
- one or more new assertions fail before the final polish is applied

- [ ] **Step 3: Tighten UI details to match the spec**

Finalize:
- clickable metrics replacing the passive summary chip row
- preset chips/buttons
- risk badge treatment in the context rail
- `today` emphasis remaining visible after the refactor
- empty-state guidance when filters return no results

- [ ] **Step 4: Run full verification**

Run: `node ./scripts/run-vitest-sandbox.mjs`

Run: `node ./node_modules/typescript/bin/tsc -b`

Expected:
- tests pass
- TypeScript verification succeeds
- no missing imports or dead UI references remain
- optional: run `vite build` only if the environment blocker is known to be resolved

- [ ] **Step 5: Manual QA pass**

Check in the running app:
- default view still groups by project
- overdue items are easy to spot
- clicking command-bar metrics changes the visible slice
- risky projects auto-expand without opening everything
- missing-timeline tasks are visible instead of silently disappearing

- [ ] **Step 6: Final checkpoint**

Record a local checkpoint note that Phase 1 is ready for handoff or human review.
