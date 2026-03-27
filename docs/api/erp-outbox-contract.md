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

## Behavioral Rules

- Each business side effect must create at most one active outbox event per idempotency key.
- ERP delivery failures must update retry metadata instead of dropping the event.
- Final failure handling must preserve the last known error for audit and support investigation.
- Downstream ERP sync must be retryable without creating duplicate business actions.
