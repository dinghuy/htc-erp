# ERP Outbox Operations

## Purpose

Provide a single operator-facing runbook for inspecting ERP sync state, retry exhaustion, and manual re-run behavior.

## Canonical Surfaces

- API contract: `docs/api/erp-outbox-contract.md`
- ADR: `docs/adr/ADR-0003-erp-outbox-state-model.md`
- Runtime route owner: `backend/src/modules/erp/routes.ts`
- Runtime sync engine: `backend/erp-sync.ts`

## How To Inspect The Queue

Use the authenticated outbox read endpoint:

- `GET /api/integrations/erp/outbox`
- Alias: `GET /api/erp/outbox`
- Versioned alias: `GET /api/v1/integrations/erp/outbox`

Recommended queries:

- All recent events: `GET /api/integrations/erp/outbox?limit=50`
- Retryable failures only: `GET /api/integrations/erp/outbox?status=retryable_failed&limit=50`
- Dead-letter candidates only: `GET /api/integrations/erp/outbox?status=dead_letter&limit=50`
- Dead-letter alias also works: `GET /api/integrations/erp/outbox?status=dead-letter&limit=50`

## How To Read The Response

- `items[*].status` is the API-facing normalized state
- `items[*].idempotencyKey` is the dedupe key used to prevent duplicate side effects
- `items[*].retryCount` / `items[*].attempts` is the recorded attempt count
- `items[*].lastError` is the latest delivery failure message
- `items[*].nextRunAt` is when the next retry becomes eligible
- `items[*].isDeadLetter` becomes `true` when retry exhaustion has been reached
- `stats.deadLetter` is the current dead-letter candidate count
- `policy.maxAttempts` is the retry exhaustion threshold
- `policy.retrySchedule` describes the current backoff behavior

## Retry Policy

- Base delay: `30 seconds`
- Strategy: exponential backoff
- Maximum delay cap: `60 minutes`
- Retry exhaustion threshold: `5 attempts`
- Once the threshold is reached, the API normalizes the item to `dead_letter`

## How To Trigger A Manual Sync Pass

Use the authenticated sync route:

- `POST /api/integrations/erp/outbox/run`
- Alias: `POST /api/erp/sync/run`
- Versioned alias: `POST /api/v1/integrations/erp/outbox/run`

Optional query:

- `limit`: max number of eligible events to process during this pass

Example:

- `POST /api/integrations/erp/outbox/run?limit=20`

## Worker Claim Behavior

- The worker selects rows with persisted status `pending` or `failed` whose `nextRunAt` is empty or due.
- `retryable_failed` remains an API-facing label derived from persisted `failed` plus attempt count; do not store `retryable_failed` in the database.
- Before sending, each selected row is claimed by updating its status to `processing`. If the claim update affects zero rows, the worker skips that row because another pass already claimed it.
- Queue eligibility uses direct ISO timestamp comparison on `nextRunAt`; do not wrap the indexed column in SQLite-only datetime functions in worker queries.

## Operational Expectations

- Manual sync must not create duplicate business actions for the same idempotency key
- Dead-letter candidates must remain queryable until the underlying cause is understood
- Support/debugging should always reference `idempotencyKey`, `eventType`, `entityType`, `entityId`, `retryCount`, and `lastError`
- Any contract or retry-policy change must update both this runbook and `docs/api/erp-outbox-contract.md`
