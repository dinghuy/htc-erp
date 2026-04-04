# ADR-0004: Keep SQLite Local, Remove Bootstrap Side Effects, Prepare For PostgreSQL

## Status

Accepted

## Context

`backend/sqlite-db.ts` still owns schema creation, upgrade behavior, and local bootstrap. This is acceptable for the current phase only if runtime startup stays deterministic and does not depend on pre-created directories or implicit seed behavior.

## Decision

- SQLite remains the local/test persistence engine during the stabilization phase.
- DB initialization must create its own storage directory when needed instead of depending on external setup.
- Smoke checks (`smoke:db-init`, `smoke:migration`) are required blocking gates.
- Startup must continue moving toward separation of schema/init, migration verification, seed fixtures, and repository access.
- New repository and contract work must avoid introducing SQLite-only API assumptions so PostgreSQL remains the target persistence direction.

## Consequences

- Local and CI bootstrap become predictable.
- PostgreSQL migration can proceed incrementally instead of as a one-pass rewrite.
- `backend/sqlite-db.ts` remains a compatibility facade, but bootstrap/finalize/runtime/seed responsibilities now live under `backend/src/persistence/sqlite/*`.
- The remaining persistence debt is concentrated in repository coverage and PostgreSQL target mapping, not in startup side effects.
