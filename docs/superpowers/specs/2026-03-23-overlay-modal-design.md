# Overlay Modal Standardization Design

Date: 2026-03-23

## Overview
Standardize all overlays (modal/dialog/popup) in the CRM frontend so they:
- Close on click outside the modal shell (click-away).
- Avoid input/text overflow inside modal forms.
- Share consistent layout, z-index, and scroll behavior.

## Scope
In scope:
- All overlay/modal implementations in:
  - frontend/src/Customers.tsx
  - frontend/src/Leads.tsx
  - frontend/src/Products.tsx
  - frontend/src/Quotations.tsx
  - frontend/src/Suppliers.tsx
  - frontend/src/Users.tsx
  - frontend/src/Dashboard.tsx (activity details modal)
- Shared UI styles in frontend/src/ui/styles.ts

Out of scope:
- Non-overlay components and notifications/toasts.
- Major visual redesigns.

## Requirements
Functional:
- Any click on backdrop/outside modal shell closes the overlay.
- Clicks inside the modal shell do not close the overlay.
- Existing close buttons continue to work.

UI/UX:
- Modal content is constrained to viewport height with internal scroll if needed.
- Form inputs never overflow their containers.

Technical:
- Use a shared OverlayModal component.
- Avoid duplicate click-away logic in each screen.

## Proposed Design

### New Shared Component
Create a reusable component `OverlayModal` in `frontend/src/ui/OverlayModal.tsx` that provides:
- Full-screen fixed container
- Backdrop layer
- Modal shell container
- Click-away close (backdrop handles onClick)
- `role="dialog"` and `aria-modal="true"`
 - Standardized z-index (use `1100` for the overlay root)

Pseudo-structure:
```
<OverlayModal title="..." onClose={...}>
  {children}
</OverlayModal>
```

Behavior:
- Backdrop `onClick` triggers `onClose`.
- Shell stops propagation via `onClick={(e) => e.stopPropagation()}`.
- Shell constrains height with `maxHeight: 80vh` (or similar) and `overflowY: auto` inside content region.

### Input Overflow Fix
Update `ui.input.base` to include:
- `boxSizing: 'border-box'`
- `minWidth: 0`
- `maxWidth: '100%'`

Where inputs are inside flex rows, ensure the container or input has `minWidth: 0` to avoid overflow.

## Data Flow
No data flow changes. Only UI layer wrapper.

## Error Handling
No new error states. Click-away closes overlay even if unsaved changes; existing behavior persists.

## Testing
Manual checks:
- Open each modal; click outside -> closes.
- Click inside -> stays open.
- Long text in inputs does not overflow the modal.
- Content overflow scrolls within modal content.

## Rollout
Single commit updating:
- Shared component creation
- Modal refactors
- Style updates

## Open Questions
None.
