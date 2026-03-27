# Quotations Action Panel Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place the quotation action buttons above the preview panel in the right column so the preview never overlaps them while scrolling.

**Architecture:** Adjust right-column render order in `Quotations.tsx` so the action panel is rendered before the preview. Make the action panel sticky (desktop) and ensure preview is pushed below with appropriate spacing/top offset. Mobile layout remains unchanged.

**Tech Stack:** React + TypeScript + inline style objects (no CSS modules).

---

## File Map
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`
  - Right column render order (action panel before preview)
  - Sticky positioning + spacing to prevent overlap

---

### Task 1: Reorder Right Column and Add Sticky Action Panel (Desktop)

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`

- [ ] **Step 1: Locate right-column JSX**
  - In desktop layout block, find the right column wrapper that currently renders `{previewPanel}` then `{actionButtons}`.

- [ ] **Step 2: Move action panel above preview**
  - Swap the order to `{actionButtons}` then `{previewPanel}`.

- [ ] **Step 3: Make action panel sticky (desktop only)**
  - Add inline styles to the action panel container for desktop: `position: 'sticky'`, `top: '24px'`, and optional `zIndex: 1`.
  - Ensure these styles do not apply on mobile (keep current mobile behavior).

- [ ] **Step 4: Prevent overlap with preview**
  - If preview remains sticky, increase its `top` offset to account for the action panel height, or make preview non-sticky on desktop.
  - Keep spacing between action panel and preview (e.g., `gap: '16px'` already present) so preview is visually pushed down.

- [ ] **Step 5: Manual verification**
  - Run the app and open a quotation detail.
  - Scroll the page: verify action buttons remain above the preview and are not overlapped.
  - Confirm mobile layout is unchanged.

---

### Task 2: Clean Up and Validate Styles

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`

- [ ] **Step 1: Ensure inline style consistency**
  - Keep style updates in the existing inline pattern; avoid new CSS classes.

- [ ] **Step 2: Quick scan for regressions**
  - Verify the preview panel still renders correctly on desktop and mobile.
  - Confirm no layout jumps or overflow issues in the right column.

- [ ] **Step 3: Manual verification (repeat)**
  - Scroll again and verify there is no visual overlap between buttons and preview.

---

## Notes
- User requested no git commits.
- No automated tests required; manual UI verification is sufficient.
