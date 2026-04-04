# Quotation Status + Remind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled quotation status transitions and a Remind badge for sent quotations older than 14 days, with read-only lock for terminal statuses.

**Architecture:** Add a small backend helper to validate transitions and compute Remind. Server endpoints compute `isRemind`, enforce transition rules, and return structured errors. Frontend renders badges and provides status actions in list/detail while enforcing read-only UI.

**Tech Stack:** Node.js/Express + SQLite (backend), Preact + Vite (frontend), TypeScript.

---

**File Map (ownership & responsibility)**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\server.ts`
  - Enforce status transitions, compute `isRemind`, add structured errors, log status changes.
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\quotation-status.ts`
  - Pure helpers for status validation and remind computation.
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\quotation-status.test.ts`
  - Lightweight tests for helper logic using `assert`.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx`
  - Status badges, Remind warning, status change actions, read-only UI lock.

---

### Task 1: Add Backend Helper for Status Validation + Remind

**Files:**
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\quotation-status.ts`

- [ ] **Step 1: Write failing tests**

Create `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\quotation-status.test.ts` with:

```ts
import assert from 'node:assert/strict';
import { computeIsRemind, validateUpdate, VALID_STATUSES } from '../quotation-status';

const now = Date.parse('2026-03-23T00:00:00.000Z');

// Remind logic
assert.equal(
  computeIsRemind('sent', '2026-03-09T00:00:00.000Z', now),
  true,
  'exactly 14 days should remind'
);
assert.equal(
  computeIsRemind('sent', '2026-03-10T00:00:01.000Z', now),
  false,
  'less than 14 days should not remind'
);
assert.equal(
  computeIsRemind('draft', '2026-03-01T00:00:00.000Z', now),
  false,
  'non-sent should not remind'
);
assert.equal(
  computeIsRemind('sent', 'invalid-date', now),
  false,
  'invalid createdAt should not remind'
);
assert.equal(
  computeIsRemind('sent', '2026-04-01T00:00:00.000Z', now),
  false,
  'future createdAt should not remind'
);

// Status validation
const ok1 = validateUpdate({ currentStatus: 'draft', nextStatus: 'sent' });
assert.equal(ok1.ok, true);

const bad1 = validateUpdate({ currentStatus: 'draft', nextStatus: 'accepted' });
assert.equal(bad1.ok, false);
assert.equal(bad1.code, 'INVALID_STATUS_TRANSITION');

const ok2 = validateUpdate({ currentStatus: 'sent', nextStatus: 'accepted' });
assert.equal(ok2.ok, true);

const ro1 = validateUpdate({ currentStatus: 'accepted', nextStatus: 'sent' });
assert.equal(ro1.ok, false);
assert.equal(ro1.code, 'READ_ONLY');

const legacy = validateUpdate({ currentStatus: 'archived', nextStatus: 'sent' });
assert.equal(legacy.ok, false);
assert.equal(legacy.code, 'READ_ONLY');

const conflict = validateUpdate({ currentStatus: 'sent', nextStatus: 'accepted', expectedStatus: 'draft' });
assert.equal(conflict.ok, false);
assert.equal(conflict.code, 'STATUS_CONFLICT');

const noStatus = validateUpdate({ currentStatus: 'sent', hasStatusField: false });
assert.equal(noStatus.ok, true);

