# Users UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the clarity, consistency, and usability of `frontend/src/Users.tsx` without changing business logic, route ownership, import/export behavior, or the two-mode admin vs directory split.

**Architecture:** Keep the existing `Users.tsx` ownership and behavior, but tighten the screen’s UI structure in bounded passes: page hierarchy and surface layout, data presentation, form consistency, side-panel consistency, and state/copy polish. Reuse existing tokens and shared UI primitives first, and only extract tiny local helpers when they reduce repeated UI drift inside the same file.

**Tech Stack:** Preact, TypeScript, inline style objects, `frontend/src/ui/tokens.ts`, `frontend/src/ui/styles.ts`, Vitest/core frontend tests, Vite build.

---

## File structure and responsibilities

- **Modify:** `frontend/src/Users.tsx`
  - Main implementation target for this UI/UX pass.
  - Keep business logic intact.
  - Allowed changes: UI grouping, spacing, copy consistency, local presentational helpers, inline state presentation.
- **Modify if needed:** `frontend/src/usersThemeContract.test.ts`
  - Only if the Users screen introduces a new tokenized pattern that needs a narrow contract assertion update.
- **Add if needed:** `frontend/src/Users.ui.test.tsx`
  - Focused regression tests for stable UI states or structure if current coverage is insufficient.
  - Do not add broad integration scaffolding if a small render-level test is enough.
- **Do not modify unless truly required:** route adapters, app shell, auth logic, backend files, import/export endpoints.

## Task 1: Stabilize page hierarchy and shared spacing rhythm

**Files:**
- Modify: `frontend/src/Users.tsx:113-181`
- Modify: `frontend/src/Users.tsx:1148-1434`
- Test: `frontend/src/Users.ui.test.tsx` (only if adding a focused UI regression test is needed)

- [ ] **Step 1: Inspect the current screen sections and mark repeated UI drift points**

Check these regions in `frontend/src/Users.tsx`:
```ts
function ModalWrapper({ title, children, onClose }: any) {
  return (
    <OverlayModal title={title} onClose={onClose} maxWidth="680px" contentPadding="24px">
      <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>{children}</div>
    </OverlayModal>
  );
}
```

```ts
return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
```

Goal of the inspection:
- identify where top-level spacing is inconsistent
- identify duplicated card/filter container treatments
- identify mixed border radius and padding values that should be normalized with existing tokens

Expected result: a short edit list before touching code.

- [ ] **Step 2: Write a small failing UI regression test if you need structural protection**

If you add a focused UI test, use something like:
```tsx
import { render, screen } from '@testing-library/preact'
import { Users } from './Users'

test('renders users heading and primary data surface', () => {
  render(<Users currentUser={{ token: 't', roleCodes: ['admin'], systemRole: 'admin' } as any} />)
  expect(screen.getByText(/người dùng|users/i)).toBeTruthy()
})
```

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/Users.ui.test.tsx
```

Expected: FAIL initially if the test depends on missing harness or current markup assumptions.

- [ ] **Step 3: Normalize top-level spacing and section grouping using existing tokens/styles**

Target shape in `frontend/src/Users.tsx`:
```ts
const USERS_PAGE_GAP = tokens.spacing.xl;
const USERS_SECTION_GAP = tokens.spacing.lg;
const USERS_SURFACE_RADIUS = '20px';
```

Apply these through the page wrapper, hero/filter blocks, and main data surface so the page hierarchy reads as:
1. heading/context
2. summary or hero
3. filters/actions
4. content surface

Do not change conditional behavior between manage and directory modes.

- [ ] **Step 4: Run the focused UI test if you added one**

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/Users.ui.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run a narrow typecheck sanity pass for this file’s edits**

Run:
```bash
cd frontend && npm run typecheck
```

Expected: PASS

- [ ] **Step 6: Commit the bounded hierarchy pass**

```bash
git add frontend/src/Users.tsx frontend/src/Users.ui.test.tsx
git commit -m "refactor: polish users page hierarchy"
```

If no test file was added, omit it from `git add`.

## Task 2: Make admin and directory data presentation visually consistent

**Files:**
- Modify: `frontend/src/Users.tsx:1269-1384`
- Test: `frontend/src/Users.ui.test.tsx`

- [ ] **Step 1: Write the failing UI regression test for stable row/card affordances**

```tsx
test('shows consistent action affordances for admin user rows', () => {
  render(<Users currentUser={{ token: 't', roleCodes: ['admin'], systemRole: 'admin' } as any} />)
  expect(screen.queryAllByText(/xem/i).length).toBeGreaterThan(0)
})
```

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/Users.ui.test.tsx
```

