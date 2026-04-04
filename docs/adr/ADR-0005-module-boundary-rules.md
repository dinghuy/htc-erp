# ADR-0005: Enforce Thin Route Handlers And Module-Owned Workflow Logic

## Status

Accepted

## Context

Core revenue workflow logic had been split between route handlers, app bootstrap wiring, and large helper sections, especially around projects, approvals, and ERP synchronization.

## Decision

- Route handlers may authenticate, authorize, parse, validate, and map responses.
- Business workflow rules belong in module services or repositories, not inline route bodies.
- Shared technical concerns should converge on `shared/contracts`, `shared/errors`, `shared/security`, `shared/audit`, and `shared/notifications`.
- Quotations remains the reference bounded module shape. Projects, tasks, and ERP should continue converging on `routes`, `service`, `repository`, `schemas`, `validators`, and `mappers` where applicable.
- `/api/v1/*` aliases may remain temporarily, but ownership must be documented until each namespace is fully extracted from `backend/src/app.ts`.

## Consequences

- Modules become easier to test and refactor without app-wide regressions.
- Shared behavior becomes reusable without requiring a platform split.
- Large files such as `backend/src/app.ts` and `backend/sqlite-db.ts` remain known refactor targets, not implicit design defaults.
