# Architecture Overview

## Direction

The application follows a modular monolith strategy on the existing stack. Deployment remains simple, while code ownership and change scope become module-oriented.

## Backend Modules

- `bootstrap`: startup, configuration, server wiring
- `shared`: auth middleware, DTOs, enums, HTTP helpers
- `auth`: login, password change, session identity
- `master-data`: leads, accounts, contacts, products, suppliers
- `quotation`: quotations, pricing, approval triggers
- `project-workspace`: project handoff, contracts, procurement, delivery, milestones
- `tasks-approvals`: task management and approval workflow
- `integrations/erp`: outbox, retries, sync execution

## Frontend Modules

- `core`: app shell, route selection, session bootstrap
- `shared`: domain contracts, API configuration, shared utilities
- `features/auth`
- `features/master-data`
- `features/quotation`
- `features/projects`
- `features/tasks`
- `features/approvals`
- `features/erp`

The current frontend is still in a hybrid migration state:

- several core flows already resolve through `features/*`
- the main shell in `frontend/src/app.tsx` still mounts a mix of feature routes and legacy screen entry files
- route convergence and non-core surface reduction remain active delivery work rather than completed migration

## Engineering Rules

- Route handlers must stay thin.
- Business rules belong in services, not HTTP controllers.
- Persistence access should go through repositories or dedicated data functions.
- Shared enums and DTOs must be defined once per application side and mapped explicitly.
- Integration side effects must use outbox semantics.

## Persistence Direction

- `backend/sqlite-db.ts` is now a thin compatibility entrypoint.
- SQLite persistence responsibilities are split under `backend/src/persistence/sqlite/*` into bootstrap, finalize, runtime, default-admin, and seed concerns.
- Core route files for `auth`, `crm`, `tasks`, `projects`, `workspace/reporting`, and `collaboration` are expected to stay free of direct `getDb()` calls.
- PostgreSQL remains the target persistence direction after repository boundaries are completed.

## Quotation Module Reference (Implemented)

The `quotations` module now follows a concrete bounded flow:

- `registerRoutes.ts`: module-level wiring only
- `routes/*`: endpoint registration by concern (`mutation`, `read`, `pdf`)
- `schemas/*`: request body shape parsing and normalization guard
- `validators/*`: domain/state transition validation
- `service.ts`: orchestration and business workflow
- `repository.ts`: persistence operations
- `mappers/*`: flow-specific payload normalization (`create project`, `create standalone`, `update`, `revise`)

For backward compatibility during migration:

- `mapper.ts` re-exports from `mappers/index.ts`
- `validators.ts` re-exports from `validators/index.ts`

This structure is the target pattern for other core domains during Phase 2.

## Huly Work Hub Direction

The Huly adoption path for `htc-erp` is capability-led, not platform-led.

- Workspace, tasks, approvals, activity, and project documents may evolve toward a Huly-like Work Hub experience.
- Huly internals such as plugin runtime, Cockroach/Redpanda topology, and realtime core are explicitly out of scope for direct import.
- The detailed capability matrix and phase roadmap live in `docs/architecture/huly-work-hub-roadmap.md`.
