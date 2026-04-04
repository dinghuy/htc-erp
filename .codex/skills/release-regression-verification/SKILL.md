---
name: release-regression-verification
description: Use when preparing htc-erp work for handoff, review, or release after cross-frontend/backend changes, especially when regression coverage, UX audit, or browser verification needs to be called explicitly.
---

# Release Regression Verification

Use this after cross-surface work or before handoff when you need to prove the change is safe enough to review or release.

## Use It For

- frontend and backend changed in the same task
- release-readiness or regression questions
- work that touched UI plus API or shared contracts
- final verification before handoff

## Verification Matrix

- Frontend baseline: `npm run typecheck` and `npm run test:core`
- Frontend contract-sensitive: add `npm run test:ux:contracts`
- Frontend user-facing: add `npm run test:ux:audit`
- Backend baseline: `npm run typecheck` and `npm run test:core`
- Backend expanded coverage: add `npm run test:all` when non-core areas changed
- Media/runtime-sensitive backend work: add `npm run verify:media-runtime`
- Browser truth needed: use Playwright for runtime confirmation instead of inference

## Decision Rules

- Choose the narrowest verification set that still covers the changed surfaces.
- If both frontend and backend changed, report verification by surface instead of one merged summary.
- If any required verification cannot be run, say exactly what remains unverified.
- If the task needs issue/spec/design context before verification, start with `app-delivery-orchestrator`.

## Output Expectation

Summarize verification as:
- frontend checks run
- backend checks run
- browser checks run
- remaining risks or skipped checks
