<!-- Parent: ../AGENTS.md -->
# backend

Parent `AGENTS.md` guidance applies unless this file narrows it for `backend`.

## Scope Notes

- Keep this file stable and directory-specific; do not add generated file inventories or temp/runtime artifacts here.
- Prefer the project-local backend/API flow for route, contract, auth, persistence, or integration changes.
- Keep controllers thin, business rules in dedicated service/use-case layers, and persistence concerns in repositories or data-access modules.
- Validate all external input at the boundary before it reaches domain logic.
- Contract or state-transition changes require verification evidence and doc/tracker updates.
