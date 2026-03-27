# Exchange Rate + QBU Warning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VCB exchange rate storage, QBU snapshotting, daily refresh, and warnings (rate >= 2.5% or QBU older than 6 months) across Products/QBU, Sales (if exists), and Quotations.

**Architecture:** Persist daily VCB rates in a dedicated SQLite table, snapshot the latest rate into Product QBU on save, schedule a daily VN-timezone refresh on the backend, and compute warnings on the client using a single latest-rate fetch plus product snapshot fields. Backend exposes rate endpoints and stores snapshots; frontend renders warnings wherever products are surfaced.

**Tech Stack:** Node.js (Express), SQLite, Preact frontend.

---

## File Structure / Touch Map
**Backend**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\sqlite-db.ts`
  - Add `ExchangeRate` table + index
  - Add Product columns (`qbuRateSource`, `qbuRateDate`, `qbuRateValue`)
  - Add safe migration logic for existing DB
  - Add SystemSetting default `vcb_rate_url`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\server.ts`
  - Add exchange-rate endpoints + warnings
  - Fetch/save VCB rates (transfer selling rate)
  - Daily scheduler (VN timezone)
  - On product QBU save, snapshot latest rate into Product + qbuData
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-db-migration.js`
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-api-exchange-rate.js`
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-warning-logic.js`

**Frontend**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Products.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`
- Optional/Conditional: Sales screen if it exists

**Notes**
- Repo is not a git repository; commit steps below are conditional (skip if `git status` fails).

---

### Task 1: Add ExchangeRate table + Product snapshot columns + settings default

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\sqlite-db.ts`
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-db-migration.js`

- [ ] **Step 1: Write failing DB migration test**

```js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'crm.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  const table = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='ExchangeRate'");
  if (!table) throw new Error('Missing ExchangeRate table');

  const cols = await db.all("PRAGMA table_info('Product')");
  const names = cols.map(c => c.name);
  ['qbuRateSource','qbuRateDate','qbuRateValue'].forEach(n => {
    if (!names.includes(n)) throw new Error('Missing column: ' + n);
  });

  const settings = await db.all('SELECT key FROM SystemSetting');
  const hasVcb = settings.some(s => s.key === 'vcb_rate_url');
  if (!hasVcb) throw new Error('Missing SystemSetting: vcb_rate_url');

  console.log('OK');
})();
```

- [ ] **Step 2: Run test to verify it fails (before migration)**

Run: `node C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-db-migration.js`
Expected: FAIL with missing table/columns/setting.

- [ ] **Step 3: Implement migration in sqlite-db.ts**

Add helper to:
- Create `ExchangeRate` table + index `(baseCurrency, quoteCurrency, effectiveDate)`
- Add Product columns if missing
- Insert default SystemSetting `vcb_rate_url` if missing

- [ ] **Step 4: Re-run test**

Run: `node C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-db-migration.js`
Expected: PASS with `OK`.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\sqlite-db.ts C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-db-migration.js
git commit -m "feat: add exchange rate schema and settings"
```

---

### Task 2: Add exchange rate fetch + endpoints + warning payloads

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\server.ts`
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-api-exchange-rate.js`

- [ ] **Step 1: Write failing API test**

```js
const http = require('http');

