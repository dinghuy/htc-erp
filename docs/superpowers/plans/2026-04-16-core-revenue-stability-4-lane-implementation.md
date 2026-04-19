# Core Revenue Stability 4-Lane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the core revenue flow around quotation creation by hardening customer/account/contact readiness, product readiness, quotation create/save/submit behavior, and final end-to-end verification.

**Architecture:** Work is split into four bounded lanes. Customer and product lanes harden dependencies independently, quotation lane owns the integration glue and readiness gating, and a final verification lane proves the complete business path without opening a separate approvals/handoff refactor. Shared files are protected by lane boundaries so subagents do not collide.

**Tech Stack:** Express, TypeScript, SQLite test runtime, Preact, Vitest, Playwright-based UX audit scripts, Node test runners.

---

## File structure and ownership map

### Lane 1 — Customer readiness
- Modify: `backend/src/modules/crm/routes.ts`
- Modify: `backend/src/modules/crm/repository.ts`
- Modify: `frontend/src/Customers.tsx` (only if customer payload/readiness gaps block quote flow)
- Test: `backend/tests/tabular-import-api.test.js`
- Create: `backend/tests/crm-quotation-linkage-api.test.js`

Responsibility: validate account/contact linkage and give deterministic API behavior to the quotation flow.

### Lane 2 — Product readiness
- Modify: `backend/src/modules/products/routes.ts`
- Modify: `backend/src/modules/products/service.ts`
- Modify: `frontend/src/Products.tsx` (only if quote-required product fields/readiness are missing)
- Modify: `backend/tests/products-api.test.js`
- Create: `frontend/src/quotations/quotationProductReadiness.test.ts`

Responsibility: ensure quote flow receives stable, usable product catalog payloads.

### Lane 3 — Quotation stability
- Modify: `backend/src/modules/quotations/routes/mutationRoutes.ts`
- Modify: `backend/src/modules/quotations/service.ts`
- Modify: `frontend/src/Quotations.tsx`
- Modify: `frontend/src/quotations/QuotationEditor.tsx`
- Modify: `frontend/src/quotations/quotationShared.ts` (only if needed for extracted readiness helpers)
- Modify: `backend/tests/quotation-create-flow.test.js`
- Modify: `backend/tests/pricing-api.test.js`
- Create: `frontend/src/quotations/quotationReadiness.test.ts`

Responsibility: own the create/save/submit path, dependency validation, totals consistency, and UI readiness gating.

### Lane 4 — Final verification only
- Modify: `backend/package.json`
- Modify: `frontend/package.json` (only if required to expose missing targeted test lanes)
- Modify: `docs/qa/uat-checklist-core-revenue-flow.md` (only if verification evidence requires explicit step clarification)
- Verify: backend targeted suites, frontend targeted suites, and critical UAT/browser path

Responsibility: prove the full customer -> product -> quotation -> submit approval flow and ensure important tests are actually runnable from package scripts.

## Lane boundaries
- Lane 1 cannot edit `frontend/src/Quotations.tsx`.
- Lane 2 cannot edit `frontend/src/Quotations.tsx`.
- Lane 3 is the only lane allowed to change `frontend/src/Quotations.tsx`.
- Lane 4 should not refactor production logic except for tiny script/wiring fixes needed to run verification.
- If a lane discovers a shared-file issue outside its boundary, it reports it; do not “just fix it” in that lane.

## Task 1: Customer readiness lane

**Files:**
- Modify: `backend/src/modules/crm/routes.ts`
- Modify: `backend/src/modules/crm/repository.ts`
- Test: `backend/tests/tabular-import-api.test.js`
- Create: `backend/tests/crm-quotation-linkage-api.test.js`

- [ ] **Step 1: Write the failing API regression tests for account/contact linkage**

