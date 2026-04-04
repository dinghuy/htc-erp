# DB Persistence + Supabase Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SQLite persistence stable via ENV config and seed gating, while keeping a clear path to Supabase migration.

**Architecture:** Keep a single DB module (`sqlite-db.ts`) that exposes `initDb()`/`getDb()`; update it to use `DB_PATH` and `SEED_DB`. This preserves the current API surface so a future swap to Postgres can happen behind the same adapter.

**Tech Stack:** Node.js, TypeScript, sqlite/sqlite3, dotenv

---

## File Structure / Ownership
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\sqlite-db.ts`
  - Add DB path resolution (env + fallback)
  - Remove DROP TABLE behavior
  - Seed only when `SEED_DB=true`
  - Optional: add helper to validate DB path
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\.env`
  - Add `DB_PATH` and `SEED_DB` documentation comments
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\db-init-smoke.js`
  - Minimal smoke test to validate persistence + seed gating

---

### Task 1: Add DB_PATH / SEED_DB support in sqlite adapter

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\sqlite-db.ts`

- [ ] **Step 1: Write a failing smoke test (no code changes yet)**

```js
// scripts/db-init-smoke.js (initial version, expected to fail until code changes)
process.env.DB_PATH = 'C:/Users/dinghuy/OneDrive - HUYNH THY GROUP/Antigravity Workspace/htc-erp/backend/tmp/test-crm.db';
process.env.SEED_DB = 'false';

const { initDb, getDb } = require('../sqlite-db');

(async () => {
  await initDb();
  const db = getDb();
  await db.run("INSERT INTO Account (id, companyName) VALUES ('test-1','Test Co')");

  // Re-init: should NOT drop tables or lose data
  await initDb();
  const row = await getDb().get("SELECT COUNT(*) as c FROM Account WHERE id='test-1'");

  if (!row || row.c !== 1) {
    throw new Error('Persistence check failed: row missing after re-init');
  }

  console.log('OK');
})();
```

- [ ] **Step 2: Run test to verify it fails with current code**

Run: `node C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\db-init-smoke.js`
Expected: FAIL due to dropped tables or missing persistence.

- [ ] **Step 3: Implement DB_PATH/SEED_DB changes**

```ts
// sqlite-db.ts (target behavior outline)
import path from 'path';
import fs from 'fs';

const envPath = process.env.DB_PATH?.trim();
const dbPath = envPath ? path.resolve(envPath) : path.join(__dirname, 'crm.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  throw new Error(`DB_PATH directory does not exist: ${dbDir}`);
}

// open({ filename: dbPath, ... })
// Remove DROP TABLEs
// Only seed when process.env.SEED_DB === 'true'
```

- [ ] **Step 4: Run smoke test to verify it passes**

Run: `node C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\db-init-smoke.js`
Expected: PASS with `OK`.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\sqlite-db.ts C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\db-init-smoke.js
git commit -m "feat: persist sqlite via DB_PATH and seed gating"
```

---

### Task 2: Document env vars for operators

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\.env`

- [ ] **Step 1: Write failing test (manual doc check)**

Checklist:
- `DB_PATH` is documented
- `SEED_DB` is documented

Expected: FAIL until `.env` updated.

- [ ] **Step 2: Update env file**

```env
# DB_PATH=C:/absolute/path/to/crm.db
# SEED_DB=true
```

- [ ] **Step 3: Verify doc update**

Expected: PASS when both vars are visible and commented.

- [ ] **Step 4: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\.env
git commit -m "docs: add DB_PATH and SEED_DB env hints"
```

---

### Task 3: Optional future-proofing for Supabase

**Files:**
- None now (documentation-only note)

- [ ] **Step 1: Record future migration checklist in issue tracker**

Checklist:
- Define Supabase schema (Postgres)
- Export SQLite data (CSV/JSON)
- Import into Supabase
- Swap adapter to pg/Prisma while keeping route interface

Expected: N/A

---

## Notes / Constraints
- This workspace is not a git repository; commits may not be possible. If `git` is unavailable, skip commit steps and report back.
- The smoke test uses a hardcoded temp path; ensure the temp directory exists or create it in the test.


