# Developer Runbook

## Setup

1. Install dependencies in `backend/` and `frontend/`.
2. Copy `.env.example` to `.env` where needed.
3. Run backend tests.
4. Run frontend tests and typecheck.

## Before Editing

1. Start from `docs/index.md` and read only the active canonical docs it routes to for the task.
2. Read the relevant spec and task template.
3. Identify the owning module.
4. Confirm the verification commands for that module.
5. For UI work, read `DESIGN.md` and `docs/runbooks/ui-theme-principles.md` before changing layout, typography, color, spacing, surfaces, or overlays.
6. For frontend production verification, use the default Vite build output at `frontend/build/`. Do not rely on `frontend/dist/` in this workspace because the legacy path may be backed by a OneDrive reparse point that blocks cleanup.

## Before Merging

1. Run all required verification commands.
2. Update docs or UAT checklist if behavior changed.
3. Confirm no runtime artifacts were added to Git.
