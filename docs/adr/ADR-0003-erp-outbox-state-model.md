# ADR-0003: Normalize ERP Outbox To A Versioned API State Model

## Status

Accepted

## Context

Legacy outbox storage mixed operational concerns into a small set of raw statuses such as `failed` and `processing`. That made retry vs. terminal failure ambiguous at the API boundary.

## Decision

- The API-facing ERP outbox contract uses the statuses `pending`, `sending`, `sent`, `retryable_failed`, and `dead_letter`.
- `backend/src/modules/erp/outboxContract.ts` maps persisted legacy values into this normalized state model.
- The ERP outbox envelope must expose `eventType`, `aggregateType`, `aggregateId`, `payloadVersion`, `idempotencyKey`, `status`, `retryCount`, `sentAt`, and `lastError`.
- ERP read and sync routes are owned by `backend/src/modules/erp/routes.ts`, with repository/service separation under the same module.

## Consequences

- UI and support tooling can distinguish retryable failures from dead letters without storage-specific logic.
- The backend can evolve storage internals later without changing the external contract.
- Any future broker or PostgreSQL implementation must preserve this API model.
