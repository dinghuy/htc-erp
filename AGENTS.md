# HTC ERP Agent Instructions

These instructions apply to Codex agents working in this repository.

## Core Rules

- Work only from short written specs and bounded implementation tasks.
- Every code change must include verification evidence.
- Large cross-module rewrites are not allowed in one change.
- Generated runtime artifacts must stay out of Git.

## Source Of Truth

- Start from `docs/index.md` to find the active canonical docs for the task.
- Use Linear as the execution tracker for active workstreams.
- Use Notion as the plan and evidence tracker.

## Tracking Rule

- Any material problem, bug, blocker, decision, or cleanup item must be tracked.
- The tracking record must capture:
  - what the problem is
  - where it appears
  - impact or risk
  - chosen resolution or workaround
  - current status
  - verification or evidence links when available
- If both Linear and Notion are in use:
  - record execution state in Linear
  - record context, resolution notes, and evidence in Notion
- If a tracked item already exists, update it instead of creating a duplicate.
- If no tracked item exists and the issue is material, create one before or during execution, not after the context is lost.

## Delivery Workflow

1. Identify the active canonical docs in `docs/index.md`.
2. Create or update a short spec when needed.
3. Make sure any material issue or workstream is tracked in Linear and Notion.
4. Implement one bounded task only.
5. Run verification commands.
6. Update the tracker with the result, resolution summary, and evidence.
7. Update UAT notes if user-facing behavior changed.