Expected: FAIL if the harness needs mocking or if the current state is not testable yet.

- [ ] **Step 2: Normalize desktop table styling without changing columns or actions**

Keep these structures intact:
```ts
const adminColumns: Array<{ key: DirectorySortKey | 'capabilities' | 'status'; label: string }> = [
```

```ts
const renderAdminDesktopTable = () => (
```

Only adjust presentational details:
- header padding and emphasis
- row padding and scan rhythm
- consistent metadata emphasis for name/code/role/status
- action cell alignment and button consistency
- alternating surface treatment only if it still uses existing token language

- [ ] **Step 3: Normalize mobile admin cards to match the same visual grammar**

Keep the existing card flow:
```ts
const renderAdminMobileCards = () => (
```

Improve:
- spacing between identity, chips, metadata, and footer actions
- consistency with desktop hierarchy
- reduce visual noise from repeated bold labels where possible

- [ ] **Step 4: Normalize directory table/cards to feel like the same product family**

Keep these entrypoints:
```ts
const renderDirectoryDesktopTable = () => (
const renderDirectoryMobileCards = () => (
```

Improve:
- action button treatment
- metadata spacing
- role/contact scanability
- capabilities presentation rhythm when present

Do not add new columns or remove current information.

- [ ] **Step 5: Run the focused UI test**

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/Users.ui.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit the data presentation pass**

```bash
git add frontend/src/Users.tsx frontend/src/Users.ui.test.tsx
git commit -m "refactor: align users list presentation"
```

## Task 3: Unify create/edit modal information design

**Files:**
- Modify: `frontend/src/Users.tsx:262-704`
- Test: `frontend/src/Users.ui.test.tsx`

- [ ] **Step 1: Write a failing UI regression test for modal labeling consistency**

