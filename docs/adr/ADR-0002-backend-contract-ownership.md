# ADR-0002: Backend Owns Shared Revenue Contracts

## Status

Accepted

## Context

The repo has no root shared package, and the frontend had started to drift from backend-owned enums, role rules, and ERP outbox semantics. This created duplicate status logic and made role-preview behavior fragile.

## Decision

- `backend/src/shared/contracts/domain.ts` is the source of truth for canonical domain entities, enums, role aliases, permission keys, pagination/filter types, API error DTOs, and ERP outbox DTOs.
- `scripts/sync-shared-contracts.mjs` generates `frontend/src/shared/domain/generatedContracts.ts`.
- Frontend code may bridge or re-export generated contracts, but it must not hand-maintain duplicate enum or permission literals for core revenue-flow contracts.

## Consequences

- Backend and frontend parity can be verified deterministically in CI.
- Contract changes now require an explicit sync step and generated file diff review.
- The current repo keeps its existing structure without introducing a new workspace package.
