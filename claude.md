# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## HTC ERP Agent Instructions

## Non-Negotiables

- Work from short written specs and bounded tasks only.
- Keep changes additive and scoped; do not bundle large cross-module rewrites.
- Every material change must include verification evidence.
- Keep generated runtime artifacts, logs, caches, and temp outputs out of Git.

## Source Of Truth

- Start from `docs/index.md` to find the active canonical docs for the task.
- Never scan `docs/` recursively. Open `docs/index.md` first and read only the active files it links to.
- `docs/index.md` entries must carry one-line purpose metadata so the first routing decision can be made from the index alone.
- Use Linear as the execution tracker for active workstreams.
- Use Notion as the plan and evidence tracker.
- Update an existing tracked item when it already exists; create one for material work before context is lost.

## Execution Routing

- Use repo docs first, then choose the lightest workflow that fits the task.
- Default OMX path:
  1. Use `$deep-interview` when the request is broad, ambiguous, or missing acceptance criteria.
  2. Use `$ralplan` for execution-ready planning on multi-step or risky work.
  3. Use `$ralph` for single-owner execution with verification.
  4. Use `$team` when work cleanly splits into parallel lanes.
- Use ECC for deeper research, TDD, security review, debugging, or code review when needed.
- Use browser or release-oriented workflows only when browser truth, UX evidence, or ship/deploy evidence is required.
- Use subtree `AGENTS.md` files for directory-specific guidance; keep root guidance as the orchestration layer.
- Ignore `archive/` and other non-active storage locations unless the user explicitly asks for historical material.
- One-depth follow rule: when an active doc links directly to another internal doc needed to complete the same reasoning step, you may follow that single hop without returning to `docs/index.md`. Do not continue chaining beyond one hop unless you re-anchor on `docs/index.md` or the user explicitly asks for deeper historical/context traversal.

## File Classification

- Files intended for repeated operational use must live in the active docs structure and be linked from `docs/index.md`.
- Canonical docs belong under stable domain folders such as `docs/product/`, `docs/architecture/`, `docs/domain/`, `docs/api/`, `docs/process/`, `docs/qa/`, or `docs/runbooks/`.
- Active workstream plans belong in `docs/workstreams/` and must be listed in `docs/index.md`.
- Historical plans, branch-specific execution notes, generated reports, exported documents, scratch notes, and one-off helper scripts must not stay in the active docs reading set.
- Put historical or reference-only material under `archive/`; put temporary working files under `tmp/`.
- If a new file is not meant to be read on future routine tasks, exclude it from `docs/index.md` and keep it out of active directories.
- `tmp/` is excluded from normal context loading to protect prompt-cache stability; only open files there when the user explicitly asks for a scratch artifact or a specific temporary file.
- Workstream archive trigger: when a plan is completed, superseded, merged into canonical docs, or no longer directs current execution, the person closing that workstream must move it from `docs/workstreams/` to `archive/` and update `docs/index.md` in the same change.

## Engineering Guardrails

- Keep presentation, orchestration, domain logic, and persistence concerns separated.
- Design backend and frontend modules as bounded contexts with high cohesion. Do not let one module reach into another module's tables, hidden state, or persistence internals except through explicit repository/service interfaces.
- Keep UI thin and domain/core thick. Large screens may orchestrate state, but business rules, calculations, workflow guards, and data-shaping logic should live in shared kernels, domain services, or focused helpers rather than inline in view components.
- Keep authorization decoupled from leaf UI. Prefer central permission builders, route-level gating, or wrapper/hook-based access decisions over repeated ad hoc `if (!canAccess)` branches inside action handlers.
- Validate and normalize external input at system boundaries.
- Treat API requests and responses as explicit contracts; keep them consistent and backward-compatible unless a planned break is approved.
- Avoid hardcoded business rules, secrets, endpoints, labels, colors, spacing, and status mappings inside features.
- Prefer shared config, tokens, enums, constants, and existing module patterns over ad hoc duplication.
- Put cross-surface business rules into a shared kernel when they are needed by both backend and frontend. Types, constants, and pure functions must be imported from one canonical source rather than copied between layers.
- Prefer vertical slices over horizontal delivery. When building or refactoring a capability, complete the minimum coherent slice across schema, backend logic, frontend surface, and verification rather than leaving partially integrated layers behind.
- Separate write-side normalization from read-side optimization. Keep write models explicit and normalized; for dashboards, workspaces, and Gantt/read-heavy surfaces, allow dedicated rollups or denormalized read models instead of pushing complex joins into UI code.

