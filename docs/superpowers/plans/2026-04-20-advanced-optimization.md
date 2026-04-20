# HTC ERP Advanced Optimization Implementation Plan

## Status Check - 2026-04-20

- Implementation surface for Tasks 1-8 is present in codebase and re-verified in this workspace.
- Additional cleanup completed during verification:
  - aligned `frontend/src/quotations/quotationProductReadiness.test.ts` with the normalized `offerGroupKey` shape
  - moved frontend production build output to `frontend/build/` via `frontend/vite.config.ts` to avoid the blocked legacy `dist/` path in this workspace
  - fixed QA seed quotation IDs in `backend/src/modules/platform/qaSeed.ts` so seeded `QuotationLineItem` rows point to real quotation primary keys
  - updated backend regression expectations around admin persona preview-header behavior and QA seed user count
- Verification completed:
  - `corepack pnpm --dir backend typecheck`
  - `corepack pnpm --dir backend smoke:db-init`
  - `corepack pnpm --dir backend smoke:migration`
  - `corepack pnpm --dir backend test:core`
  - `corepack pnpm --dir frontend sync:contracts`
  - `corepack pnpm --dir frontend typecheck`
  - `corepack pnpm --dir frontend test:ux:contracts`
  - `corepack pnpm --dir frontend test:core`
  - `corepack pnpm --dir frontend build`
- Remaining environment blocker:
  - `git status` is still blocked here by Git `safe.directory` / dubious ownership on `D:/htc-erp`, so repo-cleanliness verification could not be completed from Git in this session.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve HTC ERP reliability, frontend load performance, database worker throughput, and UX regression runtime without breaking the modular-monolith boundaries.

**Architecture:** Execute reliability-first: idempotent write paths and safer outbox claiming before frontend and CI speed work. All touched API calls must converge toward `/api/v1/*`, backend-owned contracts, and module-owned service/repository boundaries; legacy `/api/*` paths may remain as compatibility surfaces only. Do not introduce new dependencies, external brokers, or SQLite-only repository shortcuts.

**Tech Stack:** Node.js, Express, TypeScript, SQLite via existing bootstrap/finalize flow, Preact/compat, Vite, custom Playwright UX audit runner, GitHub Actions.

---

## Repo Facts To Preserve

- The technology brief describes the target architecture discipline. It is not all current-state reality; where current code is transitional, this plan must improve convergence rather than normalize the transitional state.
- Frontend uses `preact/compat`, not React directly. Use `lazy`/`Suspense` from `preact/compat`.
- Route screens under `frontend/src/features/*Route.tsx` already lazy-load many heavy legacy screens.
- Approval mutations do not currently live in `backend/src/modules/approvals/routes.ts`; they live in `backend/src/modules/projects/governanceRoutes.ts` and are exposed through API v1 aliases.
- Current `backend/src/modules/platform/apiV1Aliases.ts` already maps `/api/v1/projects/*` to `/api/projects/*`, `/api/v1/approvals/*` to `/api/approval-requests/*`, and `/api/v1/sales-orders/*` to `/api/sales-orders/*`. Do not add duplicate alias entries unless regression tests prove an actual gap.
- SQLite schema/index evolution currently happens through `backend/src/persistence/sqlite/bootstrap.ts` and `backend/src/persistence/sqlite/finalize.ts`; there is no `backend/src/persistence/sqlite/migrations/` directory.
- ERP outbox retryable rows are stored as `status = 'failed'`; `retryable_failed` is an API label, not the persisted status.
- UX regression must run with real seeded QA accounts. Do not add new preview/impersonation coverage. Any existing preview wording in manifests/scripts is legacy debt to remove or quarantine.
- `.github/workflows/` exists but currently has no committed workflow file.
- Use `corepack pnpm --dir <package> ...` when `pnpm` is not globally available.

## Architectural Challenge Response

- **Frontend:** The plan keeps the UI thin and token-led. `PageLoader` is allowed because it is a shared UI primitive backed by `tokens.ts` and `styles.ts`, not feature-local styling.
- **Backend:** The first implementation target is still the current files, but acceptance tests must call canonical `/api/v1/*` routes. Legacy routes are implementation compatibility, not the public contract.
- **Database:** Do not create an ad hoc migrations folder just because the brief says "incremental scripts". The current ADR-approved path is bootstrap/finalize plus smoke checks. If a real migration runner is introduced, that is a separate architecture task with docs/index and ADR updates.
- **QA:** Sharding is invalid until the runner can execute selected real-persona journeys through seeded login. Sharding preview flows would only make the wrong behavior faster.
- **DevOps:** CI must isolate DB path and ports per shard. Shared QA seed against one DB is a correctness bug, not an optimization.

## Documentation Sync Gate

Every implementation task must update docs in the same commit when behavior, public route surface, persistence shape, QA workflow, or CI workflow changes.

