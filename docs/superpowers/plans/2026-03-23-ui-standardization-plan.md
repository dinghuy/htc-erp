# UI Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize UI styling across the CRM frontend using existing CSS tokens, removing hard-coded colors/radius/shadows and centralizing shared styles.

**Architecture:** Add `src/ui/tokens.ts` and `src/ui/styles.ts` as the single source of styling primitives. Replace inline hard-coded values in screen components with shared styles and token references, without changing layout or behavior.

**Tech Stack:** Preact + TypeScript + CSS variables

---

## File Structure (Planned)
**Create:**
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\tokens.ts`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\styles.ts`

**Modify (primary):**
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Layout.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Dashboard.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Leads.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Customers.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Users.tsx`

**Modify (secondary):**
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Suppliers.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Products.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Reports.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Settings.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Support.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\EventLog.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Notification.tsx`
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\app.tsx`

---

### Task 1: Create Token Mapping File

**Files:**
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\tokens.ts`

- [ ] **Step 1: Define token object with CSS variable mappings**

```ts
export const tokens = {
  colors: {
    primary: 'var(--ht-green)',
    primaryDark: 'var(--ht-green-dark)',
    warning: 'var(--ht-amber)',
    warningDark: 'var(--ht-amber-dark)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
    surface: 'var(--bg-surface)',
    background: 'var(--bg-primary)',
    border: 'var(--border-color)',
    success: 'var(--ht-success-text)',
    error: 'var(--ht-error-text)',
    badgeBgSuccess: 'var(--ht-success-bg)',
    badgeBgError: 'var(--ht-error-bg)',
    info: 'var(--ht-green)',
    badgeBgInfo: 'var(--bg-surface)'
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)'
  },
  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px'
  }
} as const;
```

---

### Task 2: Create Shared Style Objects

**Files:**
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\styles.ts`

- [ ] **Step 1: Import tokens and define shared UI styles**

```ts
import { tokens } from './tokens';

export const ui = {
  btn: {
    primary: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: '14px',
      fontWeight: 700,
      cursor: 'pointer',
      border: 'none',
      color: tokens.colors.textPrimary,
      background: tokens.colors.primary,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm
    },
    outline: {
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      border: `1px solid ${tokens.colors.border}`,
      color: tokens.colors.textSecondary,
      background: tokens.colors.surface,
      display: 'flex',
      alignItems: 'center',
      gap: tokens.spacing.sm
    },
    danger: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.lg}`,
      borderRadius: tokens.radius.md,
      fontSize: '12px',
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      color: tokens.colors.textPrimary,
      background: tokens.colors.error
    }
  },
  card: {
    base: {
      backgroundColor: tokens.colors.surface,
      borderRadius: tokens.radius.lg,
      boxShadow: tokens.shadow.sm,
      border: `1px solid ${tokens.colors.border}`,
      color: tokens.colors.textPrimary
    },
    kpi: {
      background: tokens.colors.surface,
      padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      border: `1px solid ${tokens.colors.border}`,
      boxShadow: tokens.shadow.sm,
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.xs,
      flex: 1
    }
  },
  table: {
    th: {
      padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
      textAlign: 'left',
      fontSize: '11px',
      fontWeight: 700,
      color: tokens.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      borderBottom: `2px solid ${tokens.colors.border}`,
      background: tokens.colors.background,
      cursor: 'pointer',
      userSelect: 'none'
    },
    td: {
      padding: `${tokens.spacing.md} ${tokens.spacing.lg}`,
      fontSize: '13.5px',
      color: tokens.colors.textPrimary,
      borderBottom: `1px solid ${tokens.colors.border}`
    }
  },
  input: {
    base: {
      width: '100%',
      padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
      borderRadius: tokens.radius.lg,
      border: `1px solid ${tokens.colors.border}`,
      fontSize: '14px',
      outline: 'none',
      background: tokens.colors.background,
      color: tokens.colors.textPrimary
    }
  },
  badge: {
    success: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgSuccess,
      color: tokens.colors.success,
      fontSize: '11px',
      fontWeight: 800
    },
    warning: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgInfo,
      color: tokens.colors.warning,
      fontSize: '11px',
      fontWeight: 800
    },
    info: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgInfo,
      color: tokens.colors.info,
      fontSize: '11px',
      fontWeight: 800
    },
    error: {
      padding: `${tokens.spacing.xs} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.md,
      background: tokens.colors.badgeBgError,
      color: tokens.colors.error,
      fontSize: '11px',
      fontWeight: 800
    }
  },
  modal: {
    shell: {
      background: tokens.colors.surface,
      borderRadius: tokens.radius.xl,
      boxShadow: tokens.shadow.md,
      border: `1px solid ${tokens.colors.border}`,
      overflow: 'hidden'
    }
  }
} as const;
```

---

### Task 3: Update Layout and Dashboard to Use Shared Styles

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Layout.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Dashboard.tsx`

