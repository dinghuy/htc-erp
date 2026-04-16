# HTC ERP

HTC ERP is Huynh Thy Group's sales and operations workflow system. The repository contains a modular-monolith application for managing the revenue flow from lead capture to ERP handoff with auditable workflow states.

Current Phase 1 focus:

- Lead management
- Account and contact master data
- Quotation lifecycle
- Approval workflow for pricing and commercial decisions
- Project handoff after a winning quotation
- Task orchestration across departments
- ERP outbox and delivery monitoring

The product goal is to let sales, managers, and operations run the core revenue flow without Excel-only side channels while keeping ERP sync observable, retryable, and auditable.

## Stack

- Frontend: Preact + Vite + TypeScript
- Backend: Express + TypeScript
- Local development database: SQLite
- Target UAT/production database: PostgreSQL

## Repository

- `frontend/`: UI application
- `backend/`: API, domain logic, persistence, ERP integration
- `docs/`: active product, architecture, process, and QA documentation
- `docs/index.md`: entrypoint for canonical repo docs

## Getting Started

Read `docs/index.md` first if you need product or architecture context before editing code.

### Backend

```powershell
cd backend
npm install
copy .env.example .env
npm run dev
```

Useful backend commands:

```powershell
npm test
npm run typecheck
npm run build
npm run verify:media-runtime
```

One-click local startup from repo root:

```powershell
.\khoi-chay.bat
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Useful frontend commands:

```powershell
npm test
npm run typecheck
npm run build
```

## Verification And Docs

Useful repo docs:

- `docs/index.md`
- `docs/runbooks/environment-strategy.md`
- `docs/process/definition-of-done.md`
- `docs/qa/release-checklist.md`

## Notes

- Local development is allowed to use SQLite for speed
- Environment-specific values must come from environment variables
- Secrets must never be committed
- Generated outputs, logs, caches, and machine-local artifacts must stay out of Git