- API route or request-header behavior changes: update `docs/api/api-catalog.md`; update `docs/api/erp-outbox-contract.md` only if ERP outbox payload/status semantics change.
- Database table/index/query-shape changes: update `docs/architecture/database-doctrine.md` only when doctrine changes; otherwise update the relevant runbook or add verification notes in this plan/task. Do not create new active docs unless repeated operational use is expected.
- UI token/shared component changes: update `docs/runbooks/ui-theme-principles.md` only if a new reusable token/pattern rule is introduced. Pure reuse of existing tokens does not require a docs change.
- UX regression runner, seed, persona, or CI sharding changes: update `docs/qa/ux-regression-core.md` and `docs/qa/ux-regression-codex-runbook.md`.
- Dev workflow or command changes: update `docs/runbooks/developer-runbook.md` if the command is intended for routine developer use.
- If docs are intentionally not updated for a touched area, the commit must state why in `Not-tested:` or `Directive:` under the Lore Commit Protocol.

## File Structure

- Create `frontend/src/ui/PageLoader.tsx`: token-based reusable Suspense fallback.
- Modify `frontend/src/features/shared/FeatureRouteShell.tsx`: use `PageLoader` instead of inline fallback.
- Modify `frontend/src/qa/sidebarLayoutWidthContract.test.ts`: assert route shells use `PageLoader`.
- Conditional modify: `docs/runbooks/ui-theme-principles.md` if `PageLoader` establishes a new shared loading pattern beyond existing token usage.
- Modify `frontend/src/core/session.ts`: central mutation idempotency header injection fallback.
- Modify `frontend/src/shared/api/client.ts`: expose action-level idempotency helpers and keep request handling consistent.
- Modify `frontend/src/Approvals.tsx`: generate stable idempotency keys at approval action boundary.
- Modify `frontend/src/projects/projectWorkspaceAsyncActions.ts`: generate stable idempotency keys for approval/workflow actions.
- Modify `frontend/src/Quotations.tsx`: generate stable idempotency keys for quotation save and approval request actions.
- Modify touched frontend mutation URLs to use canonical `/api/v1/*` paths where aliases already exist.
- Modify `docs/api/api-catalog.md`: document idempotency header requirement and any new API v1 aliases touched by the implementation.
- Create `backend/src/shared/idempotency/idempotencyRepository.ts`: persistence operations for `IdempotencyLog`.
- Create `backend/src/shared/idempotency/requireIdempotency.ts`: middleware wrapper for idempotent mutation handlers.
- Modify `backend/src/persistence/sqlite/bootstrap.ts`: create `IdempotencyLog` and worker indexes for fresh DBs.
- Modify `backend/src/persistence/sqlite/finalize.ts`: ensure `IdempotencyLog` and indexes for existing DBs.
- Modify `backend/src/modules/quotations/routes/mutationRoutes.ts`: apply idempotency to quotation create/update/revise.
- Modify `backend/src/modules/projects/governanceRoutes.ts`: apply idempotency to approval create and approval decision.
- Modify `backend/tests/api-v1-alias.test.js`: lock nested approval and sales-order alias behavior before frontend callers move to `/api/v1/*`.
- Modify `backend/erp-sync.ts`: make outbox claim/query index-friendly and race-safer.
- Modify `backend/tests/db-init.test.js`: assert new table/indexes exist and query plan uses the new worker index.
- Create `backend/tests/idempotency-api.test.js`: lock duplicate write behavior.
- Modify `backend/package.json`: include the new test in `test:core` after route/security tests.
- Modify `docs/runbooks/erp-outbox-operations.md`: document worker claim/index behavior if operator-facing inspection or retry guidance changes.
- Modify `frontend/scripts/qa/run-ux-audit.mjs`: accept shard journey filters.
- Modify `frontend/scripts/qa/run-ux-audit.ps1`: pass shard filters into Node runner.
- Modify `frontend/scripts/qa/ux-regression.manifest.mjs`: remove preview/impersonation language for journeys touched by sharding and anchor them to seeded QA login.
- Modify `backend/src/modules/platform/qaSeed.ts` only if a manifest persona lacks a real seeded account, for example a sales+PM combined persona.
- Create `.github/workflows/ux-regression.yml`: run 4 isolated UX shards and merge artifacts.
- Modify `docs/qa/ux-regression-core.md` and `docs/qa/ux-regression-codex-runbook.md`: document shard filtering, seeded personas, and artifact expectations.

---

## Task 1: Standardize Route Loader Without Changing Route Ownership

**Files:**
- Create: `frontend/src/ui/PageLoader.tsx`
- Modify: `frontend/src/features/shared/FeatureRouteShell.tsx`
- Modify: `frontend/src/qa/sidebarLayoutWidthContract.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add assertions to `frontend/src/qa/sidebarLayoutWidthContract.test.ts`:

```ts
it('uses the shared PageLoader for feature route suspense fallbacks', () => {
  const shell = readFrontendFile('features/shared/FeatureRouteShell.tsx');
  expect(shell).toContain("import { PageLoader } from '../../ui/PageLoader';");
  expect(shell).toContain('<PageLoader message={fallbackMessage} />');
});
```

- [ ] **Step 2: Run the targeted frontend test**

Run:

```powershell
corepack pnpm --dir frontend exec vitest run src/qa/sidebarLayoutWidthContract.test.ts
```

Expected: FAIL because `PageLoader` does not exist and `FeatureRouteShell` still uses inline fallback markup.

- [ ] **Step 3: Create the shared loader**

Create `frontend/src/ui/PageLoader.tsx`:

```tsx
import { tokens } from './tokens';
import { ui } from './styles';
import { LoaderIcon } from './icons';

