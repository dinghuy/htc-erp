# UI Optimization (Full App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify typography, tokens, and UI primitives across the entire app using shared styles, Roboto-only font, and consistent motion.

**Architecture:** Centralize visual decisions in `ui/tokens.ts` and `ui/styles.ts`, then migrate all screens to consume those shared styles. Update global CSS for Roboto and new semantic tokens. Validate with a static scan and a focused visual pass.

**Tech Stack:** Preact, TypeScript, inline style objects, CSS variables

---

## File Map
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\index.css`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\tokens.ts`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\styles.ts`
- Modify: all UI sources in `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\**\*.tsx`

---

### Task 1: Global Typography (Roboto) + New Token

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\index.css`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\tokens.ts`

- [ ] **Step 1: Add Roboto font import and global font-family**

Update `index.css` to import Roboto and set the root font:
```css
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800&display=swap');
:root { font-family: 'Roboto', sans-serif; }
```

- [ ] **Step 2: Add `--text-on-primary` CSS variable**

In `index.css` define:
```css
:root { --text-on-primary: var(--text-primary); }
.dark { --text-on-primary: var(--text-primary); }
```
(Adjust if contrast requires a different value.)

- [ ] **Step 3: Map token**

In `tokens.ts` add:
```ts
textOnPrimary: 'var(--text-on-primary)'
```

- [ ] **Step 4: (Optional) Run font check**

Open app, then run in console:
```js
await document.fonts.ready; getComputedStyle(document.body).fontFamily
```
Expected: includes `Roboto` first.

---

### Task 2: Expand Shared UI Styles

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\styles.ts`

- [ ] **Step 1: Add required button variants**

Add `ui.btn.ghost` using tokens (transparent bg, primary text, hover background using `tokens.colors.background`).

- [ ] **Step 2: Add form primitives**

Add `ui.form.label`, `ui.form.help`, `ui.form.error` with font sizes/weights per spec.

- [ ] **Step 3: Table headers & rows**

Add `ui.table.thStatic` and `ui.table.thSortable` (sortable adds `cursor: 'pointer'`, `userSelect: 'none'`). Add `ui.table.row` with hover background using `tokens.colors.background` and 150–200ms transitions.

- [ ] **Step 4: Badge neutral**

Add `ui.badge.neutral` with muted text + surface background.

- [ ] **Step 5: Update existing styles to use `textOnPrimary`**

Ensure primary button text uses `tokens.colors.textOnPrimary`.

---

### Task 3: Migrate Core Shell & Global Components

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Layout.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Notification.tsx`

- [ ] **Step 1: Layout typography + tokens**

Replace any remaining font stacks, text colors, spacing, and hover effects with `tokens` and `ui` styles. Ensure header tabs use new hover/active transitions (150–200ms).

- [ ] **Step 2: Notification toasts**

Ensure toasts use `ui` tokens and `textOnPrimary` as needed. Add focus-visible style on toast close or interactive elements if present.

---

### Task 4: Migrate Data Screens (Tables & Forms)

**Files (representative, adjust as found):**
- `frontend/src/Dashboard.tsx`
- `frontend/src/Leads.tsx`
- `frontend/src/Customers.tsx`
- `frontend/src/Users.tsx`
- `frontend/src/Products.tsx`
- `frontend/src/Suppliers.tsx`
- `frontend/src/Quotations.tsx`
- `frontend/src/Reports.tsx`
- `frontend/src/Settings.tsx`
- `frontend/src/Support.tsx`
- `frontend/src/EventLog.tsx`

- [ ] **Step 1: Replace table headers**

Use `ui.table.thStatic` for non-sortable headers and `ui.table.thSortable` for sortable headers.

- [ ] **Step 2: Replace table cells & row hover**

Use `ui.table.td` and wrap rows with `ui.table.row` hover styling.

- [ ] **Step 3: Replace form labels & errors**

Use `ui.form.label`, `ui.form.help`, `ui.form.error` everywhere.

- [ ] **Step 4: Replace badges**

Normalize to `ui.badge.*` with status mapping and fallback to neutral.

- [ ] **Step 5: Remove hard-coded radius/shadow/colors**

Replace with tokens in buttons, cards, KPI blocks, modals, and tabs. PDF preview section in `Quotations.tsx` is exempt.

---

### Task 5: Motion & Interaction Consistency

**Files:**
- Same as Task 3–4

- [ ] **Step 1: Buttons**

Ensure buttons use 150–200ms transitions and subtle hover (brightness or slight translate).

- [ ] **Step 2: Cards & rows**

Apply hover lift/shadow or background highlight with 150–200ms transitions.

- [ ] **Step 3: Reduced motion**

Respect `prefers-reduced-motion` (disable transform effects).

---

### Task 6: Accessibility Pass

**Files:**
- Same as Task 3–4

- [ ] **Step 1: Focus-visible**

Add focus-visible styles to buttons, links, icon-only controls.

- [ ] **Step 2: Disabled states**

Ensure disabled styles are visually distinct.

- [ ] **Step 3: Contrast spot check**

Verify `textOnPrimary` and badge text vs background in light and dark mode.

---

### Task 7: Verification & Cleanup

**Files:**
- No code changes unless issues found

- [ ] **Step 1: Static scan**

Run:
```powershell
Get-ChildItem -Path "C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src" -Recurse -File |
  Select-String -Pattern '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|box-shadow:|boxShadow:'
```
Expected: only allowlisted locations.

- [ ] **Step 2: Visual check**

Verify key screens at `1440x900`, `1280x800`, `390x844`.

---

## Notes
- No git commits (user requested no git).
- PDF preview in `Quotations.tsx` is excluded from color normalization.
