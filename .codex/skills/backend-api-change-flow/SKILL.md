---
name: backend-api-change-flow
description: Use when changing htc-erp backend routes, contracts, auth, mutations, or runtime behavior that may require backend typecheck, core tests, non-core tests, or media runtime verification.
---

# Backend API Change Flow

Use this for `htc-erp/backend` work that changes routes, request handling, auth, contract shape, or runtime-sensitive server behavior.

## Use It For

- API route or handler changes
- auth, permission, or token flow changes
- shared contract or response-shape changes
- server-side mutation or runtime behavior changes
- product media flows that may touch runtime verification

Do not use it for frontend-only work.

## Verification Order

1. Run `npm run typecheck` in `backend`.
2. Run `npm run test:core` for normal backend changes.
3. Run `npm run test:all` when non-core surfaces are touched or when the blast radius is unclear.
4. Run `npm run verify:media-runtime` for product media or runtime-sensitive media changes.

## Decision Rules

- Prefer `test:core` first, then expand to `test:all` when routes or modules outside the core boundary changed.
- Treat auth, shared contracts, and multi-surface API changes as reasons to broaden verification.
- If the task also depends on Linear, Notion, Figma, or browser truth, start with `app-delivery-orchestrator`.

## Output Expectation

Report which backend commands were run, which were intentionally skipped, and why.