```js
require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-quote-linkage-'));
process.env.DB_PATH = path.join(tempDir, 'crm-quote-linkage.db');

const { initDb } = require('../sqlite-db.ts');
const { app } = require('../server.ts');

let server;
let baseUrl;
let token = '';

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

async function login() {
  const result = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(result.response.status, 200);
  token = result.body.token;
}

function withAuth(options = {}) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

(async () => {
  await initDb();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await login();

  const account = await api('/api/accounts', withAuth({
    method: 'POST',
    body: JSON.stringify({ companyName: 'HTC Account', accountType: 'Customer' }),
  }));
  assert.equal(account.response.status, 201);

  const contact = await api('/api/contacts', withAuth({
    method: 'POST',
    body: JSON.stringify({ accountId: account.body.id, firstName: 'Lan', lastName: 'Nguyen' }),
  }));
  assert.equal(contact.response.status, 201);

  const contacts = await api(`/api/contacts?accountId=${account.body.id}`);
  assert.equal(contacts.response.status, 200);
  assert.equal(Array.isArray(contacts.body), true);
  assert.equal(contacts.body.length, 1);
  assert.equal(contacts.body[0].accountId, account.body.id);

  const invalidContact = await api('/api/contacts', withAuth({
    method: 'POST',
    body: JSON.stringify({ accountId: 'missing-account', firstName: 'Bad' }),
  }));
  assert.equal(invalidContact.response.status, 400);

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
})();
```

- [ ] **Step 2: Run the new customer-linkage test and verify it fails for the expected reason**

Run:
```bash
cd backend && node -r ./tests/bootstrap-test-env.js tests/crm-quotation-linkage-api.test.js
```

Expected: FAIL because CRM routes currently allow weak account/contact linkage or return the wrong status for invalid linkage.

- [ ] **Step 3: Implement minimal CRM boundary validation in routes/repository**

Update `backend/src/modules/crm/routes.ts` so contact creation/update rejects missing or nonexistent accounts with a deterministic 400 response.

```ts
async function ensureAccountExists(accountId: string, crmRepository: ReturnType<typeof createCrmRepository>) {
  if (!accountId || !accountId.trim()) {
    return { ok: false, status: 400, payload: { error: 'accountId is required' } };
  }

  const account = await crmRepository.findAccountById(accountId.trim());
  if (!account) {
    return { ok: false, status: 400, payload: { error: 'Invalid accountId' } };
  }

  return { ok: true, account };
}
```

Then apply it in POST/PUT `/api/contacts` before calling repository methods.

- [ ] **Step 4: Re-run the new customer-linkage test and import regression**

Run:
```bash
cd backend && node -r ./tests/bootstrap-test-env.js tests/crm-quotation-linkage-api.test.js && node -r ./tests/bootstrap-test-env.js tests/tabular-import-api.test.js
```

Expected: PASS for both files.

- [ ] **Step 5: Commit the customer readiness lane**

```bash
git add backend/src/modules/crm/routes.ts backend/src/modules/crm/repository.ts backend/tests/crm-quotation-linkage-api.test.js backend/tests/tabular-import-api.test.js
git commit -m "test: harden crm linkage for quotation dependencies"
```

## Task 2: Product readiness lane

**Files:**
- Modify: `backend/src/modules/products/routes.ts`
- Modify: `backend/src/modules/products/service.ts`
- Modify: `backend/tests/products-api.test.js`
- Create: `frontend/src/quotations/quotationProductReadiness.test.ts`

- [ ] **Step 1: Write the failing backend regression for quote-required product shape**

Add a focused case to `backend/tests/products-api.test.js`:

```js
await run('product list returns quote-required fields with stable defaults', async () => {
  const result = await api('/api/products');

  assert.equal(result.response.status, 200);
  const row = result.body.find((item) => item.id === 'legacy-product-1');
  assert.ok(row);
  assert.equal(typeof row.sku, 'string');
  assert.equal(typeof row.name, 'string');
  assert.equal(typeof row.unit, 'string');
  assert.equal(typeof row.basePrice, 'number');
  assert.deepEqual(Array.isArray(row.productImages), true);
  assert.deepEqual(Array.isArray(row.productDocuments), true);
});
```