console.log('quotation-status tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend
npx ts-node scripts\quotation-status.test.ts
```
Expected: FAIL because `quotation-status.ts` does not exist.

- [ ] **Step 3: Implement helper module**

Create `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\quotation-status.ts`:

```ts
export const VALID_STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const;
export type ValidStatus = typeof VALID_STATUSES[number];

export function isLegacyStatus(status?: string) {
  return !status || !VALID_STATUSES.includes(status as ValidStatus);
}

export function computeIsRemind(status: string, createdAt?: string, nowMs = Date.now()) {
  if (status !== 'sent') return false;
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return false;
  if (createdMs > nowMs) return false;
  const diffMs = nowMs - createdMs;
  return diffMs >= 14 * 24 * 60 * 60 * 1000;
}

type ValidateInput = {
  currentStatus?: string;
  nextStatus?: string;
  expectedStatus?: string;
  hasStatusField?: boolean;
};

type ValidateResult = {
  ok: boolean;
  code?: 'INVALID_STATUS_TRANSITION' | 'READ_ONLY' | 'STATUS_CONFLICT';
  allowed?: string[];
  currentStatus?: string;
};

export function validateUpdate({ currentStatus, nextStatus, expectedStatus, hasStatusField = true }: ValidateInput): ValidateResult {
  if (isLegacyStatus(currentStatus)) return { ok: false, code: 'READ_ONLY', allowed: [] };
  if (currentStatus === 'accepted' || currentStatus === 'rejected') return { ok: false, code: 'READ_ONLY', allowed: [] };
  if (expectedStatus && expectedStatus !== currentStatus) return { ok: false, code: 'STATUS_CONFLICT', currentStatus };

  if (!hasStatusField) return { ok: true };
  if (!nextStatus || !VALID_STATUSES.includes(nextStatus as ValidStatus)) {
    return { ok: false, code: 'INVALID_STATUS_TRANSITION', allowed: allowedTransitions(currentStatus) };
  }
  if (nextStatus === currentStatus) return { ok: true };

  const allowed = allowedTransitions(currentStatus);
  if (!allowed.includes(nextStatus)) return { ok: false, code: 'INVALID_STATUS_TRANSITION', allowed };
  return { ok: true };
}

export function allowedTransitions(currentStatus?: string) {
  if (currentStatus === 'draft') return ['sent'];
  if (currentStatus === 'sent') return ['accepted', 'rejected'];
  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend
npx ts-node scripts\quotation-status.test.ts
```
Expected: `quotation-status tests passed`.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\quotation-status.ts C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\quotation-status.test.ts
git commit -m "feat: add quotation status helper and tests"
```

---

### Task 2: Enforce Status Validation + Remind in API

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\server.ts`
- Test: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\quotation-status.test.ts`

- [ ] **Step 1: Write failing test**

Extend test file with API-level validation unit tests (pure helper only, still failing due to missing imports in server usage):

```ts
// Ensure allowed transitions list is consistent
import { allowedTransitions } from '../quotation-status';
assert.deepEqual(allowedTransitions('draft'), ['sent']);
assert.deepEqual(allowedTransitions('sent'), ['accepted', 'rejected']);
```

- [ ] **Step 2: Run test to verify it fails (if not yet exported)**

Run:
```bash
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend
npx ts-node scripts\quotation-status.test.ts
```
Expected: FAIL if `allowedTransitions` not exported.

- [ ] **Step 3: Implement server changes**

Update `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\server.ts`:

1) Import helper:
```ts
import { computeIsRemind, validateUpdate, allowedTransitions, VALID_STATUSES } from './quotation-status';
```

2) Add `isRemind` to `GET /api/quotations` and `GET /api/quotations/:id` responses:
```ts
const nowMs = Date.now();
res.json(rows.map(r => ({ ...r, isRemind: computeIsRemind(r.status, r.createdAt, nowMs) })));
```
For single record:
```ts
res.json({ ...row, isRemind: computeIsRemind(row.status, row.createdAt) });
```

3) In `POST /api/quotations`, validate status:
```ts
const status = req.body.status;
if (status && !VALID_STATUSES.includes(status)) {
  return res.status(400).json({ code: 'INVALID_STATUS_TRANSITION', message: 'Invalid status', allowed: VALID_STATUSES });
}
const finalStatus = status || 'draft';
```
Use `finalStatus` in insert.

4) In `PUT /api/quotations/:id`, before update:
- Fetch current status from DB.
- Compute validation:
```ts
const current = await db.get('SELECT status FROM Quotation WHERE id = ?', req.params.id);
if (!current) return res.status(404).json({ error: 'Not found' });
const hasStatusField = Object.prototype.hasOwnProperty.call(req.body, 'status');
const validation = validateUpdate({
  currentStatus: current.status,
  nextStatus: req.body.status,
  expectedStatus: req.body.expectedStatus,
  hasStatusField
});
if (!validation.ok) {
  const httpStatus = validation.code === 'STATUS_CONFLICT' ? 409 : 400;
  return res.status(httpStatus).json({
    code: validation.code,
    message: validation.code === 'STATUS_CONFLICT' ? 'Status conflict' : 'Invalid status transition',
    allowed: validation.allowed,
    currentStatus: validation.currentStatus
  });
}
```

5) Status change logging:
```ts
if (hasStatusField && req.body.status && req.body.status !== current.status) {
  await logAct('Cập nhật trạng thái báo giá', `${current.status} -> ${req.body.status}`, 'Quotation', '🔁', '#e0f2fe', '#0284c7', req.params.id, 'Quotation');
}
```

- [ ] **Step 4: Run tests**

Run:
```bash
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend
npx ts-node scripts\quotation-status.test.ts
```
Expected: `quotation-status tests passed`.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\server.ts C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\quotation-status.ts C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend\scripts\quotation-status.test.ts
git commit -m "feat: enforce quotation status transitions and remind flag"
```

---

### Task 3: Update Quotations List UI (Badge + Status Actions)

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx`

- [ ] **Step 1: Add helper constants and functions (no tests)**

Add near top of file:

```ts
const VALID_STATUSES = ['draft', 'sent', 'accepted', 'rejected'];
const isLegacyStatus = (status?: string) => !status || !VALID_STATUSES.includes(status);
const allowedTransitions = (status?: string) => {
  if (status === 'draft') return ['sent'];
  if (status === 'sent') return ['accepted', 'rejected'];
  return [];
};
```

