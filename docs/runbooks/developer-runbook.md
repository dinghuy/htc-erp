# Developer Runbook

## Setup

1. Install dependencies in `backend/` and `frontend/`.
2. Copy `.env.example` to `.env` where needed.
3. Run backend tests.
4. Run frontend tests and typecheck.

## Before Editing

1. Read the relevant spec and task template.
2. Identify the owning module.
3. Confirm the verification commands for that module.
4. For UI work, read `docs/runbooks/ui-theme-principles.md` before changing colors, surfaces, or overlays.

## Before Merging

1. Run all required verification commands.
2. Update docs or UAT checklist if behavior changed.
3. Confirm no runtime artifacts were added to Git.