- [ ] **Step 2: Run the backend product test and verify failure if shape is unstable**

Run:
```bash
cd backend && node -r ./tests/bootstrap-test-env.js tests/products-api.test.js
```

Expected: FAIL only if quote-required fields are not returned consistently.

- [ ] **Step 3: Write the failing frontend product-readiness test for quotation usage**

Create `frontend/src/quotations/quotationProductReadiness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeQuotationLineItems } from './quotationShared';

describe('quotation product readiness', () => {
  it('normalizes quote items built from sparse product catalog rows', () => {
    const rows = normalizeQuotationLineItems([
      {
        sku: 'SKU-1',
        name: 'Product A',
        quantity: 1,
        unitPrice: 0,
      },
    ]);

    expect(rows[0]).toMatchObject({
      sku: 'SKU-1',
      name: 'Product A',
      unit: 'Chiếc',
      quantity: 1,
      unitPrice: 0,
    });
  });
});
```

- [ ] **Step 4: Run the frontend product-readiness test and verify it fails if normalization is insufficient**

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/quotations/quotationProductReadiness.test.ts
```

Expected: FAIL if quote line item normalization does not guarantee stable defaults.

- [ ] **Step 5: Implement minimal product-shape stabilization**

If backend shape is missing fields, fix in `backend/src/modules/products/service.ts` and/or `routes.ts` by ensuring serialization returns quote-required fields with safe defaults. If frontend normalization is missing defaults, tighten `normalizeQuotationLineItems` in `frontend/src/quotations/quotationShared.ts`.

```ts
unit: item.unit || 'Chiếc',
quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : 0,
```

- [ ] **Step 6: Re-run backend + frontend product readiness tests**

Run:
```bash
cd backend && node -r ./tests/bootstrap-test-env.js tests/products-api.test.js
cd ../frontend && node ./scripts/run-vitest-sandbox.mjs src/quotations/quotationProductReadiness.test.ts
```

Expected: PASS in both places.

- [ ] **Step 7: Commit the product readiness lane**

```bash
git add backend/src/modules/products/routes.ts backend/src/modules/products/service.ts backend/tests/products-api.test.js frontend/src/quotations/quotationProductReadiness.test.ts frontend/src/quotations/quotationShared.ts
git commit -m "test: stabilize product payloads for quotation flow"
```

## Task 3: Quotation stability lane

**Files:**
- Modify: `backend/tests/quotation-create-flow.test.js`
- Modify: `backend/tests/pricing-api.test.js`
- Modify: `backend/src/modules/quotations/routes/mutationRoutes.ts`
- Modify: `backend/src/modules/quotations/service.ts`
- Modify: `frontend/src/Quotations.tsx`
- Modify: `frontend/src/quotations/QuotationEditor.tsx`
- Create: `frontend/src/quotations/quotationReadiness.test.ts`

- [ ] **Step 1: Add failing backend tests for invalid account/contact quote dependencies**

Extend `backend/tests/pricing-api.test.js` with cases like:

```js
await run('standalone quotation rejects missing referenced account', async () => {
  const result = await api('/api/quotations', withAuth({
    method: 'POST',
    body: JSON.stringify({
      quoteNumber: 'Q-INVALID-ACCOUNT',
      accountId: 'missing-account',
      lineItems: [{ sku: 'SKU-1', name: 'Item', quantity: 1, unitPrice: 100 }],
    }),
  }));

  assert.equal(result.response.status, 400);
});

