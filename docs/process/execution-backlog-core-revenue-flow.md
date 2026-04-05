# Execution Backlog: Core Revenue Flow

## Context Snapshot (2026-04-01)

- Git repo exists at `htc-erp` and active docs now route through `docs/index.md`.
- Phase 0 documentation baseline is present: product spec, architecture, ADRs, API catalog, runbooks, UAT checklist, UX audit docs, and AI task template.
- Backend has moved further toward modular boundaries, with shared contracts, ERP outbox normalization, explicit bootstrap files, and a bounded quotations reference module.
- Frontend remains hybrid: several core areas resolve through `features/*`, but the application shell still mounts a mix of feature routes and legacy screen entry files.
- CI already enforces repo hygiene and backend smoke checks, so the active backlog must distinguish completed items from remaining convergence work.

## Status Legend

- `done`: acceptance criteria are met and evidence exists in code, tests, CI, or docs.
- `partial`: meaningful implementation exists, but one or more acceptance criteria remain open or are not yet fully documented.
- `planned`: still relevant, but not yet implemented to the required acceptance level.
- `archived`: no longer active and should not drive current delivery.

## Prioritized Task List (Top 10)

1. `P0-CI-01` Enforce repository hygiene in CI
Status:
- `done`
Acceptance criteria:
- CI fails if tracked files match runtime artifacts (`*.db`, `*.log`, `dist/`, `node_modules/`, `tmp/`, cache files).
- Check runs on every push/PR.
- Rule is documented in release gate docs.
Evidence:
- `.github/workflows/ci.yml`
- `scripts/ci/check-repo-hygiene.mjs`
- `docs/process/release-gate.md`
Ownership:
- `.github/workflows/ci.yml`
- `scripts/ci/check-repo-hygiene.mjs` (new)
- `docs/process/release-gate.md`

2. `P0-CI-02` Add backend migration and DB-init smoke checks into CI
Status:
- `done`
Acceptance criteria:
- CI runs `npm run smoke:migration` and `npm run smoke:db-init` in backend job.
- Failing migration/init blocks merge.
Evidence:
- `.github/workflows/ci.yml`
- `backend/package.json`
Ownership:
- `.github/workflows/ci.yml`
- `backend/package.json`

3. `P0-PROC-01` Standardize AI task intake with mandatory template usage
Status:
- `done`
Acceptance criteria:
- Every new task doc references `docs/ai/task-template.md`.
- DoR/DoD and UAT links are required fields.
Evidence:
- `docs/ai/task-template.md`
- `docs/process/definition-of-ready.md`
- `docs/process/definition-of-done.md`
- `docs/index.md`
Ownership:
- `docs/ai/task-template.md`
- `docs/process/definition-of-ready.md`
- `docs/process/definition-of-done.md`

4. `P1-DOM-01` Lock canonical enums and role/permission matrix in shared contracts
Status:
- `done`
Acceptance criteria:
- Canonical enum values are defined once in backend shared contracts.
- Frontend contract mirrors are explicitly synchronized.
- Added tests assert expected enum value sets for core flow statuses.
Evidence:
- `backend/src/shared/contracts/domain.ts`
- `frontend/src/shared/domain/generatedContracts.ts`
- `frontend/src/shared/domain/contracts.ts`
- `backend/tests/revenue-flow-contracts.test.js`
Ownership:
- `backend/src/shared/contracts/domain.ts`
- `frontend/src/shared/domain/contracts.ts`
- `backend/tests/*` and/or `frontend/src/**/__tests__/*` (new/updated)

5. `P1-API-01` Publish endpoint ownership map for core flow (`/api/v1/*`)
Status:
- `done`
Acceptance criteria:
- API catalog maps each core endpoint to owning module and route file.
- Deprecated/legacy endpoints are tagged with migration status.
Evidence:
- `docs/api/api-catalog.md`
- `backend/src/modules/platform/apiV1Aliases.ts`
- `backend/src/modules/quotations/registerRoutes.ts`
Ownership:
- `docs/api/api-catalog.md`
- `backend/src/modules/**/routes.ts`

6. `P1-SCOPE-01` Put non-core modules into maintenance-only mode
Status:
- `done`
Acceptance criteria:
- Route/nav exposure for non-core modules is feature-gated or clearly marked maintenance-only.
- No new feature work starts in non-core modules during Phase 1.
Evidence:
- `docs/product/product-spec.md`
- `frontend/src/shared/domain/contracts.ts`
- `frontend/src/app.tsx`
- `frontend/src/layoutNavigation.ts`
- `frontend/src/Layout.tsx`
- `frontend/src/layoutNavigation.test.ts`
- `frontend/src/app.shell-composition.test.ts`
Ownership:
- `frontend/src/core/routes.ts`
- `frontend/src/features/**`
- `docs/product/product-spec.md`

