# Ops Gantt Hybrid Lens Design

## Goal

Improve the `Vận hành > Gantt` screen so the default experience works for `Ops lead` users first, while still remaining useful for managers and assignees.

The default screen should help an operations lead answer these questions quickly:
- what is currently at risk
- which owner is overloaded
- which tasks or projects need intervention today
- where to drill down next

## Scope

This work covers:
- the default information architecture of the Gantt screen
- the default `Ops lead` viewing lens
- risk and workload signals layered onto the existing Gantt
- filter, grouping, preset view, and auto-expand behavior
- phased rollout guidance for implementation

This work does not cover:
- a full rewrite of project/task backend APIs
- reassign-in-place, blocker editing, or other advanced inline mutation flows
- a separate dedicated screen per persona
- milestone management beyond surfacing existing timeline information

## Current State

- The current screen is implemented in [frontend/src/ops/GanttView.tsx](/C:/Users/dinghuy/OneDrive%20-%20HUYNH%20THY%20GROUP/Antigravity%20Workspace/crm-app/frontend/src/ops/GanttView.tsx).
- Timeline helpers and date logic live in [frontend/src/ops/ganttUtils.ts](/C:/Users/dinghuy/OneDrive%20-%20HUYNH%20THY%20GROUP/Antigravity%20Workspace/crm-app/frontend/src/ops/ganttUtils.ts).
- The current UI already supports:
  - monthly navigation
  - search
  - expand/collapse projects
  - project and task rendering in a shared timeline
  - overdue highlighting for tasks
- The current default layout is timeline-first rather than dispatch-first.
- The current screen does not yet expose:
  - an explicit risk model
  - owner workload signals
  - saved views or preset operational filters
  - alternate grouping lenses such as owner or priority
  - intelligent auto-expand behavior based on risk

## User Priority

### Primary Persona

`Ops lead`

This persona needs a default screen that supports fast triage and daily coordination, not only progress review.

### Secondary Personas

- manager / director
- assignee / individual contributor

These personas should still be supported through alternate views or saved scopes, but should not drive the default layout.

## Terminology

To avoid ambiguity during planning and implementation, this design uses the following terms:

- `project manager`: the project-level coordinator shown from existing project metadata such as `managerName`
- `task assignee`: the person currently responsible for executing a task, shown from task metadata such as `assigneeName`
- `owner lens`: shorthand for the `task assignee` workload view in v1

V1 behavior should follow these rules:
- any `owner` filter in the Gantt UI means `task assignee`
- `owner load` calculations mean `task assignee` workload
- `Owner` lens groups rows by `task assignee`
- project rows may still display `project manager`, but project manager is not part of v1 workload aggregation unless later expanded explicitly
- the row action previously described as `filter by same owner` should be interpreted in v1 as `filter by same assignee` on task rows

## Problem Statement

The current Gantt experience has four main pain points:

1. It is hard to scan quickly and detect risk.
2. It requires too much expanding, scrolling, and manual narrowing to find actionable rows.
3. It does not provide a strong view by owner or workload.
4. Header actions, filters, and view controls are not yet organized as an operational command surface.

## Product Direction

Adopt a `Hybrid Ops Lens` for the default Gantt view.

This means:
- keep `project` as the structural backbone of the screen
- layer `risk` and `owner workload` signals on top of that structure
- add fast lens switching between `Project`, `Owner`, and `Priority`
- optimize the top of the screen for triage and dispatch, not only navigation

The screen remains one Gantt page rather than splitting into separate role-specific pages.

## Requirements

### Functional

1. The default Gantt view must remain grouped by `project`.
2. The screen must surface a top-level operational summary before the user reads individual bars.
3. The screen must support quick filtering by:
   - search
   - owner
   - priority
   - status
   - risk-only mode
   - grouping lens
4. The screen must support quick switching between:
   - `Project`
   - `Owner`
   - `Priority`
5. Projects and tasks must expose risk state visually.
6. The screen must support intelligent auto-expand behavior based on the active filter or risk state.
7. Summary counters must be actionable, not just informational.

### UX

