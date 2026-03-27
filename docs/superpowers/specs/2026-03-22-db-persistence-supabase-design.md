# DB Persistence and Supabase Readiness Design

Date: 2026-03-22
Project: crm-app (backend)
Owner: Codex + User

## Summary
Stabilize SQLite persistence by moving DB path to an environment variable and removing destructive init behavior. Add optional seeding controlled by an env flag. Prepare a thin adapter boundary so a future switch to Supabase/Postgres can be done with minimal route changes.

## Goals
- Persist SQLite data across restarts.
- Make DB location configurable via ENV.
- Make seed data optional and explicit.
- Reduce friction for later Supabase/Postgres migration.

## Non-Goals (Now)
- Full migration to Supabase/Postgres.
- ORM adoption or large refactors.
- Data migration automation to cloud.

## Current Issues
- initDb() drops tables on every startup, destroying data.
- sqlite filename is relative; starting server from a different working directory can create a new DB file.

## Proposed Design
### 1) Configuration
- Add `DB_PATH` env var to specify SQLite file location.
- Fallback to existing `crm.db` in backend when `DB_PATH` is not set.
- Add `SEED_DB` env var to control seeding (`true` / `false`).

### 2) Initialization
- Remove all `DROP TABLE` statements.
- Keep `CREATE TABLE IF NOT EXISTS` for idempotent schema creation.
- Seed data only when `SEED_DB=true`.

### 3) Adapter Boundary
- Keep the existing `initDb()` / `getDb()` API.
- The rest of the app continues to import from a single module.
- Future: replace sqlite implementation with a Postgres client (Supabase) behind the same API surface.

## Error Handling
- If `DB_PATH` points to a missing directory: log a clear error and stop startup.
- If `SEED_DB=true` and seed fails: log detailed error; keep server running to allow diagnosis.

## Testing Plan (Manual)
1. Start server with `DB_PATH` set to an existing file.
2. Create a record, restart server, verify data persists.
3. Start server without `SEED_DB` and confirm no new seed data is inserted.
4. Start with `SEED_DB=true` and verify seed data is inserted once.

## Migration Readiness (Future)
- Create SQL schema in Supabase.
- Export SQLite tables to CSV/JSON.
- Import into Supabase.
- Replace sqlite adapter with Postgres client (pg/Prisma) while preserving route behavior.

## Rollout
- Implement changes in backend only.
- Update environment docs for `DB_PATH` and `SEED_DB`.
