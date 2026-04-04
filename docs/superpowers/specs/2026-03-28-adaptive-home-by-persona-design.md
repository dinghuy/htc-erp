# Adaptive Home By Persona Design

Date: 2026-03-28
Status: Proposed
Scope: `frontend/src/Home.tsx` and small home-specific presentation helpers only

## Problem

`Home` currently tries to serve every persona with one dense layout:

- hero
- quick actions
- suggested actions
- KPI cards
- project highlights

This creates two UX failures:

1. executive users do not get a true cockpit view
2. operator users do not get a clear “what should I do next” view

The current data payload is flexible enough, but the presentation hierarchy is not.

## Goal

Render `Home` differently depending on persona mode so the first screen matches how that user works.

Success criteria:

- `director` and `admin` see a KPI/cockpit-first home
- operator roles see an action-first home
- no change to backend payload contract
- no change to permissions or route gating
- less visible density above the fold

## Chosen Approach

Use one shared `Home` container with two layout templates:

- `executive template`
- `operator template`

Role mapping:

- `director`, `admin` -> `executive`
- `accounting`, `legal` -> `executive-lite`
- `sales`, `project_manager`, `procurement`, `viewer` -> `operator`

Implementation detail:

- `executive-lite` is not a third full template
- it reuses the executive structure with lighter KPI emphasis and stronger queue visibility

## Why This Approach

This keeps logic maintainable while making the screen genuinely role-aware.

Benefits:

- strong UX difference where it matters
- avoids forking the whole screen per role
- preserves current home payload and navigation helpers
- easier to test than fully separate persona pages

Trade-offs:

- `Home.tsx` should be split into smaller presentational units to stay readable
- some cards will exist in both templates but in different order/weight

## Template Design

### Executive Template

Used for:

- `director`
- `admin`
- `accounting`
- `legal`

Top-to-bottom order:

1. compact hero
   - role badge
   - one-line summary
   - at most 2 actions
2. KPI strip
   - the most important 3-4 numbers
3. risk / exception lane
   - approvals waiting
   - blockers
   - missing documents
   - payment / legal / executive exceptions depending on role
4. projects needing attention
   - list of highlighted projects
5. secondary queue actions

Rules:

- KPI cards become the primary visual anchor
- suggested actions are demoted below KPIs
- copy should sound like monitoring and intervention, not task execution

### Operator Template

Used for:

- `sales`
- `project_manager`
- `procurement`
- `viewer`

Top-to-bottom order:

1. compact hero
   - role badge
   - one-line summary
   - 1 primary action and 1 secondary action maximum
2. next actions rail
   - 2-3 action cards only
   - explicit task-oriented phrasing
3. hot queue / project focus
   - project highlights with blockers and next step
4. supporting KPIs
   - same data, lower visual priority

Rules:

- “what should I do now” must be obvious in one glance
- KPI cards become supporting context, not the headline
- cards should guide into `My Work`, `Approvals`, `Inbox`, or a specific project

## Content Rules

### Common Rules

- remove duplicated CTA meaning across hero and suggested actions
- no more than 2 hero buttons
- no more than 3 action cards above the fold
- if a KPI is zero and not urgent, it should not dominate the screen

### Executive Rules

- prefer labels like `rủi ro`, `đang chờ`, `cần can thiệp`, `cần quyết định`
- highlight counts and thresholds first
- project list should emphasize risk and readiness

### Operator Rules

- prefer labels like `xử lý`, `mở`, `theo dõi`, `đẩy bước kế tiếp`
- highlight the next move, not a dashboard summary
- project list should emphasize action availability and blockers

## Component Structure

Recommended split:

- `Home.tsx`
  - loads payload
  - maps persona to template
  - passes normalized view model
- `home/HomeExecutiveView.tsx`
  - KPI-first layout
- `home/HomeOperatorView.tsx`
  - action-first layout
- `home/homeViewModel.ts`
  - normalizes existing payload into shared sections

This keeps the fetch/data logic centralized while moving visual branching into focused files.

## Non-Goals

- changing backend `workspace/home` payload
- changing role capability logic
- changing project/workflow navigation helpers
- redesigning every card component in the app

## Testing

Must verify:

- persona -> template mapping is deterministic
- director/admin prioritize KPI before action cards
- operator roles prioritize action cards before KPI
- existing navigation targets still work
- zero-state still renders cleanly for both template families

## Follow-up

After this pass:

- tune `Home` copy per role more aggressively
- decide whether `admin` should stay executive or move to a system-ops specific template later
