# Mobile UI Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a mobile layout (<= 768px) across the entire CRM app with hidden sidebar, compact header, stacked filters, and card-based data views.

**Architecture:** Use a hybrid responsive approach: CSS media queries for shell/layout stacking and a small `isMobile` hook to switch complex views (tables to cards, Form/Preview tabs). Keep tokens/styles consistent and preserve desktop layout.

**Tech Stack:** Preact, TypeScript, inline styles, CSS variables

---

## File Map
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Layout.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\App.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\index.css`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Dashboard.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Leads.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Customers.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Products.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Suppliers.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Users.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Reports.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Settings.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Support.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\EventLog.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx`

---

### Task 1: Add Mobile Utility Hook + Global CSS Helpers

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\App.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\index.css`

- [ ] **Step 1: Add `isMobile` in App root**

Add a simple media check:
```ts
const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
useEffect(() => {
  const onResize = () => setIsMobile(window.innerWidth <= 768);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);
```
Pass `isMobile` into `Layout` and key screens (Dashboard, Leads, Customers, Users, Products, Suppliers, Quotations, Reports, Settings, Support, EventLog).

- [ ] **Step 2: Add CSS helpers for mobile spacing**

In `index.css`, add:
```css
@media (max-width: 768px) {
  .mobile-stack { display: flex; flex-direction: column; gap: 12px; }
  .mobile-actions { display: flex; gap: 8px; overflow-x: auto; }
  .mobile-actions::-webkit-scrollbar { display: none; }
}
```
(Only used if needed by components; do not add if unused.)

---

### Task 2: Responsive Shell (Layout)

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Layout.tsx`

- [ ] **Step 1: Hide sidebar on mobile, add drawer**

Add `isMobile` prop. When `isMobile`, hide sidebar and show a hamburger button in header. Implement a slide-in drawer with the same nav items + settings/support.

- [ ] **Step 2: Compact header**

On mobile, reduce header height and spacing, hide `Global/Operations/Service` tabs or render them as a scrollable chip row below search.

- [ ] **Step 3: Content padding**

On mobile, set main content padding to `12–16px`.

---

### Task 3: Dashboard Mobile Layout

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Dashboard.tsx`

- [ ] **Step 1: KPI stack**

If `isMobile`, render KPI cards in a single column (gap 12–16px).

- [ ] **Step 2: Section order**

If `isMobile`, render Recent Activities before Sales Funnel.

---

### Task 4: Leads (Kanban) Mobile

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Leads.tsx`

- [ ] **Step 1: Header/actions stack**

On mobile, stack search + CSV actions vertically; buttons should scroll horizontally if overflow.

- [ ] **Step 2: Kanban horizontal scroll**

On mobile, keep columns full width and enable horizontal scroll on the column container.

---

### Task 5: Table-to-Card for Data Screens

**Files:**
- Modify: `Customers.tsx`, `Users.tsx`, `Products.tsx`, `Suppliers.tsx`, `Reports.tsx`

- [ ] **Step 1: Card list layout**

On mobile, render data rows as cards with title + key fields, moving actions into a card footer.

- [ ] **Step 2: Filters stack**

Move filter inputs into a vertical stack above the card list.

---

### Task 6: Quotations Mobile Tabs (Form/Preview)

**Files:**
- Modify: `Quotations.tsx`

- [ ] **Step 1: Add mobile tabs**

Introduce a local state `mobileTab: 'form' | 'preview'` default `form`. Render only one section on mobile.

- [ ] **Step 2: Preserve preview zoom**

Preview container should be full width with zoom controls visible. Ensure preview still scales correctly.

---

### Task 7: Settings/Support/EventLog Mobile

**Files:**
- Modify: `Settings.tsx`, `Support.tsx`, `EventLog.tsx`

- [ ] **Step 1: Settings tabs**

Convert settings tabs to scrollable segmented control on mobile.

- [ ] **Step 2: Support cards**

Help cards stack vertically; ticket form full width.

- [ ] **Step 3: EventLog cards**

Timeline becomes a vertical card list.

---

### Task 8: Verification

**Files:**
- No code changes unless issues found

- [ ] **Step 1: Manual check**

Check at `390x844` and `360x800`. Validate:
- Sidebar hidden + drawer works
- Leads Kanban scrolls horizontally
- Quotations Form/Preview tabs
- Tables render as cards

---

## Notes
- No git commits (user request).
- Preserve PDF preview layout content; only change layout placement.