1. The screen should answer the `what needs action now` question before the user scrolls.
2. The top area should stay compact even after adding operational controls.
3. The left-side context column should provide enough signal to understand a row before reading its timeline bar.
4. The timeline should remain recognizably Gantt-based rather than becoming a separate kanban or list screen.
5. The default experience should optimize for clarity and speed over feature density.

### Data

1. The initial implementation should reuse the current `projects` and `tasks` API responses where possible.
2. The frontend may derive additional operational state such as:
   - `riskState`
   - `ownerLoad`
   - `visibleRows`
   - `savedViewState`
3. Missing timeline dates should not silently remove records from the user's awareness.

## Information Architecture

The screen should be organized into three layers.

## Layer 1: Ops Command Bar

This layer sits under the page title and becomes the operational summary surface.

It should include actionable metrics such as:
- overdue tasks
- due in 7 days
- blocked or critical items if available
- overloaded owners
- average progress

Each metric should act as a filter shortcut. For example:
- clicking `Overdue` filters the screen to overdue items
- clicking `Owners overloaded` highlights or pivots to owner workload

This layer replaces the current purely informational top summary with a dispatch-oriented command strip.

## Layer 2: Scope And Saved Views

This layer controls what the user is looking at.

It should include:
- search
- owner filter
- priority filter
- status filter
- risk-only toggle
- group-by selector
- saved views or presets

Recommended default state:
- `group by = Project`
- `risk only = off`

Recommended presets:
- `Việc cần xử lý hôm nay`
- `Theo owner`
- `Urgent / high priority`
- `Dự án có task trễ`

This layer should reduce manual expand-and-scan behavior by narrowing the screen intelligently before the user starts scrolling.

## Layer 3: Split Gantt Surface

The main surface stays as a two-column layout:
- left: context rail
- right: timeline

### Context Rail

The context rail should carry operational meaning, not just labels.

For project rows, show:
- project name
- owner or manager
- risk badge
- overdue task count
- next milestone or next relevant date if available

For task rows, show:
- task name
- assignee
- priority
- due date
- compact status

### Timeline

The timeline remains monthly in the initial design.

It should add:
- a `today` indicator line
- weekend shading
- stronger visual risk encoding
- sticky timeline headers

The timeline bar is still responsible for schedule context, but risk and workload should be readable even before bar interpretation.

## Viewing Lenses

The screen should support three lenses without leaving the page.

### Project Lens

Default lens.

Purpose:
- review project health
- detect risky project clusters
- drill into tasks only where needed

### Owner Lens

Purpose:
- balance workload
- detect overloaded owners
- find concentrated risk by assignee

This changes row grouping and emphasis, but should rely on the same underlying data.

### Priority Lens

Purpose:
- surface urgent and high-priority items quickly
- triage operational queues

This lens favors severity and action order over project structure.

## Risk Model

The design should introduce an explicit risk model rather than inferring importance only from status.

Recommended risk states:
- `Critical`
- `Warning`
- `Watch`
- `Healthy`

Suggested interpretation:
- `Critical`: overdue, blocked, or otherwise requiring immediate intervention
- `Warning`: due soon, behind expected progress, or assigned to an overloaded owner
- `Watch`: notable but not urgent
- `Healthy`: on track

Risk state should influence:
- badge color
- row emphasis
- timeline bar treatment
- default sort or auto-expand behavior

### V1 Risk Matrix

The first implementation should use an explicit, frontend-derivable matrix based on current task fields such as:
- `status`
- `priority`
- `startDate`
- `dueDate`
- `completionPct`
- `assigneeName`

Recommended v1 classification:

- `Critical`
  - task is overdue and not completed
  - or an explicit blocker flag exists in available data later; if blocker data does not exist, ignore this rule in Phase 1

- `Warning`
  - task is due within the next 7 calendar days and not completed
  - or task is assigned to an overloaded assignee
  - or task is behind expected progress using this rule:
    - both `startDate` and `dueDate` exist
    - elapsed schedule percentage is at least `60%`
    - `completionPct` is at least `20 points` behind elapsed schedule percentage

- `Watch`
  - task is due in `8-14` calendar days and not completed
  - or task is active but missing one of the timeline dates needed for stronger classification
  - or task is paused while still carrying `high` or `urgent` priority

