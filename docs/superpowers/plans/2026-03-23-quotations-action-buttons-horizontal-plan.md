# Quotations Action Buttons Horizontal Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two quotation action buttons render side-by-side horizontally, and wrap to the next line automatically on narrow screens.

**Architecture:** Update the action buttons container in `Quotations.tsx` to use a wrapping flex row, and apply flexible sizing to each button while preserving existing button styles.

**Tech Stack:** React + TypeScript + inline style objects.

---

## File Map
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx`
  - actionButtons container styles
  - button sizing styles (flex/minWidth)

---

### Task 1: Update Action Buttons Layout to Horizontal + Wrap

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx`

- [ ] **Step 1: Locate actionButtons container**
  - Find the JSX constant `actionButtons` and its outer `<div>` container.

- [ ] **Step 2: Change container layout to horizontal + wrap**
  - Update container styles to:
    - `display: 'flex'`
    - `flexDirection: 'row'`
    - `flexWrap: 'wrap'`
    - `gap: '12px'`
    - keep existing padding

- [ ] **Step 3: Apply flexible sizing to buttons**
  - Add `flex: '1 1 220px'` to both action buttons (Save Draft / Export PDF) so they sit side-by-side on wide screens and wrap on narrow screens.
  - Preserve existing button styles and colors.

- [ ] **Step 4: Manual verification**
  - On wide screens: buttons should appear in one row.
  - On narrow screens: buttons should wrap into two rows without overflow.
  - Confirm mobile behavior matches the requirement “wrap when insufficient width.”

---

### Task 2: Quick Regression Scan

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Quotations.tsx`

- [ ] **Step 1: Ensure inline style consistency**
  - No new CSS classes or external styles.

- [ ] **Step 2: Check surrounding layout**
  - Verify actionButtons container spacing remains correct and does not affect preview panel spacing.

- [ ] **Step 3: Manual verification (repeat)**
  - Re-check wrap behavior after any minor adjustments.

---

## Notes
- User requested no git commits.
- No automated tests required; manual UI verification is sufficient.

