# API Catalog

## Namespace Direction

All new and refactored endpoints should move toward `/api/v1`.

Legacy `/api/*` endpoints remain active for backward compatibility. Core auth, projects, tasks, quotations, approvals, and ERP operator routes are also available through the normalized `/api/v1/*` namespace.

The current compatibility shim lives in `backend/src/modules/platform/apiV1Aliases.ts`. Endpoints listed below should continue to move from alias-only coverage toward true module-owned `/api/v1/*` registration as modules are extracted from `backend/src/app.ts`.

## Required Domains

- `/api/v1/auth`
- `/api/v1/leads`
- `/api/v1/accounts`
- `/api/v1/contacts`
- `/api/v1/quotations`
- `/api/v1/projects`
- `/api/v1/tasks`
- `/api/v1/approvals`
- `/api/v1/integrations/erp/outbox`

## Work Hub Domains

These domains define ownership direction for the Huly-inspired Work Hub expansion. Some are already implemented, while others remain planned convergence targets.

- `/api/v1/projects/:id/workspace`
- `/api/v1/projects/:id/activities`
- `/api/v1/projects/:id/milestones`
- `/api/v1/tasks/:id/dependencies`
- `/api/v1/tasks/:id/worklogs`
- `/api/v1/approvals/queue`
- `/api/v1/threads`
- `/api/v1/projects/:id/documents`

## Contract Rules

- Responses must use stable DTOs.
- Errors must return a consistent API error shape.
- Mutating endpoints must document validation, side effects, and downstream ERP events.
- Filterable list endpoints must document supported query parameters and pagination behavior.
- ERP integration events must follow `docs/api/erp-outbox-contract.md`.

## Quotation Endpoint Ownership

Current route entry point: `backend/src/modules/quotations/registerRoutes.ts`

### Read

- `GET /api/quotations` -> `routes/readRoutes.ts`
- `GET /api/quotations/:id` -> `routes/readRoutes.ts`
- `GET /api/quotations/:id/pdf` -> `routes/pdfRoutes.ts`

### Mutations

- `POST /api/projects/:id/quotations` -> `routes/mutationRoutes.ts`
- `POST /api/quotations` -> `routes/mutationRoutes.ts`
- `PUT /api/quotations/:id` -> `routes/mutationRoutes.ts`
- `POST /api/quotations/:id/revise` -> `routes/mutationRoutes.ts`
- `DELETE /api/quotations/:id` -> `routes/mutationRoutes.ts`

### Write-Path Pipeline (Mutation Endpoints)

- `schemas/*`: body parse and object-shape guard
- `validators/*`: status and transition rules
- `service.ts`: business orchestration and integration side effects
- `repository.ts`: DB writes/reads
- `mappers/*`: payload normalization per flow

### Mutation Error Conventions

- `400 INVALID_REQUEST_BODY` for non-object mutation body
- `400 INVALID_STATUS_TRANSITION` for unsupported status or transition
- `400 READ_ONLY` when quotation state is immutable
- `409 STATUS_CONFLICT` when `expectedStatus` does not match current persisted status

## Core Ownership Map

