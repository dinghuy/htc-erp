# Overlay Modal Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize all overlays to close on click-away and prevent input/text overflow via a shared `OverlayModal` component and input style fixes.

**Architecture:** Introduce a shared `OverlayModal` component in `frontend/src/ui/OverlayModal.tsx` that handles backdrop, click-away, header, and scrollable body. Refactor existing modals across screens to use this component, and update base input styles to avoid overflow.

**Tech Stack:** Preact, TypeScript, Vite.

---

## File Structure & Responsibilities
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\OverlayModal.tsx` — shared overlay wrapper.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\styles.ts` — base input overflow fixes.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Customers.tsx` — replace local `ModalWrapper` with `OverlayModal`.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Leads.tsx` — replace local `Modal` with `OverlayModal`.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Products.tsx` — replace local `Modal` with `OverlayModal`.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx` — replace local `ProductModal` wrapper with `OverlayModal`.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Suppliers.tsx` — replace local `Modal` with `OverlayModal`.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Users.tsx` — replace local `ModalWrapper` with `OverlayModal`.
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Dashboard.tsx` — replace inline Activity Details modal with `OverlayModal`.

---

### Task 1: Add Shared `OverlayModal`

**Files:**
- Create: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\OverlayModal.tsx`

- [ ] **Step 1: Write a minimal component scaffold (no behavior yet)**