## Verification And Delivery

- Run the narrowest relevant verification first, then expand if risk justifies broader checks.
- Do not claim completion until required tests, lint, typecheck, UAT, or browser verification have actually run, or the blocker is recorded explicitly.
- Bug fixes should add a regression test when feasible.
- User-facing changes should include UAT notes and UX evidence when relevant.
- Before handoff or PR, update tracking records with scope, status, resolution, and verification evidence.

## Git Workflow

- Work on a dedicated branch for one bounded task.
- For every new feature, create and use a separate dedicated branch before implementation starts. Do not mix multiple new features on the same branch.
- If the user switches to a different problem or topic mid-chat, recommend starting a new chat so planning, verification, and branch scope stay clean.
- Use focused conventional commits such as `feat:`, `fix:`, `refactor:`, `docs:`, or `test:`.
- Open a PR instead of merging local work directly.
- Every PR must include summary, scope, risks, and verification evidence.

## Common Commands

Run commands from the package directory unless noted otherwise.

- No `lint` script is currently defined in the backend or frontend package scripts. Do not assume `pnpm lint`; use the listed typecheck/test/build commands instead.

### Backend (`backend/`)

- Install: `pnpm install`
- Dev server: `pnpm --dir backend dev`
- Build: `pnpm --dir backend build`
- Start built server: `pnpm --dir backend start`
- Typecheck: `pnpm --dir backend typecheck`
- Core tests: `pnpm --dir backend test:core`
- Full tests: `pnpm --dir backend test:all`
- Single focused suites:
  - Auth API: `pnpm --dir backend test:auth`
  - QA seed API: `pnpm --dir backend test:qa-seed`
- DB verification:
  - Init smoke: `pnpm --dir backend smoke:db-init`
  - Migration smoke: `pnpm --dir backend smoke:migration`
  - Seed local DB: `pnpm --dir backend db:seed`
- Media runtime verification: `pnpm --dir backend verify:media-runtime`
- One-off single test file pattern: `node -r ./tests/bootstrap-test-env.js tests/<file>.test.js`

### Frontend (`frontend/`)

- Install: `pnpm install`
- Dev server: `pnpm --dir frontend dev`
- QA dev server on fixed port `4173`: `pnpm --dir frontend dev:qa`
- Build: `pnpm --dir frontend build`
- Preview build: `pnpm --dir frontend preview`
- Typecheck: `pnpm --dir frontend typecheck`
- Contract sync from backend: `pnpm --dir frontend sync:contracts`
- Core tests: `pnpm --dir frontend test:core`
- Full tests: `pnpm --dir frontend test:all`
- Targeted suites:
  - UX contract tests: `pnpm --dir frontend test:ux:contracts`
  - UX audit (PowerShell wrapper): `pnpm --dir frontend test:ux:audit`
  - UX audit headed: `pnpm --dir frontend test:ux:audit:headed`
  - Node entrypoint version: `pnpm --dir frontend test:ux:audit:node`
- One-off single test file pattern: `node ./scripts/run-vitest-sandbox.mjs src/path/to/test.test.ts`

### Cross-surface verification order

- Shared contract changes: run `pnpm --dir backend typecheck`, then `pnpm --dir frontend sync:contracts`, then frontend typecheck/tests/build.
- Backend delivery gate from docs: `pnpm --dir backend typecheck && pnpm --dir backend build && pnpm --dir backend smoke:db-init && pnpm --dir backend smoke:migration && pnpm --dir backend test:core`
- Frontend delivery gate from docs: `pnpm --dir frontend sync:contracts && pnpm --dir frontend typecheck && pnpm --dir frontend build && pnpm --dir frontend test:core`

### Quick verification matrix