| Namespace | Current owner | Route file(s) | Notes |
| --- | --- | --- | --- |
| `/api/v1/auth` | `auth` | `backend/src/app.ts`, alias via `backend/src/modules/platform/apiV1Aliases.ts` | Still registered in app bootstrap; candidate for extraction |
| `/api/v1/leads` | `crm` | `backend/src/modules/crm/routes.ts`, alias via `backend/src/modules/platform/apiV1Aliases.ts` | Alias-backed today; target is true module-owned `/api/v1` registration |
| `/api/v1/accounts` | `crm` | `backend/src/modules/crm/routes.ts`, alias via `backend/src/modules/platform/apiV1Aliases.ts` | Alias-backed today; target is true module-owned `/api/v1` registration |
| `/api/v1/contacts` | `crm` | `backend/src/modules/crm/routes.ts`, alias via `backend/src/modules/platform/apiV1Aliases.ts` | Alias-backed today; target is true module-owned `/api/v1` registration |
| `/api/v1/quotations` | `quotations` | `backend/src/modules/quotations/registerRoutes.ts` | Reference bounded module |
| `/api/v1/projects` | `projects` | `backend/src/modules/projects/readRoutes.ts`, `backend/src/modules/projects/writeRoutes.ts`, `backend/src/modules/projects/workflowRoutes.ts`, `backend/src/modules/projects/governanceRoutes.ts`, `backend/src/modules/projects/logisticsRoutes.ts`, `backend/src/modules/projects/contractRoutes.ts`, `backend/src/modules/projects/supplierQuoteRoutes.ts` | Still composed from multiple project route files |
| `/api/v1/tasks` | `tasks` | `backend/src/modules/tasks/routes.ts` | Module-owned |
| `/api/v1/approvals` | `approvals` | `backend/src/app.ts`, alias via `backend/src/modules/platform/apiV1Aliases.ts` | Still bound to legacy `/api/approval-requests` routes in app bootstrap |
| `/api/v1/integrations/erp/outbox` | `erp` | `backend/src/modules/erp/routes.ts` | Canonical ERP outbox namespace |
| `/api/v1/projects/:id/activities` | `projects` | `backend/src/modules/projects/readRoutes.ts` | Project-scoped activity stream read model |
| `/api/v1/tasks/:id/checklist` | `tasks` | `backend/src/modules/tasks/routes.ts` | Task-scoped checklist items backed by local ToDo storage |

## Planned Work Hub Ownership Direction

| Planned namespace | Target owner | Expected route surface | Phase |
| --- | --- | --- | --- |
| `/api/v1/projects/:id/workspace` | `projects` | workspace summary and readiness aggregation | Phase 1 |
| `/api/v1/projects/:id/activities` | `projects` | project activity stream | Phase 3 |
| `/api/v1/projects/:id/milestones` | `projects` | already present under legacy `/api/projects/:projectId/milestones`; should converge on true `/api/v1` ownership | Phase 1 |
| `/api/v1/tasks/:id/dependencies` | `tasks` | dependency graph and blocker semantics | Phase 1 |
| `/api/v1/tasks/:id/worklogs` | `tasks` | time/work execution log | Phase 1 |
| `/api/v1/tasks/:id/checklist` | `tasks` | task-scoped checklist items and completion state | Phase 3 |
| `/api/v1/tasks/:id/subtasks` | `tasks` | parent-child task hierarchy and sub-issue creation | Phase 3 |
| `/api/v1/tasks/:id/subtasks/reorder` | `tasks` | sibling ordering for subtask hierarchy | Phase 3 |
| `/api/v1/tasks/bulk-update` | `tasks` | bulk status, owner, and priority updates for selected tasks | Phase 3 |
| `/api/v1/projects/:id/tasks/reorder` | `tasks` | manual ordering for top-level tasks inside a project scope | Phase 3 |
| `/api/v1/approvals/queue` | `approvals` | lane-aware approval cockpit payload | Phase 1 |
| `/api/v1/threads` | `collaboration` | entity-scoped discussion threads | Phase 2 |
| `/api/v1/projects/:id/documents` | `projects` or `collaboration` | project-scoped document and review state | Phase 2 |
| `/api/v1/tasks/views` | `tasks` | saved tracker-like task views and user defaults | Phase 3 |

## Current Delivery Gates

- Blocking backend gates: `npm run typecheck`, `npm run build`, `npm run smoke:db-init`, `npm run smoke:migration`, `npm run test:core`
- Blocking frontend gates: `npm run sync:contracts`, `npm run typecheck`, `npm run build`, `npm run test:core`
- Non-core suites remain isolated behind `test:noncore` in both packages and should not block revenue-flow stabilization unless the touched change is in that scope
