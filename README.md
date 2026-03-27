# Huynh Thy CRM App

Huynh Thy CRM App is the official product repository for the CRM-to-ERP revenue workflow.

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

1. Create or update a short spec in `docs/`.
2. Break the work into one bounded task.
3. Implement only that task.
4. Run verification commands.
5. Update UAT checklist if user-facing behavior changed.

See:

- `docs/process/definition-of-ready.md`
- `docs/process/definition-of-done.md`
- `docs/ai/task-template.md`
