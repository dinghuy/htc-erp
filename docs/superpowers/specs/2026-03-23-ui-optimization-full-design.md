# UI Optimization (Full App) Design

**Date:** 2026-03-23  
**Project:** CRM App Frontend  
**Goal:** Optimize UI across the entire app with a unified design system using shared tokens/styles, Roboto-only typography, and clearer motion feedback.

---

## Scope
- Entire frontend UI (`frontend/src/**`), including shared UI modules and shell components.
- Standardize typography, buttons, forms, modals, tables, badges, spacing, and micro-interactions.
- Enforce use of `tokens` + `ui/styles` (no hard-coded hex/radius/shadow in UI components).
- Update global typography at stylesheet entrypoints (`frontend/src/index.css` and any global style files used by the app, e.g. `frontend/src/app.css` or font definitions in `frontend/src/main.tsx` if present).
- Included UI primitives: navigation/sidebar, header tabs, buttons, inputs/selects/textareas, tables, badges, cards/KPIs, modals, toasts/notifications, empty states, pagination, dropdowns/menus, icon-only controls.
- Excluded: third-party embedded widgets and vendor CSS unless explicitly overridden in our code (see Exceptions).

## Non‑Goals
- No feature changes or new flows.
- No layout redesign beyond spacing and style consistency.
- No control addition/removal, no route changes, no reordering of major regions, and no screen-level layout restructuring (shell components may receive spacing/typography/visual polish only).
- No palette changes beyond mapping to existing semantic tokens.

---

