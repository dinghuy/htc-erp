<!-- Parent: ../AGENTS.md -->
# frontend

Parent `AGENTS.md` guidance applies unless this file narrows it for `frontend`.

## Scope Notes

- Keep this file stable and directory-specific; do not add generated file inventories or temp/runtime artifacts here.
- Prefer the project-local frontend flow and verification path for substantial UI work.
- Keep UI composition, state orchestration, async handling, and presentational components separated.
- Reuse shared UI primitives and design tokens instead of per-feature reinvention.
- User-facing behavior changes should include relevant UAT or browser evidence.
