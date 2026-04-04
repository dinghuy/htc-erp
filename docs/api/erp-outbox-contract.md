# ERP Outbox Contract

## Purpose

Provide a stable event envelope between CRM workflows and ERP synchronization.

## Required Fields

- `eventType`
- `aggregateType`
- `aggregateId`
- `payloadVersion`
- `idempotencyKey`
- `status`
- `retryCount`
- `sentAt`
- `lastError`

## Status Model

- `pending`: queued and eligible to run
- `sending`: actively being delivered to ERP
- `sent`: delivered successfully
- `retryable_failed`: failed but still eligible for retry
- `dead_letter`: permanently failed after retry exhaustion

Legacy storage values such as `failed` and `processing` are mapped into the API-facing status model by `backend/src/modules/erp/outboxContract.ts`.

## Behavioral Rules

- Each business side effect must create at most one active outbox event per idempotency key.
- ERP delivery failures must update retry metadata instead of dropping the event.
- Final failure handling must preserve the last known error for audit and support investigation.
- Downstream ERP sync must be retryable without creating duplicate business actions.
- Retry exhaustion is evaluated against the backend max-attempts rule in `backend/src/modules/erp/outboxContract.ts`.

## Route Ownership

- `GET /api/integrations/erp/outbox` -> `backend/src/modules/erp/routes.ts`
- `POST /api/integrations/erp/outbox/run` -> `backend/src/modules/erp/routes.ts`
- Repository reads and stats -> `backend/src/modules/erp/repository.ts`
- Sync orchestration -> `backend/src/modules/erp/service.ts`