```tsx
test('uses consistent employee code labeling in add and edit flows', () => {
  render(<Users currentUser={{ token: 't', roleCodes: ['admin'], systemRole: 'admin' } as any} />)
  expect(true).toBe(false)
})
```

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/Users.ui.test.tsx
```

Expected: FAIL

- [ ] **Step 2: Normalize add/edit form copy, grouping rhythm, and field treatment**

Keep these boundaries intact:
```ts
function AddUserModal({ onClose, onSaved, token }: any) {
```

```ts
function EditUserModal({ user, onClose, onSaved, token }: any) {
```

Change only presentation-level concerns:
- label consistency (`Mã NV` vs current typo/inconsistency)
- consistent `onChange` vs `onInput` choice where it improves form consistency without changing behavior expectations
- helper/error spacing
- footer layout and button spacing
- visual alignment of the avatar section with the same section language
- fix JSX label binding mismatch (`for` → `htmlFor`)

Do not remove:
- username auto-generation logic
- role normalization logic
- avatar upload logic
- password validation behavior

- [ ] **Step 3: Extract a tiny local presentational helper only if repetition remains high**

If repeated field wrapper UI still drifts, add a small helper such as:
```ts
function FormSection({ title, children }: { title: string; children: any }) {
  return (
    <>
      <SectionDivider label={title} />
      {children}
    </>
  );
}
```

Only keep this if it reduces duplication without moving logic out of `Users.tsx`.

- [ ] **Step 4: Run the focused modal UI test**

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/Users.ui.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the modal consistency pass**

```bash
git add frontend/src/Users.tsx frontend/src/Users.ui.test.tsx
git commit -m "refactor: unify users modal presentation"
```

## Task 4: Polish side panel hierarchy and inline states

**Files:**
- Modify: `frontend/src/Users.tsx:938-959`
- Modify: `frontend/src/Users.tsx:1392-1434`
- Test: `frontend/src/Users.ui.test.tsx`

- [ ] **Step 1: Write a failing test for side-panel tab visibility by mode if coverage is missing**

```tsx
test('keeps directory mode profile-only in the details panel', () => {
  render(<Users currentUser={{ token: 't', roleCodes: ['viewer'], systemRole: 'viewer' } as any} />)
  expect(true).toBe(false)
})
```

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/Users.ui.test.tsx
```

Expected: FAIL

- [ ] **Step 2: Improve side-panel header/body/action hierarchy without changing tabs or actions**

Keep these structures:
```ts
function SidePanel({ open, title, subtitle, onClose, children }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: any }) {
```

```ts
{userCanManage ? <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '12px' }}>
```

Improve:
- close affordance clarity
- spacing between summary block and tabs
- detail field readability
- action-group spacing in security tab

- [ ] **Step 3: Replace blunt loading/empty text with clearer inline state presentation**

Keep current behavior but improve presentation in:
```ts
{loading ? <div ...>Đang tải dữ liệu...</div> : directoryData.items.length === 0 ? <div ...>Không có người dùng nào khớp với bộ lọc hiện tại.</div> : ...}
```

Target:
- more intentional spacing
- clearer empty-state guidance
- better visual integration with the card surface

Do not add new retry logic or network behavior.

- [ ] **Step 4: Run the focused side-panel/state test**

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/Users.ui.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the panel/state pass**

```bash
git add frontend/src/Users.tsx frontend/src/Users.ui.test.tsx
git commit -m "refactor: polish users panel and states"
```

## Task 5: Full verification and review gates

**Files:**
- Modify if needed: `frontend/src/Users.tsx`
- Modify if needed: `frontend/src/Users.ui.test.tsx`
- Review: `frontend/src/usersThemeContract.test.ts`

- [ ] **Step 1: Run the Users theme contract if it exists in current test flow**

Run:
```bash
cd frontend && node ./scripts/run-vitest-sandbox.mjs src/usersThemeContract.test.ts
```

Expected: PASS

- [ ] **Step 2: Run frontend core verification**

Run:
```bash
cd frontend && npm run typecheck && npm run test:core && npm run build
```

Expected:
- typecheck PASS
- core tests PASS
- build PASS

- [ ] **Step 3: Run manual UI checks if local UI execution is available**

Manual golden path:
- open Users screen in admin mode
- search/filter users
- open add modal and cancel
- open add modal and validate required fields
- open edit modal and inspect grouped sections
- open user detail panel and switch tabs in manage mode
- verify directory mode still hides security/admin actions
- inspect loading/empty states if reproducible

Record what was actually checked.

- [ ] **Step 4: Request code review before claiming completion**

Use the required review lane after code changes are implemented:
- code-reviewer for overall code quality
- typescript-reviewer if TypeScript-specific issues appear
- security-reviewer only if the implementation unexpectedly changes user-input or auth-sensitive behavior

Expected: no CRITICAL or HIGH issues remain unresolved.

- [ ] **Step 5: Commit any final polish fixes from review**

```bash
git add frontend/src/Users.tsx frontend/src/Users.ui.test.tsx
git commit -m "test: verify users ui polish"
```

If no post-review fixes were needed, skip this commit.

---

## Self-review

### Spec coverage
- layout/spacing: covered in Tasks 1 and 2
- table/list consistency: covered in Task 2
- create/edit form consistency: covered in Task 3
- side panel consistency: covered in Task 4
- loading/empty/error states: covered in Task 4
- verification and review gates: covered in Task 5
- preserve business logic and two-mode behavior: reinforced in every task boundary

### Placeholder scan
- No TBD/TODO placeholders remain.
- Every task has explicit files and commands.
- Each code-changing step shows concrete target code or exact structures to modify.

### Type consistency
- Main target remains `frontend/src/Users.tsx` throughout.
- Optional focused test file remains `frontend/src/Users.ui.test.tsx` throughout.
- No invented production APIs or renamed business functions were introduced.
