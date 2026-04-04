# HTC ERP

HTC ERP is the official product repository for the Huynh Thy CRM-to-ERP revenue workflow.

## Product Focus

- Phase 1 scope: `Lead -> Account/Contact -> Quotation -> Approval -> Project handoff -> Task -> ERP outbox`
- Architecture direction: modular monolith on the current stack
- Frontend: Preact + Vite + TypeScript
- Backend: Express + TypeScript
- Local database: SQLite for development and smoke testing
- Target production database: PostgreSQL

## Repository Rules

- Work only from short written specs and bounded implementation tasks.
- Every code change must include verification evidence.
- Large cross-module rewrites are not allowed in one change.
- Generated runtime artifacts must stay out of Git.

## Repository Layout

- `frontend/`: UI application
- `backend/`: API, domain logic, persistence, ERP integration
- `docs/index.md`: source-of-truth entrypoint for active docs and plans
- `docs/product/`: product scope and business goals
- `docs/architecture/`: engineering architecture and module boundaries
- `docs/adr/`: architecture decisions
- `docs/api/`: API catalog and interface contracts
- `docs/process/`: delivery rules, DoR, DoD, release gates
- `docs/qa/`: UAT and verification checklists
- `docs/ai/`: AI delivery templates and task framing
- `docs/domain/`: canonical business entities and enums

## Local Development

### Backend

```powershell
cd backend
npm install
npm run dev
npm run build
npm run verify:media-runtime
npm test
```

### Frontend

```powershell
cd frontend
npm install
npm test
npx tsc -b
```

## Delivery Workflow

1. Start from `docs/index.md` and identify the active canonical docs for the task.
2. Create or update a short spec in `docs/`.
3. Break the work into one bounded task.
4. Implement only that task.
5. Run verification commands.
6. Update UAT checklist if user-facing behavior changed.

## OMX Workflow Skills

Use the project-local OMX skill surface under `.codex/skills/` to route delivery work with less rediscovery:

- `app-delivery-orchestrator`: default entrypoint when work spans Linear, Notion, Figma, or Playwright
- `frontend-change-flow`: frontend verification mapping for UI, route, selector, and UX-audit-sensitive changes
- `backend-api-change-flow`: backend verification mapping for route, contract, auth, and runtime changes
- `release-regression-verification`: cross-surface handoff and regression reporting

Use plain Codex for small bounded edits. Reserve heavier OMX flows such as `$team` for work that cleanly splits into frontend, backend, and verification lanes.

If a needed global skill under `%USERPROFILE%\.codex\skills\` is not accessible in the current sandbox mode, mirror it locally first:

```powershell
pwsh -NoLogo -NoProfile -File scripts/mirror-global-skills.ps1 -Skill coding-standards
```

Mirrored skills are stored in `tmp/skills-global/` as a local cache and remain out of Git.

See:

- `docs/index.md`
- `docs/process/definition-of-ready.md`
- `docs/process/definition-of-done.md`
- `docs/ai/task-template.md`

## Tracking

- Use Linear as the execution tracker for active workstreams.
- Use Notion as the plan and evidence tracker.
- When material issues or workstreams are identified, update Linear and Notion first, then execute against the tracked items.
