<!-- Parent: ../AGENTS.md -->
# frontend

Parent `AGENTS.md` guidance applies unless this file narrows it for `frontend`.

## Scope Notes

- Keep this file stable and directory-specific; do not add generated file inventories or temp/runtime artifacts here.
- Prefer the project-local frontend flow and verification path for substantial UI work.
- Read `../DESIGN.md` and `../docs/runbooks/ui-theme-principles.md` before changing shell behavior, layout, typography, color, spacing, overlays, or shared visual grammar.
- Keep UI composition, state orchestration, async handling, and presentational components separated.
- Reuse shared UI primitives and design tokens instead of per-feature reinvention.
- The app shell is still in a hybrid migration state. Check whether a route is a `features/*` surface or a legacy screen mounted from `src/app.tsx` before refactoring ownership.
- Use `../frontend/build/` as the production verification output path; do not rely on `../frontend/dist/` in this workspace.
- If a UI change introduces or normalizes a reusable pattern, update `../DESIGN.md` and `../docs/runbooks/ui-theme-principles.md` in the same slice unless the user explicitly narrows scope.
- User-facing behavior changes should include relevant UAT or browser evidence.