const req = http.get('http://localhost:3001/api/exchange-rates/latest?pair=USDVND', res => {
  let data=''; res.on('data', c => data+=c); res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!('rate' in json) || !('effectiveDate' in json)) throw new Error('Invalid latest rate response');
      if (json.warnings && !Array.isArray(json.warnings)) throw new Error('warnings must be array');
      console.log('OK');
    } catch (e) {
      console.error(e.message); process.exit(1);
    }
  });
});
req.on('error', e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run server, then:
`node C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-api-exchange-rate.js`
Expected: FAIL (endpoint missing).

- [ ] **Step 3: Implement endpoints**

Add:
- `GET /api/exchange-rates/latest?pair=USDVND`
  - Parse pair -> base/quote
  - Query latest by effectiveDate desc, createdAt desc
  - If missing: return `{ rate: null, effectiveDate: null, source: 'VCB', warnings: ['RATE_MISSING'] }`
- `POST /api/exchange-rates/refresh`
  - Read VCB URL from SystemSetting `vcb_rate_url`
  - Fetch VCB payload
  - Parse USD/VND **transfer selling rate**
  - If missing: return 200 + `{ warnings: ['RATE_TYPE_MISSING'], lastKnownRateDate }`
  - If fetch fails: return 502 + `{ error, lastKnownRateDate }`
  - Insert into ExchangeRate and return latest with `warnings?: []`

Define warning strings used by API:
- `RATE_MISSING`
- `RATE_TYPE_MISSING`

- [ ] **Step 4: Add no-rate test**

Restart server with empty DB:
- Set `DB_PATH` to a new file path and start server.
- Call `GET /api/exchange-rates/latest?pair=USDVND` and assert `warnings` contains `RATE_MISSING`.

- [ ] **Step 5: Add rate-type-missing test**

Set `vcb_rate_url` to a mock payload that lacks transfer selling rate (use a local static JSON file served by a quick `node -e` http server), then call refresh and assert `RATE_TYPE_MISSING` warning.

- [ ] **Step 6: Re-run test**

Run: `node C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-api-exchange-rate.js`
Expected: PASS when server running.

- [ ] **Step 7: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\server.ts C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-api-exchange-rate.js
git commit -m "feat: add exchange rate endpoints"
```

---

### Task 3: Add daily VN-timezone refresh scheduler

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\server.ts`

- [ ] **Step 1: Implement scheduler**

Add a helper:
```ts
const scheduleDailyVcbRefresh = () => {
  // Compute next 08:00 Asia/Ho_Chi_Minh and setTimeout -> setInterval every 24h
};
```
- On server start, call `scheduleDailyVcbRefresh()`.
- Log next run time in VN timezone.
- When triggered, call internal `refreshVcbRates()` (shared with endpoint) so logic is consistent.

- [ ] **Step 2: Manual verify**

Start server and verify schedule log.

- [ ] **Step 3: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\server.ts
git commit -m "feat: schedule daily VCB refresh"
```

---

### Task 4: Snapshot latest rate when saving QBU (source of truth + fallback)

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\server.ts`

- [ ] **Step 1: Integration test (manual)**

Flow:
- PUT product with qbuData
- GET product and assert:
  - `qbuRateSource/qbuRateDate/qbuRateValue` are set
  - `qbuData.rateSnapshot` exists (copy)

- [ ] **Step 2: Implement snapshot logic**

In `PUT /api/products/:id`:
- Fix current bug: query `qbuUpdatedAt` along with `qbuData`
- When qbuData changes:
  - Query latest USDVND rate
  - Write `qbuRateSource/qbuRateDate/qbuRateValue`
  - Update `qbuData.rateSnapshot` (copy)
  - Update `qbuUpdatedAt`

If no rate exists: leave snapshot fields null and add server log.

- [ ] **Step 3: Manual verify**

Repeat PUT/GET and confirm snapshot values.

- [ ] **Step 4: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\server.ts
git commit -m "feat: snapshot exchange rate on QBU save"
```

---

### Task 5: Warning logic unit tests (VN timezone + boundaries)

**Files:**
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-warning-logic.js`

- [ ] **Step 1: Write unit tests**

```js
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const getVnDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);

const hasRateIncreaseWarning = (latestRate, qbuRateValue) =>
  latestRate != null && qbuRateValue != null && latestRate >= qbuRateValue * 1.025;

const hasQbuStaleWarning = (qbuUpdatedAt) => {
  if (!qbuUpdatedAt) return false;
  const vnDateStr = getVnDate(new Date(qbuUpdatedAt));
  const vnDate = new Date(`${vnDateStr}T00:00:00+07:00`);
  const sixMonthsLater = new Date(vnDate);
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
  return new Date(`${getVnDate(new Date())}T00:00:00+07:00`) >= sixMonthsLater;
};

// rate threshold tests
assert(hasRateIncreaseWarning(102.5, 100) === true, 'rate warn threshold');
assert(hasRateIncreaseWarning(102.4, 100) === false, 'rate warn below threshold');

// 6-month boundary tests (calendar months)
const base = '2025-01-01T00:00:00+07:00';
const exactly6m = '2025-07-01T00:00:00+07:00';
assert(hasQbuStaleWarning(base) === (new Date(`${getVnDate(new Date())}T00:00:00+07:00`) >= new Date(exactly6m)), '6-month boundary');
```

- [ ] **Step 2: Run test**

Run: `node C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-warning-logic.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\backend\scripts\test-warning-logic.js
git commit -m "test: add warning logic checks"
```

---

### Task 6: Frontend warning logic (Products/QBU) with VN timezone

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Products.tsx`

- [ ] **Step 1: Add VN date helper + warning helpers**

- Use Product column snapshot as source of truth.
- Fallback to `qbuData.rateSnapshot.rate` only if column missing.

- [ ] **Step 2: Fetch latest rate once**

`/api/exchange-rates/latest?pair=USDVND` and store in state. Handle `RATE_MISSING` to show “Chưa có tỷ giá VCB”.

- [ ] **Step 3: Render warnings**

Messages:
- “Tỷ giá hiện tại tăng >= 2.5% so với lần nhập QBU gần nhất. Cần tính lại.”
- “QBU đã quá 6 tháng. Cần cập nhật lại.”
- “Snapshot missing” if snapshot fields empty

- [ ] **Step 4: Manual verify**

- Simulate missing rate: start server with empty DB, verify “Chưa có tỷ giá VCB”.
- Simulate missing snapshot: product with no qbuRateValue, verify “Snapshot missing”.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Products.tsx
git commit -m "feat: show QBU warnings in products"
```

---

### Task 7: Frontend warning logic (Quotations + Sales discovery)

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`
- Optional: Sales screen if exists

- [ ] **Step 1: Locate Sales screen**

Search for “Bán hàng” or “Sales” routes/components and list exact file paths. If none, document that warnings are implemented only in Products + Quotations.

- [ ] **Step 2: Add helpers + latest rate fetch**

Reuse helpers from Products (copy local if no shared util). Use same VN date logic and same message strings.

- [ ] **Step 3: Render warnings on product selection/line items**

Add badge near product name/line.

- [ ] **Step 4: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx
git commit -m "feat: show QBU warnings in quotations"
```

---

## Execution Notes
- Latest rate selection must follow spec: max effectiveDate (VN date), tie-breaker createdAt.
- API warnings array contains only defined strings (`RATE_MISSING`, `RATE_TYPE_MISSING`).
- UI uses Product column snapshot as source of truth, falls back to qbuData.rateSnapshot only if columns missing.
- If no rate exists, show “Chưa có tỷ giá VCB” and skip rate comparison.