await run('standalone quotation rejects contact not linked to selected account', async () => {
  const result = await api('/api/quotations', withAuth({
    method: 'POST',
    body: JSON.stringify({
      quoteNumber: 'Q-CONTACT-MISMATCH',
      accountId: accountA.id,
      contactId: contactB.id,
      lineItems: [{ sku: 'SKU-1', name: 'Item', quantity: 1, unitPrice: 100 }],
    }),
  }));

  assert.equal(result.response.status, 400);
});
```

- [ ] **Step 2: Run the targeted quotation/pricing backend tests and verify failure**

Run:
```bash
cd backend && node -r ./tests/bootstrap-test-env.js tests/quotation-create-flow.test.js && node -r ./tests/bootstrap-test-env.js tests/pricing-api.test.js
```

Expected: FAIL on the new dependency-validation cases.

- [ ] **Step 3: Add failing frontend readiness/state-reset tests**

Create `frontend/src/quotations/quotationReadiness.test.ts` with pure readiness helpers extracted from `Quotations.tsx`:

```ts
import { describe, expect, it } from 'vitest';
import { buildQuotationReadiness, resetDependentSelections } from './quotationShared';

describe('quotation readiness', () => {
  it('blocks save when account is missing or line items are empty', () => {
    expect(buildQuotationReadiness({ selectedAccId: '', items: [] }).canSave).toBe(false);
    expect(buildQuotationReadiness({ selectedAccId: 'acc-1', items: [] }).canSave).toBe(false);
    expect(buildQuotationReadiness({ selectedAccId: 'acc-1', items: [{ sku: 'SKU-1' }] }).canSave).toBe(true);
  });

  it('clears invalid contact when account changes', () => {
    expect(
      resetDependentSelections({
        nextAccountId: 'acc-2',
        selectedContactId: 'contact-1',
        contacts: [{ id: 'contact-1', accountId: 'acc-1' }],
      }).selectedContactId,
    ).toBe('');
  });
});
```

- [ ] **Step 4: Run the frontend readiness test and verify failure**

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/quotations/quotationReadiness.test.ts
```

Expected: FAIL because the extracted readiness helpers do not exist yet.

- [ ] **Step 5: Implement minimal backend dependency checks in quotation service**

Add a service-level guard in `backend/src/modules/quotations/service.ts` before insert:

```ts
async function validateQuotationReferences(db: any, input: { accountId?: string | null; contactId?: string | null; projectId?: string | null }) {
  if (input.accountId) {
    const account = await db.get('SELECT id FROM Account WHERE id = ?', [input.accountId]);
    if (!account) throw Object.assign(new Error('Invalid accountId'), { statusCode: 400 });
  }

  if (input.contactId) {
    const contact = await db.get('SELECT id, accountId FROM Contact WHERE id = ?', [input.contactId]);
    if (!contact) throw Object.assign(new Error('Invalid contactId'), { statusCode: 400 });
    if (input.accountId && contact.accountId !== input.accountId) {
      throw Object.assign(new Error('contactId does not belong to accountId'), { statusCode: 400 });
    }
  }
}
```

Then call it from both `createProjectQuotation` and `createStandaloneQuotation`.

- [ ] **Step 6: Map service validation errors to deterministic route responses**

Update `backend/src/modules/quotations/routes/mutationRoutes.ts` to catch `statusCode === 400` from service validation and return:

```ts
return res.status(400).json({ error: error.message });
```

- [ ] **Step 7: Extract minimal frontend readiness helpers and wire them into Quotations.tsx**

In `frontend/src/quotations/quotationShared.ts`, add:

```ts
export function buildQuotationReadiness(params: { selectedAccId: string; items: any[] }) {
  const hasAccount = !!params.selectedAccId;
  const hasItems = params.items.length > 0;
  return {
    hasAccount,
    hasItems,
    canSave: hasAccount && hasItems,
  };
}

export function resetDependentSelections(params: {
  nextAccountId: string;
  selectedContactId: string;
  contacts: Array<{ id: string; accountId?: string }>;
}) {
  const stillValid = params.contacts.some(
    (contact) => contact.id === params.selectedContactId && contact.accountId === params.nextAccountId,
  );

  return {
    selectedContactId: stillValid ? params.selectedContactId : '',
  };
}
```

Then update `frontend/src/Quotations.tsx` to use these helpers when account changes and before save/submit.