- `Healthy`
  - none of the above conditions apply

Assignee overload should use a simple v1 threshold:
- overloaded if assignee has more than `8` active tasks
- or overloaded if assignee has `3` or more `urgent/high` active tasks

Project-level risk should be derived from child tasks in v1:
- `Critical` if any visible child task is critical
- `Warning` if no child is critical but at least one visible child task is warning
- `Watch` if no child is critical or warning but at least one visible child task is watch
- `Healthy` otherwise

If a project has no visible child tasks in the current view, it should not invent a separate project-only risk model for v1. It should fall back to neutral rendering unless later requirements add project-level signals beyond task aggregation.

## Owner Load Signal

Owner workload should be treated as a supporting operational overlay.

The screen should derive owner workload from existing task data and surface:
- active task count
- urgent/high task count
- overload flag when above a configurable threshold

Owner load should not replace project structure in the default view. Instead, it should:
- annotate rows in the default project lens
- become first-class grouping only when the user switches to owner view

## Expand Behavior

The current screen relies too heavily on manual expand/collapse.

Recommended behavior:
- with no filters, auto-expand only risky projects
- with a risk-oriented preset, auto-expand only matching projects
- with a search query, auto-expand only relevant matches
- preserve manual expand intent within the current view state where practical

The goal is to shorten the visible screen while still surfacing what matters.

## Row Actions

The screen should support lightweight action affordances that help the ops lead pivot quickly.

Recommended initial row actions:
- open detail
- filter by same owner
- show only overdue
- jump to today

Advanced inline mutation such as reassignment is explicitly out of scope for the first phase.

## Error Handling

1. If timeline dates are missing, show affected rows in a visible fallback state such as `Thiếu timeline` instead of silently dropping them.
2. If a filter returns no results, show a reset-oriented empty state with guidance.
3. If data loading fails, keep the current error surface explicit and avoid collapsing the screen into an empty timeline.
4. If derived risk or owner-load data cannot be computed, the screen should fall back to the base project/task rendering without blocking access.

## Phased Rollout

### Phase 1: Low-Risk Improvement Of Current Screen

Deliver within the existing screen structure:
- ops command bar
- risk badges
- today line
- preset filters
- smarter auto-expand behavior

This phase should provide the highest immediate value with the lowest implementation risk.

### Phase 2: Lens Switching And Owner Load

Add:
- group-by controls
- owner workload overlays
- saved views
- `Project / Owner / Priority` lenses

This phase upgrades the screen from progress viewing to operational coordination.

### Phase 3: Operational Cockpit Features

Potential follow-up work:
- blocker state
- milestone overlays
- richer quick actions
- configurable workload thresholds

This phase should happen only after the team validates the value of phases 1 and 2.

## Implementation Notes

- Keep backend API changes minimal for the initial rollout.
- Prefer a frontend-derived ops model over embedding all operational logic directly in row rendering.
- Avoid mixing risk calculation too deeply into presentation code in [frontend/src/ops/GanttView.tsx](/C:/Users/dinghuy/OneDrive%20-%20HUYNH%20THY%20GROUP/Antigravity%20Workspace/crm-app/frontend/src/ops/GanttView.tsx).
- Consider extracting a dedicated derived-state layer for:
  - risk computation
  - owner workload computation
  - row visibility and grouping
- Preserve the current monthly timeline as the baseline to reduce rollout risk.

## Testing Focus

Implementation planning must cover tests for:
- risk classification behavior
- filter, group, and sort interactions
- auto-expand behavior
- timeline clipping within a selected month

These areas are high risk because the screen can appear visually correct while still surfacing the wrong operational slice.

## Acceptance Criteria

1. The default Gantt screen is optimized for `Ops lead` usage while remaining based on project grouping.
2. The screen surfaces actionable operational summary signals before the timeline rows.
3. Users can quickly pivot by owner, priority, and risk without leaving the Gantt page.
4. Risky items become easier to detect than in the current timeline-first design.
5. The screen reduces unnecessary expand-and-scroll behavior through smarter presets and auto-expand logic.
6. The design remains implementable in phased steps without requiring a full backend redesign.