- [ ] **Step 2: Add status action handler**

Add a handler to update status only:

```ts
const updateStatus = async (id: string, currentStatus: string, nextStatus: string) => {
  try {
    const res = await fetch(`${API}/quotations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, expectedStatus: currentStatus })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể cập nhật trạng thái');
    }
    showNotify('Cập nhật trạng thái thành công', 'success');
    await loadData();
  } catch (e: any) {
    showNotify(e.message || 'Không thể cập nhật trạng thái', 'error');
  }
};
```

- [ ] **Step 3: Render Remind badge and status selector in list**

In the status column, wrap badge + optional Remind:

```tsx
const remind = q.isRemind === true;
const legacy = isLegacyStatus(q.status);
const readOnly = legacy || q.status === 'accepted' || q.status === 'rejected';
```

Add a small action menu (simple select):

```tsx
{!readOnly && allowedTransitions(q.status).length > 0 && (
  <select
    style={S.select}
    onChange={(e:any) => {
      const next = e.target.value;
      if (next) updateStatus(q.id, q.status, next);
      e.target.value = '';
    }}
    defaultValue=""
  >
    <option value="" disabled>Đổi trạng thái</option>
    {allowedTransitions(q.status).map(s => (
      <option value={s}>{s.toUpperCase()}</option>
    ))}
  </select>
)}
```

Add `LEGACY` badge if legacy; add `Remind` badge if `isRemind`:

```tsx
<span>...status badge...</span>
{legacy && <span style={...}>LEGACY</span>}
{remind && <span style={...}>Remind</span>}
```

- [ ] **Step 4: Manual check**

Run frontend and visually confirm:
```bash
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend
npm run dev
```
Expected: table shows Remind badge where `isRemind=true`, select shows only valid transitions.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx
git commit -m "feat: add list status actions and remind badge"
```

---

### Task 4: Update Quotations Detail UI (Status Selector + Read-Only Lock)

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx`

- [ ] **Step 1: Track current status in detail view**

Add state:
```ts
const [quoteStatus, setQuoteStatus] = useState('draft');
```
Set when loading fullQ in `handleEditQuote`:
```ts
setQuoteStatus(fullQ.status || 'draft');
```
Set when creating new:
```ts
setQuoteStatus('draft');
```

- [ ] **Step 2: Apply read-only lock to inputs**

Define:
```ts
const isReadOnly = quoteStatus === 'accepted' || quoteStatus === 'rejected' || isLegacyStatus(quoteStatus);
```
Apply `disabled={isReadOnly}` to all form inputs/buttons except “Quay lại” and PDF download (if needed). For buttons that save, disable when `isReadOnly`.

- [ ] **Step 3: Add status selector + Remind warning**

Near action buttons, render:

```tsx
{isReadOnly && (
  <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Báo giá đã chốt, chỉ đọc.</div>
)}
{quoteStatus === 'sent' && currentEditingQuote?.isRemind && (
  <div style={{ fontSize: '12px', color: tokens.colors.warning }}>Reminder: báo giá đã gửi hơn 14 ngày.</div>
)}
<select
  disabled={isReadOnly}
  style={S.select}
  onChange={(e:any)=>{
    const next = e.target.value;
    if (!editingQuoteId) return;
    if (next) updateStatus(editingQuoteId, quoteStatus, next).then(()=>setQuoteStatus(next));
    e.target.value = '';
  }}
  defaultValue=""
>
  <option value="" disabled>Đổi trạng thái</option>
  {allowedTransitions(quoteStatus).map(s => (
    <option value={s}>{s.toUpperCase()}</option>
  ))}
</select>
```

Note: store `currentEditingQuote` or reuse `quotations` state to find `isRemind` by id.

- [ ] **Step 4: Manual check**

Open a sent quote and verify selector shows accepted/rejected, and fields are disabled when accepted/rejected.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx
git commit -m "feat: add detail status selector and read-only lock"
```

---

### Task 5: End-to-End Manual Verification

**Files:**
- N/A (manual)

- [ ] **Step 1: Start backend**

Run:
```bash
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\backend
npm run dev
```
Expected: server starts on `http://localhost:3001`.

- [ ] **Step 2: Start frontend**

Run:
```bash
cd C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend
npm run dev
```

- [ ] **Step 3: Verify status transitions**

Checklist:
- Draft -> Sent works in list and detail.
- Sent -> Accepted/Rejected works in list and detail.
- Accepted/Rejected becomes read-only.
- Legacy status shows `LEGACY` badge and disables actions.
- Remind badge appears for sent quotes older than 14 days.

- [ ] **Step 4: Commit (if any manual tweaks)**

```bash
git add -A
git commit -m "chore: manual verification adjustments"
```

---

Plan complete and saved to `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\docs\superpowers\plans\2026-03-23-quotation-status-remind-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