```tsx
import { tokens } from './tokens';
import { ui } from './styles';

type OverlayModalProps = {
  title: string;
  onClose: () => void;
  children: preact.ComponentChildren;
  maxWidth?: string;
};

export function OverlayModal({ title, onClose, children, maxWidth = '600px' }: OverlayModalProps) {
  return (
    <div>
      {title}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add overlay structure + click-away behavior**

```tsx
export function OverlayModal({ title, onClose, children, maxWidth = '600px' }: OverlayModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', inset: 0, background: tokens.colors.textPrimary, opacity: 0.7 }} />
      <div
        style={{
          ...ui.modal.shell,
          width: '100%',
          maxWidth,
          position: 'relative',
          zIndex: 1,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${tokens.colors.border}`,
            background: tokens.colors.background,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: tokens.colors.textMuted }}
          >
            &times;
          </button>
        </div>
        <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Ensure type import exists**

```tsx
import type { ComponentChildren } from 'preact';
```

Update props type accordingly:

```tsx
type OverlayModalProps = {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  maxWidth?: string;
};
```

- [ ] **Step 4: Manual visual check**

Run: `npm run dev` in `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend` and open any screen that will use the modal once wired. Expected: overlay fills screen, backdrop dims, header visible.

- [ ] **Step 5: Skip commit here** — single final commit in Task 10.

---

### Task 2: Fix Base Input Overflow Styles

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\styles.ts`

- [ ] **Step 1: Add box sizing and width guards**

```ts
input: {
  base: {
    width: '100%',
    padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
    borderRadius: tokens.radius.lg,
    border: `1px solid ${tokens.colors.border}`,
    fontSize: '14px',
    outline: 'none',
    background: tokens.colors.background,
    color: tokens.colors.textPrimary,
    boxSizing: 'border-box',
    minWidth: 0,
    maxWidth: '100%'
  }
}
```

- [ ] **Step 2: Audit all screens for flex-row inputs and add `minWidth: 0` as needed**

Example in `Customers.tsx` (Add/Edit Contact rows):

```tsx
<div style={{ display: 'flex', gap: '10px', minWidth: 0 }}>
  <select ... style={{ ...S.input, width: '100px' }} />
  <input ... style={{ ...S.input, flex: 1, minWidth: 0 }} />
</div>
```

- [ ] **Step 3: Skip commit here** — single final commit in Task 10.

---

### Task 3: Refactor `Customers` Modals to `OverlayModal`

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Customers.tsx`

- [ ] **Step 1: Replace `ModalWrapper` with `OverlayModal`**

Changes:
- Remove local `ModalWrapper` component.
- Add `import { OverlayModal } from './ui/OverlayModal';`.
- Replace `<ModalWrapper ...>` with `<OverlayModal ...>`.

Example replacement:

```tsx
<OverlayModal title="🏢 Thêm Khách hàng mới" onClose={onClose} maxWidth="600px">
  ...
</OverlayModal>
```

- [ ] **Step 2: Manual check**

Open Customers screen; verify all customer/contact/history/event modals close on click-away and scroll correctly.

- [ ] **Step 3: Skip commit here** — single final commit in Task 10.

---

### Task 4: Refactor `Leads` Modals to `OverlayModal`

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Leads.tsx`

- [ ] **Step 1: Remove local `Modal` and replace with `OverlayModal`**

Example replacement:

```tsx
<OverlayModal title="🎯 Thêm Lead mới" onClose={onClose} maxWidth="560px">
  ...
</OverlayModal>
```

- [ ] **Step 2: Manual check**

Open Leads screen; verify Add/Edit/Log modals close on click-away.

- [ ] **Step 3: Skip commit here** — single final commit in Task 10.

---

### Task 5: Refactor `Products` Modals to `OverlayModal`

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Products.tsx`

- [ ] **Step 1: Replace local `Modal` with `OverlayModal`**

Example replacement:

```tsx
<OverlayModal title="📦 Thêm Sản phẩm mới" onClose={onClose} maxWidth="480px">
  ...
</OverlayModal>
```

- [ ] **Step 2: Manual check**

Open Products screen; verify Add/Edit/Detail modals close on click-away.

- [ ] **Step 3: Skip commit here** — single final commit in Task 10.

---

### Task 6: Refactor `Quotations` Product Modal to `OverlayModal`

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx`

- [ ] **Step 1: Replace local modal wrapper with `OverlayModal`**

Example replacement:

```tsx
<OverlayModal title="📦 Chọn Sản phẩm" onClose={onClose} maxWidth="520px">
  ...
</OverlayModal>
```

- [ ] **Step 2: Manual check**

Open Quotations screen; open product selection modal; verify click-away closes.

- [ ] **Step 3: Skip commit here** — single final commit in Task 10.

---

### Task 7: Refactor `Suppliers` Modals to `OverlayModal`

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Suppliers.tsx`

- [ ] **Step 1: Replace local `Modal` with `OverlayModal`**

Example replacement:

```tsx
<OverlayModal title="🤝 Thêm Nhà cung cấp / Vendor" onClose={onClose} maxWidth="560px">
  ...
</OverlayModal>
```

- [ ] **Step 2: Manual check**

Open Suppliers screen; verify Add/Edit/Quote modals close on click-away.

- [ ] **Step 3: Skip commit here** — single final commit in Task 10.

---

### Task 8: Refactor `Users` Modals to `OverlayModal`

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Users.tsx`

- [ ] **Step 1: Replace `ModalWrapper` with `OverlayModal`**

Example replacement:

```tsx
<OverlayModal title="👥 Thêm Nhân viên mới" onClose={onClose} maxWidth="600px">
  ...
</OverlayModal>
```

- [ ] **Step 2: Manual check**

Open Users screen; verify Add/Edit modals close on click-away.

- [ ] **Step 3: Skip commit here** — single final commit in Task 10.

---

### Task 9: Refactor `Dashboard` Activity Details Modal to `OverlayModal`

**Files:**
- Modify: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Dashboard.tsx`

- [ ] **Step 1: Replace inline modal markup**

Example replacement:

```tsx
{selectedActivity && (
  <OverlayModal title={selectedActivity.title} onClose={() => setSelectedActivity(null)} maxWidth="450px">
    ...existing content...
    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
      <button onClick={() => setSelectedActivity(null)} ...>Đóng</button>
      ...
    </div>
  </OverlayModal>
)}
```

Preserve any existing close buttons inside the modal body (or rewire them to `onClose`) to satisfy the requirement that close buttons continue working.

- [ ] **Step 2: Manual check**

Open Dashboard; click activity; verify click-away closes and content scrolls if needed.

- [ ] **Step 3: Skip commit here** — single final commit in Task 10.

---

### Task 10: Final Manual Verification

- [ ] **Step 1: Run build (optional)**

Run: `npm run build` in `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend`
Expected: build completes without errors.

- [ ] **Step 2: Full UI check**

Confirm on each screen:
- Click outside overlay closes it.
- Click inside overlay does not close.
- Long input values do not overflow their containers.

- [ ] **Step 3: Commit** (skip if repo isn’t a git workspace)

```bash
git add C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\OverlayModal.tsx \
  C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\ui\styles.ts \
  C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Customers.tsx \
  C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Leads.tsx \
  C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Products.tsx \
  C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Quotations.tsx \
  C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Suppliers.tsx \
  C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Users.tsx \
  C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\crm-app\frontend\src\Dashboard.tsx

git commit -m "feat: standardize overlay modals"
```
