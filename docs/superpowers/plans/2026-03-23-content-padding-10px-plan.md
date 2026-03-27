# Content Padding 10px (All Tabs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set the main content area padding to 10px on all sides for every tab.

**Architecture:** Single source of truth in `Layout` for the main content wrapper. Adjust only the wrapper style so all tabs inherit the change.

**Tech Stack:** Preact, inline style objects in TSX

---

## File Map
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Layout.tsx`

### Task 1: Update Main Content Padding

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Layout.tsx`

- [ ] **Step 1: Update the main content wrapper padding to 10px**

Locate the wrapper:
```tsx
<div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
  {children}
</div>
```

Change to:
```tsx
<div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
  {children}
</div>
```

- [ ] **Step 2: Sanity check for any redundant page-level padding**

Scan for any page wrappers explicitly adding extra top padding. If found, align to the new 10px padding only when it creates noticeable excess (do not refactor unrelated layout).

- [ ] **Step 3: (Optional) Run app for visual check**

If available, run the frontend and verify top spacing in key tabs (Dashboard, Sales, Leads, Accounts, Contacts, Products, Suppliers, EventLog, Users, Reports, Settings, Support).

---

## Notes
- No tests are expected for this UI-only spacing update.
- Keep header and sidebar padding unchanged.
