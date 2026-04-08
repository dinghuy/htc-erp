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

## Response Metadata

The outbox read payload also exposes:

- `query.status`: normalized status filter after alias mapping
- `query.limit`: effective server-side limit used for the read
- `policy.maxAttempts`: retry exhaustion threshold
- `policy.payloadVersion`: current envelope version
- `policy.statuses`: supported API-facing status set
- `policy.statusFilterAliases`: accepted query aliases such as `dead-letter -> dead_letter`
- `policy.retrySchedule`: current exponential backoff policy (`30s` base delay, `3600s` cap)

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
- Retry delay uses exponential backoff from `30s` up to a `60m` cap in `backend/erp-sync.ts`.

## Route Ownership

- `GET /api/integrations/erp/outbox` -> `backend/src/modules/erp/routes.ts`
- `POST /api/integrations/erp/outbox/run` -> `backend/src/modules/erp/routes.ts`
- Repository reads and stats -> `backend/src/modules/erp/repository.ts`
- Sync orchestration -> `backend/src/modules/erp/service.ts`

## Query Contract

- `status` supports `pending`, `sending`, `sent`, `retryable_failed`, `dead_letter`
- `status=dead-letter` is accepted as a query alias and normalized to `dead_letter`
- `limit` defaults to `50` and is capped server-side

## Operator Reference

- Runbook: `docs/runbooks/erp-outbox-operations.md`