export function PageLoader({ message = 'Đang tải module...' }: { message?: string }) {
  return (
    <div
      style={{
        ...ui.card.base,
        minHeight: '180px',
        display: 'grid',
        placeItems: 'center',
        padding: tokens.spacing.xl,
        background: tokens.surface.panelGradient,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          color: tokens.colors.textSecondary,
          fontSize: '14px',
          fontWeight: 700,
        }}
      >
        <LoaderIcon size={16} />
        {message}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace inline fallback**

In `frontend/src/features/shared/FeatureRouteShell.tsx`, import `PageLoader` and replace the Suspense fallback with:

```tsx
fallback={<PageLoader message={fallbackMessage} />}
```

Do not add hardcoded hex or rgba values.

- [ ] **Step 5: Verify**

Run:

```powershell
corepack pnpm --dir frontend exec vitest run src/qa/sidebarLayoutWidthContract.test.ts
corepack pnpm --dir frontend typecheck
corepack pnpm --dir frontend build
```

Expected: all PASS. Inspect build output manually and confirm heavy `Projects`/workspace chunks are separate from the initial app shell.

- [ ] **Step 6: Update docs if the loader becomes a shared UI rule**

If `PageLoader` becomes the recommended fallback for future route loaders, update `docs/runbooks/ui-theme-principles.md` under Shell And Page Grammar. If this is only internal reuse of existing tokens, record "Docs not updated: reused existing token/pattern rules" in the commit body.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/ui/PageLoader.tsx frontend/src/features/shared/FeatureRouteShell.tsx frontend/src/qa/sidebarLayoutWidthContract.test.ts docs/runbooks/ui-theme-principles.md
git commit -m "Improve feature-route loading feedback"
```

Commit body must follow the Lore Commit Protocol in `AGENTS.md`.

---

## Task 2: Add Idempotency Schema And Repository

**Files:**
- Create: `backend/src/shared/idempotency/idempotencyRepository.ts`
- Modify: `backend/src/persistence/sqlite/bootstrap.ts`
- Modify: `backend/src/persistence/sqlite/finalize.ts`
- Modify: `backend/tests/db-init.test.js`

- [ ] **Step 1: Write failing DB initialization assertions**

In `backend/tests/db-init.test.js`, add a test that verifies:

```js
const idempotencyTable = await db.get(
  `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'IdempotencyLog'`
);
assert.equal(Boolean(idempotencyTable), true);

const idempotencyIndexes = await db.all(`PRAGMA index_list('IdempotencyLog')`);
const idempotencyIndexNames = idempotencyIndexes.map((row) => row.name);
assert.equal(idempotencyIndexNames.includes('idx_idempotency_scope_key'), true);
assert.equal(idempotencyIndexNames.includes('idx_idempotency_expires_at'), true);
```

- [ ] **Step 2: Run failing backend DB test**

Run:

```powershell
corepack pnpm --dir backend exec node -r ./tests/bootstrap-test-env.js tests/db-init.test.js
```

Expected: FAIL because `IdempotencyLog` does not exist.

- [ ] **Step 3: Add fresh DB schema**

In `backend/src/persistence/sqlite/bootstrap.ts`, create:

```sql
CREATE TABLE IF NOT EXISTS IdempotencyLog (
  id TEXT PRIMARY KEY,
  idempotencyKey TEXT NOT NULL,
  method TEXT NOT NULL,
  routeKey TEXT NOT NULL,
  actorUserId TEXT,
  requestHash TEXT NOT NULL,
  status TEXT NOT NULL,
  responseStatus INTEGER,
  responseBody TEXT,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_scope_key
  ON IdempotencyLog (method, routeKey, actorUserId, idempotencyKey);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
  ON IdempotencyLog (expiresAt);
```

- [ ] **Step 4: Add existing DB finalization**

In `backend/src/persistence/sqlite/finalize.ts`, add `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements equivalent to bootstrap. Keep this in the same schema-finalization style as existing table/index ensure blocks.

Do not create `backend/src/persistence/sqlite/migrations/` in this task. The migration evidence for this repo is `smoke:migration`; introducing a real migration-file runner requires a separate architecture decision and docs update.

- [ ] **Step 5: Create repository**

Create `backend/src/shared/idempotency/idempotencyRepository.ts` with operations:

```ts
export type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export type IdempotencyRecord = {
  id: string;
  idempotencyKey: string;
  method: string;
  routeKey: string;
  actorUserId: string | null;
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: string | null;
  expiresAt: string;
};
```

Expose functions:

```ts
claimKey(input): Promise<{ claimed: true; record: IdempotencyRecord } | { claimed: false; record: IdempotencyRecord }>
markCompleted(input): Promise<void>
markFailed(input): Promise<void>
deleteExpired(nowIso: string): Promise<void>
```

Use `INSERT OR IGNORE` for SQLite claim semantics. Do not use `ROWID`.
Keep the SQL limited to constructs with a clear PostgreSQL equivalent. If a SQLite-specific conflict primitive is used inside the SQLite repository, isolate it behind the repository function and do not leak it into services/routes.

- [ ] **Step 6: Update persistence docs if behavior changes**

If the implementation introduces a new persistence rule beyond "table/index exists for idempotency storage", update `docs/architecture/database-doctrine.md`. If not, keep doctrine unchanged and rely on `backend/tests/db-init.test.js`, `smoke:db-init`, and `smoke:migration` as evidence.

- [ ] **Step 7: Verify**

Run:

```powershell
corepack pnpm --dir backend typecheck
corepack pnpm --dir backend exec node -r ./tests/bootstrap-test-env.js tests/db-init.test.js
corepack pnpm --dir backend smoke:db-init
corepack pnpm --dir backend smoke:migration
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```powershell
git add backend/src/shared/idempotency/idempotencyRepository.ts backend/src/persistence/sqlite/bootstrap.ts backend/src/persistence/sqlite/finalize.ts backend/tests/db-init.test.js docs/architecture/database-doctrine.md
git commit -m "Prepare inbound idempotency storage"
```

---

## Task 3: Implement Backend `requireIdempotency`

**Files:**
- Create: `backend/src/shared/idempotency/requireIdempotency.ts`
- Create: `backend/tests/idempotency-api.test.js`
- Modify: `backend/package.json`

- [ ] **Step 1: Write failing middleware-level API test**

Create `backend/tests/idempotency-api.test.js` that:

1. Boots a test DB/app using existing test bootstrap pattern.
2. Logs in as a QA/admin user.
3. Sends a quotation create request to `/api/v1/quotations` with `X-Idempotency-Key: fixed-key-1`.
4. Sends the same request with the same key.
5. Asserts both responses are successful and have the same payload ID.
6. Asserts only one matching `Quotation` row exists.
7. Sends same key with a different body.
8. Asserts `409` and code/message for key reuse.

Use the same request helper pattern as existing `backend/tests/*-api.test.js` files.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
corepack pnpm --dir backend exec node -r ./tests/bootstrap-test-env.js tests/idempotency-api.test.js
```

Expected: FAIL because middleware is missing.

- [ ] **Step 3: Implement middleware wrapper**

Create `backend/src/shared/idempotency/requireIdempotency.ts`:

```ts
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { createIdempotencyRepository } from './idempotencyRepository';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
```

Export a wrapper:

```ts
export function withRequiredIdempotency(
  routeKey: string,
  handler: (req: Request, res: Response) => Promise<unknown>,
) {
  return async (req: Request, res: Response) => {
    // Require header for POST/PUT/PATCH.
    // Claim key before handler.
    // Replay completed response if same requestHash.
    // Return 409 for in_progress or key/body mismatch.
    // Capture status/body by wrapping res.status and res.json.
  };
}
```

Keep route handlers thin: this is shared technical concern, not business workflow logic.

- [ ] **Step 4: Add test script coverage**

In `backend/package.json`, add `tests/idempotency-api.test.js` to `test:core` near other API tests.

- [ ] **Step 5: Update API docs**

In `docs/api/api-catalog.md`, document that selected mutating endpoints require `X-Idempotency-Key`, replay completed duplicate requests, and reject mismatched same-key payloads with `409`.

- [ ] **Step 6: Verify**

Run:

```powershell
corepack pnpm --dir backend typecheck
corepack pnpm --dir backend exec node -r ./tests/bootstrap-test-env.js tests/idempotency-api.test.js
```

Expected: middleware test PASS after route integration in Task 4. If Task 4 has not started yet, only typecheck should be required here.

- [ ] **Step 7: Commit**

```powershell
git add backend/src/shared/idempotency/requireIdempotency.ts backend/tests/idempotency-api.test.js backend/package.json docs/api/api-catalog.md
git commit -m "Add inbound idempotency middleware"
```

---

## Task 4: Apply Idempotency To Quotation And Approval Write Paths

**Files:**
- Modify: `backend/src/modules/quotations/routes/mutationRoutes.ts`
- Modify: `backend/src/modules/projects/governanceRoutes.ts`
- Modify: `backend/tests/api-v1-alias.test.js`
- Modify: `backend/tests/idempotency-api.test.js`
- Conditional modify: `backend/src/modules/platform/apiV1Aliases.ts`

- [ ] **Step 1: Extend failing test for approval decision**

In `backend/tests/idempotency-api.test.js`, add a case:

1. Create or seed one pending `ApprovalRequest`.
2. POST `/api/v1/approvals/:id/decision` twice rapidly with same `X-Idempotency-Key`.
3. Assert both responses resolve to the same decided approval.
4. Assert only one relevant outbox event exists for the decision side effect.

- [ ] **Step 2: Run targeted test**

Run:

```powershell
corepack pnpm --dir backend exec node -r ./tests/bootstrap-test-env.js tests/idempotency-api.test.js
```

Expected: FAIL until route wrappers are applied.

- [ ] **Step 3: Wrap quotation mutations**

In `backend/src/modules/quotations/routes/mutationRoutes.ts`, wrap these handlers:

- `POST /api/projects/:id/quotations`
- `POST /api/quotations`
- `PUT /api/quotations/:id`
- `POST /api/quotations/:id/revise`

Use stable route keys:

```ts
'quotations:create-project'
'quotations:create-standalone'
'quotations:update'
'quotations:revise'
```

Do not wrap `DELETE` in this phase unless a test explicitly covers safe replay semantics.

Tests must exercise `/api/v1/quotations` and `/api/v1/projects/:id/quotations` even if the implementation handler remains registered on legacy `/api/*`.

- [ ] **Step 4: Wrap approval mutations**

In `backend/src/modules/projects/governanceRoutes.ts`, wrap:

- `POST /api/projects/:id/approval-requests` with `projects:approval-request:create`
- `POST /api/approval-requests/:id/decision` with `approval-requests:decision`

Do not move these routes to a new approvals module in this optimization slice.

Tests must exercise `/api/v1/projects/:id/approval-requests` and `/api/v1/approvals/:id/decision`. If an alias does not currently map one of these paths, update `backend/src/modules/platform/apiV1Aliases.ts` in this task rather than forcing frontend callers back to legacy routes.

- [ ] **Step 5: Update API catalog for touched API v1 routes**

Update `docs/api/api-catalog.md` with any newly added aliases or true module-owned `/api/v1/*` mutation paths. Keep legacy `/api/*` described only as compatibility.

- [ ] **Step 6: Add or extend API v1 alias regression tests**

In `backend/tests/api-v1-alias.test.js`, add coverage for:

- `POST /api/v1/projects/:id/approval-requests` reaches the current project governance handler and preserves auth/role enforcement.
- `POST /api/v1/approvals/:id/decision` reaches the current approval decision handler and preserves auth/capability enforcement.
- `/api/v1/sales-orders` remains covered by the existing alias test; only add new coverage if a mutation path used by frontend is not already tested.

Do not edit `backend/src/modules/platform/apiV1Aliases.ts` unless this test proves the existing prefix aliases are insufficient.

- [ ] **Step 7: Verify**

Run:

```powershell
corepack pnpm --dir backend typecheck
corepack pnpm --dir backend exec node -r ./tests/bootstrap-test-env.js tests/idempotency-api.test.js
corepack pnpm --dir backend test:core
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```powershell
git add backend/src/modules/quotations/routes/mutationRoutes.ts backend/src/modules/projects/governanceRoutes.ts backend/tests/api-v1-alias.test.js backend/tests/idempotency-api.test.js docs/api/api-catalog.md
# Also add backend/src/modules/platform/apiV1Aliases.ts only if alias tests prove the existing prefix mapping is insufficient.
git commit -m "Prevent duplicate quotation and approval writes"
```

---

## Task 5: Generate Stable Frontend Idempotency Keys At Action Boundaries

**Files:**
- Modify: `frontend/src/core/session.ts`
- Modify: `frontend/src/shared/api/client.ts`
- Modify: `frontend/src/Approvals.tsx`
- Modify: `frontend/src/projects/projectWorkspaceAsyncActions.ts`
- Modify: `frontend/src/Quotations.tsx`
- Test: `frontend/src/projects/projectWorkspaceAsyncActions.test.ts`

- [ ] **Step 1: Write failing frontend API/key tests**

Add tests that assert:

- `fetchWithSessionAuth` attaches `X-Idempotency-Key` for mutating methods when caller does not supply one.
- Existing caller-supplied `X-Idempotency-Key` is preserved.
- `projectWorkspaceAsyncActions` passes an idempotency key for approval creation and workflow actions.

- [ ] **Step 2: Run failing tests**

Run:

```powershell
corepack pnpm --dir frontend exec vitest run src/projects/projectWorkspaceAsyncActions.test.ts
```

Expected: FAIL until key helpers exist.

- [ ] **Step 3: Add helper API**

In `frontend/src/shared/api/client.ts`, add:

```ts
export function createIdempotencyKey(scope: string) {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}:${randomId}`;
}

export function withIdempotencyKey(options: RequestInit = {}, key = createIdempotencyKey('mutation')): RequestInit {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      'X-Idempotency-Key': key,
    },
  };
}
```

- [ ] **Step 4: Add fetch fallback**

In `frontend/src/core/session.ts`, for `POST`, `PUT`, and `PATCH`, attach a fallback idempotency key if missing. Do not attach for `GET` or `DELETE`.

- [ ] **Step 5: Add action-boundary keys**

Use `withIdempotencyKey` in:

- `Approvals.tsx` approval `decide`
- `projectWorkspaceAsyncActions.ts` approval creation, sales order creation/release, delivery completion, thread creation/message writes
- `Quotations.tsx` quotation create/update and commercial approval request

For single user actions, create the key before the request and reuse it for retry inside that action. Do not regenerate a new key for the same retry attempt.

For every touched mutation URL, prefer canonical `/api/v1/*` paths:

- `Approvals.tsx`: `${API}/v1/approvals/${approvalId}/decision`
- `projectWorkspaceAsyncActions.ts`: `${API}/v1/projects/${projectId}/approval-requests`, `${API}/v1/sales-orders/...`, `${API}/v1/threads...`
- `Quotations.tsx`: `${API}/v1/quotations`, `${API}/v1/quotations/${id}`, `${API}/v1/projects/${projectId}/approval-requests`

If a canonical alias is missing, add the alias in `backend/src/modules/platform/apiV1Aliases.ts` and cover it in backend API tests. Do not introduce duplicate frontend DTOs.

- [ ] **Step 6: Update API docs if frontend route usage changed**

If this task added or depends on new `/api/v1/*` aliases, ensure `docs/api/api-catalog.md` lists them. Do not update frontend contracts manually; if DTOs/enums changed, update `backend/src/shared/contracts/domain.ts` and run sync in the verification step.

- [ ] **Step 7: Verify**

Run:

```powershell
corepack pnpm --dir frontend typecheck
corepack pnpm --dir frontend test:core
corepack pnpm --dir frontend build
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/core/session.ts frontend/src/shared/api/client.ts frontend/src/Approvals.tsx frontend/src/projects/projectWorkspaceAsyncActions.ts frontend/src/Quotations.tsx frontend/src/projects/projectWorkspaceAsyncActions.test.ts docs/api/api-catalog.md
git commit -m "Attach stable idempotency keys to frontend mutations"
```

---

## Task 6: Optimize ERP Outbox Worker Query And Claiming

**Files:**
- Modify: `backend/erp-sync.ts`
- Modify: `backend/src/persistence/sqlite/bootstrap.ts`
- Modify: `backend/src/persistence/sqlite/finalize.ts`
- Modify: `backend/tests/db-init.test.js`

- [ ] **Step 1: Add failing query-plan test**

In `backend/tests/db-init.test.js`, add:

```js
const outboxIndexes = await db.all(`PRAGMA index_list('ErpOutbox')`);
const outboxIndexNames = outboxIndexes.map((row) => row.name);
assert.equal(outboxIndexNames.includes('idx_erpoutbox_worker_due'), true);

const plan = await db.all(
  `EXPLAIN QUERY PLAN
   SELECT *
   FROM ErpOutbox
   WHERE status IN ('pending', 'failed')
     AND (nextRunAt IS NULL OR nextRunAt <= ?)
   ORDER BY createdAt ASC, id ASC
   LIMIT ?`,
  [new Date().toISOString(), 20]
);
assert.equal(plan.some((row) => String(row.detail || '').includes('idx_erpoutbox_worker_due')), true);
```

- [ ] **Step 2: Run failing DB test**

Run:

```powershell
corepack pnpm --dir backend exec node -r ./tests/bootstrap-test-env.js tests/db-init.test.js
```

Expected: FAIL because worker index/query shape is not present.

- [ ] **Step 3: Add worker index**

Add this to bootstrap and finalize:

```sql
CREATE INDEX IF NOT EXISTS idx_erpoutbox_worker_due
  ON ErpOutbox (status, nextRunAt, createdAt, id);
```

If `EXPLAIN` proves this still sorts with a temp B-tree, keep the index for selection but document that sort elimination is not guaranteed with `status IN (...)`.
Do not store `retryable_failed` in the database. That remains an API label mapped from persisted `failed` plus attempt count.

- [ ] **Step 4: Make query index-friendly**

In `backend/erp-sync.ts`, replace:

```sql
AND (nextRunAt IS NULL OR datetime(nextRunAt) <= datetime('now'))
```

with:

```sql
AND (nextRunAt IS NULL OR nextRunAt <= ?)
```

Pass `new Date().toISOString()` as the first query parameter before `limit`.
This keeps SQLite local behavior portable toward PostgreSQL-style timestamp comparison and avoids wrapping the indexed column in a SQLite datetime function.

- [ ] **Step 5: Make claim race-safer**

After:

```sql
UPDATE ErpOutbox
SET status = 'processing', updatedAt = datetime('now')
WHERE id = ? AND status IN ('pending', 'failed')
```

inspect `changes`. If zero, skip processing that row because another worker already claimed it.

- [ ] **Step 6: Update outbox runbook if operator behavior changes**

If the worker claim/query change affects how operators inspect pending, failed, retryable, or dead-letter rows, update `docs/runbooks/erp-outbox-operations.md`. If this is purely internal query optimization, record "Docs not updated: no operator-facing behavior change" in the commit body.

- [ ] **Step 7: Verify**

Run:

```powershell
corepack pnpm --dir backend typecheck
corepack pnpm --dir backend exec node -r ./tests/bootstrap-test-env.js tests/db-init.test.js
corepack pnpm --dir backend test:core
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```powershell
git add backend/erp-sync.ts backend/src/persistence/sqlite/bootstrap.ts backend/src/persistence/sqlite/finalize.ts backend/tests/db-init.test.js docs/runbooks/erp-outbox-operations.md
git commit -m "Make ERP outbox worker claims index-friendly"
```

---

## Task 7: Convert UX Audit Sharding To Real Seeded Personas

**Files:**
- Modify: `frontend/scripts/qa/run-ux-audit.mjs`
- Modify: `frontend/scripts/qa/run-ux-audit.ps1`
- Modify: `frontend/scripts/qa/ux-regression.manifest.mjs`
- Modify: `frontend/src/qa/uxRegressionExecution.test.ts`
- Conditional modify: `backend/src/modules/platform/qaSeed.ts`

- [ ] **Step 1: Add failing contract test**

In `frontend/src/qa/uxRegressionExecution.test.ts`, assert:

- the runner source supports `QA_JOURNEY_IDS`
- the runner source supports `QA_PERSONAS`
- the manifest no longer describes selected shard journeys as "Preview ..." flows
- filtered runs do not require all journeys for every run

- [ ] **Step 2: Run failing contract test**

Run:

```powershell
corepack pnpm --dir frontend exec vitest run src/qa/uxRegressionExecution.test.ts
```

Expected: FAIL until runner supports journey filters and the manifest is de-previewed.

- [ ] **Step 3: De-preview the shard manifest language**

In `frontend/scripts/qa/ux-regression.manifest.mjs`, rewrite preconditions/notes for sharded journeys to use real seeded login language. Examples:

- replace `Preview Sales` with `Login as qa_sales`
- replace `Preview Legal` with `Login as qa_legal`
- replace `Back to Admin` as an escape action with a real navigation/logout escape action

Do not remove the historical regression anchor unless a replacement real-account journey covers the same trap. If a legacy admin-preview journey must remain, exclude it from CI sharding and mark it as legacy compatibility.

If the manifest still needs a combined sales + project-manager journey, add a real seeded user in `backend/src/modules/platform/qaSeed.ts` instead of emulating role switching in the browser. Suggested seed key: `salesProjectManager`, username `qa_sales_pm`, role codes `['sales', 'project_manager']`.

- [ ] **Step 4: Add manifest filtering**

In `frontend/scripts/qa/run-ux-audit.mjs`, add:

```js
function parseCsvEnv(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectJourneys(manifest) {
  const journeyIds = new Set(parseCsvEnv('QA_JOURNEY_IDS'));
  const personas = new Set(parseCsvEnv('QA_PERSONAS'));
  if (!journeyIds.size && !personas.size) return manifest;
  return manifest.filter((journey) => {
    return journeyIds.has(journey.id) || personas.has(journey.persona);
  });
}
```

Use `selectJourneys(UX_REGRESSION_MANIFEST)` for journey execution and report summaries.

- [ ] **Step 5: Ensure selected journeys login with seeded accounts**

When running a selected journey, resolve credentials from the QA seed contract instead of using runtime preview/impersonation. The runner must fail if a requested persona has no seeded account. The filter should accept manifest persona IDs and map them to seed contract keys explicitly, for example `project_manager -> projectManager`.

- [ ] **Step 6: Convert sharded runner functions away from preview controls**

In `frontend/scripts/qa/run-ux-audit.mjs`, add a real-account journey helper instead of using `selectPreviewPreset` for sharded personas:

```js
async function loginAsSeededPersona(page, contract, personaKey, frontendUrl) {
  const persona = contract.personas?.[personaKey];
  if (!persona?.username || !persona?.password) {
    throw new Error(`Missing seeded QA persona: ${personaKey}`);
  }
  await page.goto(frontendUrl);
  await page.fill(selectors.login.username, persona.username);
  await page.fill(selectors.login.password, persona.password);
  await page.click(selectors.login.submit);
}
```

Keep any historical admin-preview regression out of the CI shard selection until it has a seeded-account equivalent.

- [ ] **Step 7: Keep smoke route behavior explicit**

Add `QA_INCLUDE_SMOKE=1` default for the final shard only in CI. Locally, default can remain current full smoke behavior unless filtered run explicitly disables it.

- [ ] **Step 8: Update PowerShell wrapper**

In `frontend/scripts/qa/run-ux-audit.ps1`, pass optional environment values through without hardcoding personas.

- [ ] **Step 9: Update UX regression docs**

Update:

- `docs/qa/ux-regression-core.md` with shard filter environment variables, seeded account mapping, and the rule that new CI journeys use real QA accounts.
- `docs/qa/ux-regression-codex-runbook.md` with local commands for `QA_PERSONAS` and `QA_JOURNEY_IDS`.

- [ ] **Step 10: Verify**

Run:

```powershell
corepack pnpm --dir frontend typecheck
corepack pnpm --dir frontend test:ux:contracts
```

If local app is running, also run:

```powershell
$env:QA_PERSONAS='accounting,legal'
corepack pnpm --dir frontend test:ux:audit
Remove-Item Env:QA_PERSONAS
```

Expected: only accounting/legal journeys run.

- [ ] **Step 11: Commit**

```powershell
git add frontend/scripts/qa/run-ux-audit.mjs frontend/scripts/qa/run-ux-audit.ps1 frontend/scripts/qa/ux-regression.manifest.mjs frontend/src/qa/uxRegressionExecution.test.ts docs/qa/ux-regression-core.md docs/qa/ux-regression-codex-runbook.md
# Also add backend/src/modules/platform/qaSeed.ts if this task added a missing seeded persona.
git commit -m "Shard UX audit by seeded persona"
```

---

## Task 8: Add GitHub Actions UX Regression Shards

**Files:**
- Create: `.github/workflows/ux-regression.yml`

- [ ] **Step 1: Create workflow**

Create `.github/workflows/ux-regression.yml` with:

```yaml
name: UX Regression

on:
  pull_request:
    paths:
      - 'frontend/**'
      - 'backend/**'
      - '.github/workflows/ux-regression.yml'
  workflow_dispatch:

jobs:
  ux-shard:
    name: UX shard ${{ matrix.name }}
    runs-on: windows-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - name: sales-pm
            personas: sales,project_manager
            backend_port: 3101
            frontend_port: 4273
            include_smoke: '0'
          - name: combined-procurement
            personas: sales_pm_combined,procurement
            backend_port: 3102
            frontend_port: 4274
            include_smoke: '0'
          - name: finance-legal
            personas: accounting,legal
            backend_port: 3103
            frontend_port: 4275
            include_smoke: '0'
          - name: director-smoke
            personas: director
            backend_port: 3104
            frontend_port: 4276
            include_smoke: '1'

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: corepack enable
      - run: corepack pnpm install --frozen-lockfile
      - name: Build backend and frontend
        run: |
          corepack pnpm --dir backend typecheck
          corepack pnpm --dir frontend typecheck
      - name: Run UX shard
        shell: pwsh
        env:
          DB_PATH: ${{ runner.temp }}\htc-erp-${{ matrix.name }}.db
          PORT: ${{ matrix.backend_port }}
          FRONTEND_PORT: ${{ matrix.frontend_port }}
          QA_BACKEND_URL: http://127.0.0.1:${{ matrix.backend_port }}
          QA_FRONTEND_URL: http://127.0.0.1:${{ matrix.frontend_port }}
          VITE_API_URL: http://127.0.0.1:${{ matrix.backend_port }}/api
          QA_PERSONAS: ${{ matrix.personas }}
          QA_INCLUDE_SMOKE: ${{ matrix.include_smoke }}
        run: |
          Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "corepack pnpm --dir backend dev" -NoNewWindow
          Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "corepack pnpm --dir frontend exec vite --configLoader native --host 127.0.0.1 --port $env:FRONTEND_PORT --strictPort" -NoNewWindow
          Start-Sleep -Seconds 12
          corepack pnpm --dir frontend test:ux:audit
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: ux-audit-${{ matrix.name }}
          path: frontend/artifacts/ux-audit/**

  merge-reports:
    name: Merge UX reports
    runs-on: windows-latest
    needs: ux-shard
    if: always()
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: ux-artifacts
      - name: List reports
        shell: pwsh
        run: Get-ChildItem -Recurse ux-artifacts
```

This intentionally bypasses `frontend`'s fixed-port `dev:qa` script so each shard can use an isolated frontend port.

Do not include any legacy preview/impersonation journey in this CI matrix. If an admin-preview regression still exists for historical coverage, keep it local/non-blocking until it is rewritten as a real seeded-account journey.

- [ ] **Step 2: Update QA docs for CI sharding**

Update `docs/qa/ux-regression-core.md` with the CI shard groups, artifact naming convention, and the rule that each shard uses an isolated `DB_PATH`, backend port, and frontend port.

- [ ] **Step 3: Validate workflow YAML locally**

Run:

```powershell
Get-Content .github/workflows/ux-regression.yml
```

Expected: valid YAML, no tabs, no malformed matrix values.

- [ ] **Step 4: Verify package checks**

Run:

```powershell
corepack pnpm --dir frontend test:ux:contracts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add .github/workflows/ux-regression.yml docs/qa/ux-regression-core.md
git commit -m "Shard UX regression in CI"
```

---

## Task 9: Full Verification And Handoff

**Files:**
- Review all touched files.
- No new runtime artifacts should be staged.

- [ ] **Step 1: Run backend verification**

```powershell
corepack pnpm --dir backend typecheck
corepack pnpm --dir backend smoke:db-init
corepack pnpm --dir backend smoke:migration
corepack pnpm --dir backend test:core
```

Expected: all PASS.

- [ ] **Step 2: Run frontend verification**

```powershell
corepack pnpm --dir frontend sync:contracts
corepack pnpm --dir frontend typecheck
corepack pnpm --dir frontend test:core
corepack pnpm --dir frontend test:ux:contracts
corepack pnpm --dir frontend build
```

Expected: all PASS.

- [ ] **Step 3: Run optional local UX shard smoke**

Only if local stack can start:

```powershell
.\khoi-chay.bat
$env:QA_PERSONAS='accounting,legal'
corepack pnpm --dir frontend test:ux:audit
Remove-Item Env:QA_PERSONAS
```

Expected: selected journeys PASS and artifacts appear under `frontend/artifacts/ux-audit/`.

- [ ] **Step 4: Check generated artifacts**

Run:

```powershell
git status --short
```

Expected: no generated `build/`, `artifacts/`, database, log, cache, or temp outputs staged.

- [ ] **Step 5: Final commit or PR**

Use Lore Commit Protocol for final commit message if committing combined cleanup. Prefer separate commits from each task above.

---

## Execution Notes

- If Git reports dubious ownership for `D:/htc-erp`, do not silently change global Git config during implementation. Ask the user or run in an already trusted worktree.
- If idempotency wrapper capture of `res.json` becomes brittle, use an explicit helper function for idempotent handlers instead of deep monkey-patching Express response internals.
- If frontend direct `fetch` calls bypass `fetchWithSessionAuth`, do not broaden idempotency to unauthenticated/public routes in this phase. Convert only authenticated mutation calls that touch quotation, approval, project workflow, sales order, threads, or document review state.
- Do not add new frontend mutation calls to legacy `/api/*` paths. Touched calls must move toward `/api/v1/*`; if compatibility is missing, add an alias or true module route on the backend.
- Do not use runtime role preview or UI impersonation in new QA automation. Use seeded users from `POST /api/qa/reset-ux-seed` / `GET /api/qa/ux-seed-contract`.
- If CI workflow startup is unstable, split CI sharding into two PRs: runner filter first, workflow second.
- Do not add Redis, external queues, new routing libraries, or bundle analyzer dependencies unless explicitly approved.
