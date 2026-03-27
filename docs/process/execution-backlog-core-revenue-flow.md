# Execution Backlog: Core Revenue Flow

## Context Snapshot (2026-03-26)

- Git repo exists at `crm-app` and root `.gitignore` already excludes common runtime artifacts.
- Phase 0 documentation baseline is present: product spec, architecture, ADR, API catalog, runbooks, UAT checklist, AI task template.
- Backend has modular folders under `backend/src/modules` and `backend/src/shared`.
- Frontend is in mixed mode: legacy screen files plus feature-oriented folders under `frontend/src/features`.
- CI exists at `.github/workflows/ci.yml` but currently misses migration/seed-smoke/repo-hygiene enforcement from the roadmap.

## Prioritized Task List (Top 10)

1. `P0-CI-01` Enforce repository hygiene in CI
Acceptance criteria:
- CI fails if tracked files match runtime artifacts (`*.db`, `*.log`, `dist/`, `node_modules/`, `tmp/`, cache files).
- Check runs on every push/PR.
- Rule is documented in release gate docs.
Ownership:
- `.github/workflows/ci.yml`
- `scripts/ci/check-repo-hygiene.mjs` (new)
- `docs/process/release-gate.md`

2. `P0-CI-02` Add backend migration and DB-init smoke checks into CI
Acceptance criteria:
- CI runs `npm run smoke:migration` and `npm run smoke:db-init` in backend job.
- Failing migration/init blocks merge.
Ownership:
- `.github/workflows/ci.yml`
- `backend/package.json`

3. `P0-PROC-01` Standardize AI task intake with mandatory template usage
Acceptance criteria:
- Every new task doc references `docs/ai/task-template.md`.
- DoR/DoD and UAT links are required fields.
Ownership:
- `docs/ai/task-template.md`
- `docs/process/definition-of-ready.md`
- `docs/process/definition-of-done.md`

4. `P1-DOM-01` Lock canonical enums and role/permission matrix in shared contracts
Acceptance criteria:
- Canonical enum values are defined once in backend shared contracts.
- Frontend contract mirrors are explicitly synchronized.
- Added tests assert expected enum value sets for core flow statuses.
Ownership:
- `backend/src/shared/contracts/domain.ts`
- `frontend/src/shared/domain/contracts.ts`
- `backend/tests/*` and/or `frontend/src/**/__tests__/*` (new/updated)

5. `P1-API-01` Publish endpoint ownership map for core flow (`/api/v1/*`)
Acceptance criteria:
- API catalog maps each core endpoint to owning module and route file.
- Deprecated/legacy endpoints are tagged with migration status.
Ownership:
- `docs/api/api-catalog.md`
- `backend/src/modules/**/routes.ts`

6. `P1-SCOPE-01` Put non-core modules into maintenance-only mode
Acceptance criteria:
- Route/nav exposure for non-core modules is feature-gated or clearly marked maintenance-only.
- No new feature work starts in non-core modules during Phase 1.
Ownership:
- `frontend/src/core/routes.ts`
- `frontend/src/features/**`
- `docs/product/product-spec.md`

7. `P2-BE-01` Enforce module boundary pattern in one pilot domain (`quotations`)
Acceptance criteria:
- `quotations` module follows `route -> validator/schema -> service -> repository -> mapper`.
- No business rule remains in route handlers for pilot scope.
- Existing behavior/tests remain green.
Ownership:
- `backend/src/modules/quotations/*`
- `backend/tests/*`

8. `P2-BE-02` Separate DB bootstrap from seed/demo logic
Acceptance criteria:
- Application startup path performs schema/init only.
- Seed data runs only from explicit scripts/commands.
- CI can run init/migration without side-effect seed writes.
Ownership:
- `backend/src/bootstrap/*`
- `backend/scripts/*`
- `backend/src/app.ts`

9. `P3-ERP-01` Harden ERP outbox with idempotency + retry + dead-letter visibility
Acceptance criteria:
- Outbox status transitions are explicit and auditable.
- Retry policy and max attempts are enforced.
- Failed events are queryable as dead-letter candidates.
Ownership:
- `backend/src/modules/erp/*`
- `docs/api/erp-outbox-contract.md`
- `docs/runbooks/*`

10. `P4-FE-01` Complete frontend feature-shell migration for core flow screens
Acceptance criteria:
- Leads, Accounts/Customers, Quotations, Projects, Tasks, Approval-related views resolve through feature routes.
- Legacy monolithic screens are either removed from navigation or wrapped by feature route adapters.
Ownership:
- `frontend/src/core/routes.ts`
- `frontend/src/features/{customers,quotations,projects,tasks,admin,event-log}/*`
- `frontend/src/*.tsx` (legacy route entry files)

## First 3 Tasks To Execute Today

1. `P0-CI-01` repository hygiene CI gate.
2. `P0-CI-02` backend migration/db-init smoke in CI.
3. `P2-BE-01` quotations module pilot refactor boundary design (start with folder + interface skeleton, then move one route flow).

## Suggested Subagent Boundaries

- Agent A (CI/Process): `.github/workflows/ci.yml`, `scripts/ci/*`, docs in `docs/process/*`.
- Agent B (Backend contracts): `backend/src/shared/contracts/*`, backend enum/status tests.
- Agent C (Backend quotations pilot): `backend/src/modules/quotations/*` only.
- Agent D (Frontend routing scope): `frontend/src/core/routes.ts`, `frontend/src/features/*` routing exports.
- Agent E (ERP outbox hardening): `backend/src/modules/erp/*`, `docs/api/erp-outbox-contract.md`.

## Merge Safety Rules

- Each task must touch one bounded module or one pipeline surface.
- No cross-module mega-PRs.
- Every PR must include: short spec, acceptance checklist, verification commands, and UAT note link.