- [ ] **Step 1: Replace inline hard-coded colors/radius/shadows with `tokens`/`ui`**

Examples to target:
- Header search input → `ui.input.base`
- Nav active background `#F0FDF4` → `tokens.colors.badgeBgSuccess`
- Button radius/shadows → `ui.btn.primary`
- Dropdown `boxShadow: var(--shadow-lg)` → `tokens.shadow.md`
- KPI cards and containers → `ui.card.base` / `ui.card.kpi`

- [ ] **Step 2: Ensure dark mode backgrounds use tokenized values**

- [ ] **Step 3: Visual sanity check (manual)**

Expected: Layout and Dashboard appear unchanged in structure, with consistent button and card styling.

---

### Task 4: Update Leads, Customers, Users

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Leads.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Customers.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Users.tsx`

- [ ] **Step 1: Replace local `S` style objects with `ui` styles**
- [ ] **Step 2: Normalize KPI border colors to `tokens.colors.info|warning|success|error`**
- [ ] **Step 3: Replace modal hard-coded shadows with `ui.modal.shell`**
- [ ] **Step 4: Replace badges with `ui.badge.*` styles**
- [ ] **Step 5: Verify button text contrast; if unreadable, pause and request approval to introduce a dedicated text-on-primary token**
- [ ] **Step 6: Visual sanity check (manual)**

Expected: All three screens share the same button, card, table, and badge look.

---

### Task 5: Update Secondary Screens for Token Cleanup

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Suppliers.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Products.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Reports.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Settings.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Support.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\EventLog.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Notification.tsx`
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\app.tsx`

- [ ] **Step 1: Replace hard-coded colors/radius/shadows with tokenized values**
- [ ] **Step 2: Where possible, swap to `ui.card.base`, `ui.btn.*`, `ui.table.*`**
- [ ] **Step 3: Manual visual scan for oddities**

---

### Task 6: Static Check for Hard‑Coded Values

**Files:**
- Test: Entire `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src` tree

- [ ] **Step 1: Search for remaining hard-coded colors**

Run (PowerShell):
```powershell
Get-ChildItem -Path "C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src" -Recurse -File |
  Select-String -Pattern "#[0-9a-fA-F]{3,8}\b|rgb\\(|rgba\\(|hsl\\(|hsla\\(|box-shadow:|boxShadow:|borderRadius: '\\d+px'|borderRadius: \"\\d+px\"|borderRadius: \\d+|border-radius: \\d+px"
```

Expected: No hits for UI code except assets or explicitly approved exceptions.

- [ ] **Step 2: Resolve any remaining hits**

---

### Task 7: Final Visual Review Checklist

- [ ] **Step 1:** Buttons consistent across Layout, Leads, Customers, Users.
- [ ] **Step 2:** KPI cards have consistent radius/shadow on Dashboard/Leads/Customers/Users.
- [ ] **Step 3:** Badges consistent across tables and lists.
- [ ] **Step 4:** Validate `tokens.colors.badgeBgInfo` contrast in dark mode; if low, switch to `var(--bg-primary)` per spec.
- [ ] **Step 5:** Dark mode looks consistent (no light-only chips).

---

## Notes
- Git is not initialized in this workspace, so no commits are included.
- If any visual regression is seen, pause and confirm with the user before adjusting mapping.