7. `P2-BE-01` Enforce module boundary pattern in one pilot domain (`quotations`)
Status:
- `partial`
Acceptance criteria:
- `quotations` module follows `route -> validator/schema -> service -> repository -> mapper`.
- No business rule remains in route handlers for pilot scope.
- Existing behavior/tests remain green.
Evidence:
- `backend/src/modules/quotations/*`
- `backend/tests/route-boundary-guard.test.js`
- `docs/architecture/overview.md`
- `docs/api/api-catalog.md`
Open gaps:
- The quotations module structure exists and is the backend reference pattern, but some route handlers still reach into persistence directly during mutation flows.
Ownership:
- `backend/src/modules/quotations/*`
- `backend/tests/*`

8. `P2-BE-02` Separate DB bootstrap from seed/demo logic
Status:
- `done`
Acceptance criteria:
- Application startup path performs schema/init only.
- Seed data runs only from explicit scripts/commands.
- CI can run init/migration without side-effect seed writes.
Evidence:
- `backend/src/bootstrap/startServer.ts`
- `backend/sqlite-db.ts`
- `backend/scripts/db-seed.js`
- `backend/scripts/db-init-smoke.js`
- `.github/workflows/ci.yml`
Ownership:
- `backend/src/bootstrap/*`
- `backend/scripts/*`
- `backend/src/app.ts`

9. `P3-ERP-01` Harden ERP outbox with idempotency + retry + dead-letter visibility
Status:
- `partial`
Acceptance criteria:
- Outbox status transitions are explicit and auditable.
- Retry policy and max attempts are enforced.
- Failed events are queryable as dead-letter candidates.
Evidence:
- `backend/src/modules/erp/outboxContract.ts`
- `backend/src/modules/erp/repository.ts`
- `backend/src/modules/erp/service.ts`
- `docs/api/erp-outbox-contract.md`
- `docs/adr/ADR-0003-erp-outbox-state-model.md`
Open gaps:
- Normalized status model, retry thresholds, and dead-letter query surfaces exist, but full closure still depends on broader auditability and end-to-end ERP workflow confirmation.
Ownership:
- `backend/src/modules/erp/*`
- `docs/api/erp-outbox-contract.md`
- `docs/runbooks/*`

10. `P4-FE-01` Complete frontend feature-shell migration for core flow screens
Status:
- `done`
Acceptance criteria:
- Leads, Accounts/Customers, Quotations, Projects, Tasks, Approval-related views resolve through feature routes.
- Legacy monolithic screens are either removed from navigation or wrapped by feature route adapters.
Evidence:
- `frontend/src/app.tsx`
- `frontend/src/features/{leads,approvals,customers,quotations,projects,reports,tasks}/*`
- `frontend/src/app.shell-composition.test.ts`
- `frontend/src/shared/domain/contracts.ts`
Ownership:
- `frontend/src/core/routes.ts`
- `frontend/src/features/{leads,approvals,customers,quotations,projects,reports,tasks}/*`
- `frontend/src/*.tsx` (legacy route entry files)

## Current Execution Order

1. `P2-BE-01` Finish quotations route boundary cleanup.
2. `P3-ERP-01` Close ERP outbox auditability gaps and confirm runbook coverage.

## Suggested Subagent Boundaries

- Agent A (Docs/process): `docs/index.md`, `docs/process/*`, `docs/qa/*`.
- Agent B (Canonical docs/contracts): `docs/{product,architecture,domain,api}/*`, `backend/src/shared/contracts/*`.
- Agent C (Backend quotations cleanup): `backend/src/modules/quotations/*` only.
- Agent D (Frontend shell migration): `frontend/src/app.tsx`, `frontend/src/core/routes.ts`, `frontend/src/features/*`.
- Agent E (ERP outbox closure): `backend/src/modules/erp/*`, `docs/api/erp-outbox-contract.md`, relevant runbooks.

## Merge Safety Rules

- Each task must touch one bounded module or one pipeline surface.
- No cross-module mega-PRs.
- Every PR must include: short spec, acceptance checklist, verification commands, and UAT note link.