## 1. Typography (Roboto-only)
- Global font family: `Roboto, sans-serif`.
- Font source: include Roboto in `frontend/src/index.css` via a Google Fonts import.
  Example:
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800&display=swap');
  :root { font-family: 'Roboto', sans-serif; }
  ```
- Fallback while loading: `sans-serif`. After `document.fonts.ready`, computed font-family must include `Roboto` as the first font on key screens.
- Standard sizes:
  - H1: 28–32px, weight 800
  - H2: 20–24px, weight 700
  - Body: 13–15px, weight 400–600
  - Label: 11–12px, weight 700–800
- Apply to page titles, section headers, table headers, inputs, and badges.

## 2. Tokens & Shared UI Styles
**Enforce use of:**
- `src/ui/tokens.ts` for all colors/radius/shadows/spacing
- `src/ui/styles.ts` for reusable component styles

### Token additions
- Add CSS variable `--text-on-primary` in `frontend/src/index.css`.
- `tokens.colors.textOnPrimary` maps to `var(--text-on-primary)` and must meet WCAG AA contrast on `--ht-green` in light and dark mode.

### UI style additions
- Required shared style inventory (must exist and be used):
  - `ui.btn.primary`, `ui.btn.outline`, `ui.btn.danger`, `ui.btn.ghost`
  - `ui.card.base`, `ui.card.kpi`
  - `ui.table.thStatic`, `ui.table.thSortable`, `ui.table.td`, `ui.table.row`
  - `ui.input.base`
  - `ui.badge.success`, `ui.badge.warning`, `ui.badge.error`, `ui.badge.info`, `ui.badge.neutral`
  - `ui.modal.shell`
  - `ui.form.label`, `ui.form.help`, `ui.form.error`

**Rule:** All buttons, badges, cards, tables, inputs, modals must use tokens/styles. No hard-coded hex/rgba unless in PDFs/images.

## 3. Buttons
- Primary / Outline / Danger / Ghost standardized:
  - Same radius, font size, padding, and transitions
  - Primary uses `textOnPrimary`
  - Ghost uses transparent background with hover state

## 4. Forms & Validation
- Standard label style for every field
- Standard helper text and error text styles
- Inputs/selects/textareas use `ui.input.base`

## 5. Modals
- Use `ui.modal.shell` and shared overlay
- Footer actions aligned right with consistent spacing

## 6. Spacing Scale
- Use `tokens.spacing` values only
- Page containers should not introduce arbitrary spacing

## 7. Tables
- Header style `ui.table.thStatic` for non-sortable columns
- Header style `ui.table.thSortable` for sortable columns (pointer cursor + userSelect disabled)
- Body cell style `ui.table.td`
- Optional `ui.table.row` for hover highlight

## 8. Badges / Status
- Standard badge styles: success / warning / error / info
- Same padding, radius, fontWeight
- Add a neutral/default badge for states like Draft/Inactive
- Status mapping (normative):
  - Draft -> neutral
  - Sent -> info
  - Accepted -> success
  - Rejected -> error
  - Active -> success
  - Expired/Inactive -> neutral
- Fallback: unknown/other -> neutral
- Rule: all other statuses default to neutral unless added to the mapping table.

## 9. Section Headers
- H1 + subtitle spacing standardized
- Icon spacing consistent with typography scale

## 10. Motion & Interaction
- Clearer hover/active states:
  - Buttons: 150–200ms transitions, subtle lift/brightness
  - Cards: subtle shadow/translate
  - Table rows: background highlight
- Respect `prefers-reduced-motion`

## 11. Accessibility (Minimum)
- Focus-visible styles on all interactive elements (buttons, links, inputs, icon-only controls).
- Keyboard operability for all interactive controls.
- Disabled states visually distinct.
- WCAG AA contrast for all interactive text/icons, not just `textOnPrimary`.

## 12. Responsive Behavior
- Keep existing responsive behavior and breakpoints.
- No layout redesign for smaller screens.
- Ensure spacing and typography remain readable on common laptop widths and smaller screens.

---

## Files
- `frontend/src/ui/tokens.ts`
- `frontend/src/ui/styles.ts`
- All UI sources in `frontend/src/**` including:
  - `frontend/src/Layout.tsx`
  - `frontend/src/Notification.tsx`
  - `frontend/src/main.tsx` (if applicable)
  - `frontend/src/index.css` and any global CSS files

---

## Success Criteria
- Roboto-only typography applied globally (computed font on key screens shows Roboto after load)
- No hard-coded hex/rgba/radius/shadow values remain in UI components (except PDF preview and assets)
- All common UI primitives use shared styles (`ui/styles`)
- Hover/active transitions for buttons/cards/tables are 150–200ms
- Reduced-motion disables transform/transition effects
- Key screens verified:
  - Dashboard
  - Sales/Quotations
  - Leads
  - Customers/Contacts
  - Products
  - Suppliers
  - EventLog
  - Users
  - Reports
  - Settings
  - Support
- Focus-visible ring present on all interactive elements (visual check on buttons, links, icon-only controls)
- Disabled states visibly distinct from enabled states
- Contrast check: text on primary and status badges meets WCAG AA in light and dark mode (manual spot check)

## Verification
- Manual visual pass on key screens at viewports: `1440x900`, `1280x800`, `390x844`.
- Font verification: wait for `document.fonts.ready` then check `getComputedStyle(document.body).fontFamily` includes `Roboto`.
- Static check for `#`, `rgb`, `rgba`, `hsl`, `hsla`, `box-shadow` across `frontend/src/**` with allowlist:
  - `frontend/src/ui/tokens.ts`
  - `frontend/src/ui/styles.ts`
  - `frontend/src/index.css` (CSS variable declarations)
  - `frontend/src/Quotations.tsx` (PDF preview section only)
  - assets (PNG/SVG)

---

## Notes
- PDF preview in Quotations is allowed to keep print colors.
- Any exceptions must be documented inline.
## Exceptions (Canonical)
- Third-party library CSS or generated assets are out of scope unless explicitly overridden in our code.
- Charts configuration and SVG fills may keep non-token colors.
- External avatar URLs are allowed.
- PDF preview in Quotations may keep print colors.
- Static scan rule: all files in `frontend/src/**` must be free of hard-coded color/radius/shadow values **except** the allowlist above.
