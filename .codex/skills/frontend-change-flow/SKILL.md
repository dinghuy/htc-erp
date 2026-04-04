---
name: frontend-change-flow
description: Use when changing htc-erp frontend UI, routes, components, selectors, or interaction behavior in ways that may require typecheck, core tests, UX contracts, UX audit, or browser verification.
---

# Frontend Change Flow

Use this for `htc-erp/frontend` work that changes user-facing behavior, route structure, selectors, or component logic.

## Use It For

- component, route, or layout changes under `frontend`
- selector or contract-sensitive UI changes
- interaction changes that may affect UX audit coverage
- browser-visible behavior where guessing is risky

Do not use it for backend-only work.

## Verification Order

1. Run `npm run typecheck` in `frontend`.
2. Run `npm run test:core` for normal frontend changes.
3. Run `npm run test:ux:contracts` when selectors, contracts, or QA-facing structure changed.
4. Run `npm run test:ux:audit` when user-facing layout or interaction changed materially.
5. Use Playwright when runtime behavior is still uncertain after code and test review.

## Decision Rules

- Skip `test:ux:contracts` only when the change does not affect selectors, QA hooks, or UI contracts.
- Skip `test:ux:audit` only when the change is not user-facing.
- If the task spans Notion specs, Linear issue state, Figma, or Playwright, start with `app-delivery-orchestrator`.

## Output Expectation

Report which frontend commands were run, which were intentionally skipped, and why.