- [ ] **Step 8: Re-run quotation backend + frontend targeted tests**

Run:
```bash
cd backend && node -r ./tests/bootstrap-test-env.js tests/quotation-create-flow.test.js && node -r ./tests/bootstrap-test-env.js tests/pricing-api.test.js
cd ../frontend && node ./scripts/run-vitest-sandbox.mjs src/quotations/quotationReadiness.test.ts src/quotations/quotationShared.test.ts src/quotations/quotationUiDbContract.test.ts
```

Expected: PASS for all targeted quotation tests.

- [ ] **Step 9: Commit the quotation stability lane**

```bash
git add backend/tests/quotation-create-flow.test.js backend/tests/pricing-api.test.js backend/src/modules/quotations/routes/mutationRoutes.ts backend/src/modules/quotations/service.ts frontend/src/Quotations.tsx frontend/src/quotations/QuotationEditor.tsx frontend/src/quotations/quotationShared.ts frontend/src/quotations/quotationReadiness.test.ts
git commit -m "fix: harden quotation readiness and dependency validation"
```

## Task 4: Final verification lane

**Files:**
- Modify: `backend/package.json`
- Modify: `frontend/package.json` (only if needed)
- Verify: backend/frontend targeted suites + UAT/browser flow

- [ ] **Step 1: Add missing critical backend tests to runnable package scripts if absent**

Update `backend/package.json` so critical quotation tests are included in core or explicit scripts:

```json
{
  "scripts": {
    "test:quotation:typed-state": "node -r ./tests/bootstrap-test-env.js tests/quotation-typed-state.test.js",
    "test:quotation:pdf-contact": "node -r ./tests/bootstrap-test-env.js tests/pdf-contact-name.test.js"
  }
}
```

If appropriate, append them to `test:core` or create a grouped `test:quote-stability` script.

- [ ] **Step 2: Run the full targeted backend verification bundle**

Run:
```bash
cd backend && npm run test:quotation:typed-state && npm run test:quotation:pdf-contact && node -r ./tests/bootstrap-test-env.js tests/crm-quotation-linkage-api.test.js && node -r ./tests/bootstrap-test-env.js tests/products-api.test.js && node -r ./tests/bootstrap-test-env.js tests/pricing-api.test.js
```

Expected: PASS for all targeted backend verification.

- [ ] **Step 3: Run the targeted frontend verification bundle**

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/quotations/quotationReadiness.test.ts src/quotations/quotationProductReadiness.test.ts src/quotations/quotationShared.test.ts src/quotations/quotationUiDbContract.test.ts
```

Expected: PASS for targeted frontend verification.

- [ ] **Step 4: Run the critical UAT/browser path**

Run the exact documented business path:
1. Create/select customer account
2. Create/select contact under that account
3. Open quotation form
4. Confirm product catalog loads
5. Add product into line items
6. Save draft quotation
7. Submit quotation for approval
8. Confirm status update is visible and no immediate approval/handoff gate breaks

If browser automation is available, run:
```bash
cd frontend && npm run test:ux:audit
```

If local browser launch is blocked, follow `docs/qa/ux-regression-codex-runbook.md` and capture manual evidence instead.

- [ ] **Step 5: Record verification notes and commit verification-lane wiring**

```bash
git add backend/package.json frontend/package.json
git commit -m "test: expose quote stability verification lanes"
```

## Spec self-review
- Coverage check: all four lanes from the approved design map to tasks above.
- Placeholder scan: no TBD/TODO placeholders remain.
- Consistency check: lane boundaries match the approved spec; `frontend/src/Quotations.tsx` is only modified in quotation lane.

## Execution notes
- Implement tasks in order: Lane 1 -> Lane 2 -> Lane 3 -> Lane 4.
- Do not parallelize code-writing lanes that touch shared integration assumptions until preceding dependency lane is reviewed.
- Use a fresh subagent for each task, then run spec review and code-quality review before moving on.
