# API Catalog

## Namespace Direction

All new and refactored endpoints should move toward `/api/v1`.

Legacy `/api/*` endpoints remain active for backward compatibility. Core auth, projects, tasks, quotations, approvals, and ERP operator routes are also available through the normalized `/api/v1/*` namespace.

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