- UI-only change: `pnpm --dir frontend typecheck && pnpm --dir frontend test:core && pnpm --dir frontend build`
- API/backend-only change: `pnpm --dir backend typecheck && pnpm --dir backend build && pnpm --dir backend test:core`
- Shared contract change: `pnpm --dir backend typecheck && pnpm --dir frontend sync:contracts && pnpm --dir frontend typecheck && pnpm --dir frontend test:core && pnpm --dir frontend build`
- DB/bootstrap/migration change: `pnpm --dir backend typecheck && pnpm --dir backend build && pnpm --dir backend smoke:db-init && pnpm --dir backend smoke:migration && pnpm --dir backend test:core`
- User-facing UI regression-sensitive change: start with the UI-only gate, then add `pnpm --dir frontend test:ux:contracts` and browser/UX audit when the change affects shell/layout/overlay behavior

## Architecture Snapshot

### Runtime shape

- The repo is a modular monolith, not separate microservices. The active target architecture is documented in [docs/architecture/overview.md](docs/architecture/overview.md).
- `backend/` is an Express + TypeScript server with module-oriented route ownership under `backend/src/modules/*`, shared infrastructure under `backend/src/shared/*`, bootstrap wiring under `backend/src/bootstrap/*`, and SQLite persistence split under `backend/src/persistence/sqlite/*`.
- `frontend/` is a Vite + Preact app. The route shell still mixes newer feature routes with some legacy screen entry files, so expect a hybrid migration state rather than a fully converged `features/*` app.

### Business domains and boundaries

- Core business flow is lead → quotation → approval → project/workspace → ERP outbox handoff.
- Canonical entities and enums live on the backend contract side and are synchronized forward to the frontend. Source of truth is `backend/src/shared/contracts/domain.ts`; generated frontend contracts land in `frontend/src/shared/domain/generatedContracts.ts` via `scripts/sync-shared-contracts.mjs`.
- New/refactored APIs should move toward `/api/v1/*`. Some domains still rely on compatibility aliases in `backend/src/modules/platform/apiV1Aliases.ts`, so check whether you are changing a true module-owned route or an alias-backed legacy surface.
- ERP integration uses outbox semantics. Side effects should flow through ERP/outbox contracts rather than ad hoc direct integrations.

### Module patterns that matter

- Backend handlers should stay thin: route registration → schema parse/validation → service orchestration → repository persistence. The quotations module is the reference implementation for this shape (`registerRoutes.ts`, `routes/*`, `schemas/*`, `validators/*`, `service.ts`, `repository.ts`, `mappers/*`).
- Frontend code should keep shell/layout orchestration separate from business rules. Reuse `frontend/src/ui/tokens.ts` and `frontend/src/ui/styles.ts` instead of feature-local style systems.
- Keep cross-surface rules in shared pure TypeScript kernels/contracts rather than duplicating logic separately in backend and frontend.

## Repo-Specific Working Rules

- Start with [docs/index.md](docs/index.md). Read only the active docs it routes to; do not recursively scan `docs/`.
- For any frontend or UI work, read [DESIGN.md](DESIGN.md) and [docs/runbooks/ui-theme-principles.md](docs/runbooks/ui-theme-principles.md) first.
- For backend changes, also check [backend/AGENTS.md](backend/AGENTS.md). For frontend changes, check [frontend/AGENTS.md](frontend/AGENTS.md). For docs work, check [docs/AGENTS.md](docs/AGENTS.md).
- Use `frontend/build/` as the production verification output path. Do not rely on `frontend/dist/` in this workspace.
- Keep runtime artifacts, caches, generated outputs, and scratch files out of Git; use `tmp/` for disposable artifacts and `archive/` for historical/reference-only material.
- When UI patterns, shell behavior, spacing/token rules, or reusable visual grammar change, update both [DESIGN.md](DESIGN.md) and [docs/runbooks/ui-theme-principles.md](docs/runbooks/ui-theme-principles.md) in the same slice unless the user explicitly narrows scope.
- Treat Linear as the execution tracker and Notion as the plan/evidence tracker for material workstreams.
- Before claiming completion, record actual verification evidence; this repo expects proof, not assumed pass status.
