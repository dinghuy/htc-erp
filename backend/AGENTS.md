<!-- Parent: ../AGENTS.md -->
# backend

Parent `AGENTS.md` guidance applies unless this file narrows it for `backend`.

## Scope Notes

- Keep this file stable and directory-specific; do not add generated file inventories or temp/runtime artifacts here.
- Prefer the project-local backend/API flow for route, contract, auth, persistence, or integration changes.
- Keep controllers thin, business rules in dedicated service/use-case layers, and persistence concerns in repositories or data-access modules.
- Validate all external input at the boundary before it reaches domain logic.
- New and refactored endpoints should move toward true module-owned `/api/v1/*` registration. Check whether the surface you are touching is still alias-backed via `src/modules/platform/apiV1Aliases.ts` before changing ownership assumptions.
- Contract changes must preserve backend ownership of canonical DTOs/types in `src/shared/contracts/domain.ts`; when frontend consumers are affected, sync generated contracts before claiming completion.
- Contract or state-transition changes require verification evidence and doc/tracker updates.
