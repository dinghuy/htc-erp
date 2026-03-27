# Hide Leads/Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide Leads and Reports from the sidebar and block direct route access by normalizing to Dashboard.

**Architecture:** Sidebar navigation is defined in `Layout.tsx`, while route rendering is controlled by `currentRoute` in `app.tsx`. We will remove the two nav items and add a simple guard to map disallowed routes to `Dashboard` before render.

**Tech Stack:** Preact/React (TSX), Vite frontend.

---

## File Structure
- Modify `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Layout.tsx`
  - Sidebar nav items array; remove `Leads` and `Reports`.
- Modify `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\app.tsx`
  - Route guard to normalize `currentRoute` when it equals `Leads` or `Reports`.

### Task 1: Hide Leads/Reports in Sidebar

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Layout.tsx`
- Test: N/A (manual)

- [ ] **Step 1: Write the failing test**

No automated tests exist for sidebar items; skip.

- [ ] **Step 2: Run test to verify it fails**

N/A.

- [ ] **Step 3: Write minimal implementation**

In the sidebar items array, remove the entries:
- `{ label: 'Leads', icon: '🎯' }`
- `{ label: 'Reports', icon: '📈' }`

- [ ] **Step 4: Run test to verify it passes**

Manual: Open the app, confirm Leads and Reports are not shown in the sidebar.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Layout.tsx

git commit -m "chore: hide leads and reports tabs"
```

### Task 2: Block Direct Route Access

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\app.tsx`
- Test: N/A (manual)

- [ ] **Step 1: Write the failing test**

No automated routing tests exist; skip.

- [ ] **Step 2: Run test to verify it fails**

N/A.

- [ ] **Step 3: Write minimal implementation**

Add a small guard early in the component render (or after route state initialization):
- If `currentRoute` is `'Leads'` or `'Reports'`, set it to `'Dashboard'`.
- Ensure this does not cause render loops (guard inside `useEffect` tied to `currentRoute`).

- [ ] **Step 4: Run test to verify it passes**

Manual:
- Navigate to `#Leads` and `#Reports` directly.
- App should render Dashboard instead.

- [ ] **Step 5: Commit**

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\app.tsx

git commit -m "chore: block leads and reports routes"
```

---

## Manual Verification Checklist
- Sidebar no longer displays Leads and Reports.
- Directly accessing Leads or Reports routes renders Dashboard.

