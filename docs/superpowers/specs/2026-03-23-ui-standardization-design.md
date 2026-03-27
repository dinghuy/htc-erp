# UI Standardization Design (Token-Preserving)

**Date:** 2026-03-23  
**Project:** CRM App Frontend  
**Goal:** Standardize UI across the app while **preserving existing CSS tokens** in `src/index.css` (no new tokens added). Spacing tokens may remain numeric in `tokens.ts` because no spacing CSS vars exist today.

## Summary
We will replace hard-coded colors, radius, shadows, and spacing with existing CSS tokens and shared style objects. The approach keeps current layouts and behavior intact, improves visual consistency, and strengthens dark-mode compatibility.

## Scope
- Replace hard-coded UI values with token-based values.
- Introduce shared UI style objects to reduce duplication.
- Normalize buttons, cards, tables, badges, inputs, and modals.

## Non‑Goals
- No layout redesigns.
- No component behavior changes.
- No palette changes beyond using current tokens.

## Definitions
**Hard-coded styles** include:
- Any hex color (e.g., `#3B82F6`)
- Any `rgba(...)` for UI color/background/shadow
- Any radius values (e.g., `6px`, `10px`, `12px`)
- Any shadow strings not using `var(--shadow-*)`
- Any spacing values for common UI primitives (buttons, cards, tables, badges) that are not defined in `tokens.spacing`

**Exceptions**:
- Image assets (PNG/SVG) and external avatar URLs
- One-off layout spacing only for **page-level containers** (not for buttons/cards/tables/badges/inputs/modals). Any exception must be minimal and visually justified.

## Proposed Architecture
**Source of truth:** `src/index.css` tokens remain unchanged.  
**New files (final API surface):**
- `src/ui/tokens.ts` — central token mappings (colors, radius, shadow, spacing).
- `src/ui/styles.ts` — shared style objects (buttons, cards, tables, badges, inputs, modals).

**Usage pattern:** Feature screens import from `ui/styles` and override only what is screen-specific (e.g., KPI left-border color).

## Components & Style Objects
**Exports (final names, stable API):**
- `tokens.colors`, `tokens.radius`, `tokens.shadow`, `tokens.spacing`
- `ui.btn.primary`, `ui.btn.outline`, `ui.btn.danger`
- `ui.card.base`, `ui.card.kpi`
- `ui.table.th`, `ui.table.td`
- `ui.input.base`
- `ui.badge.success`, `ui.badge.warning`, `ui.badge.info`, `ui.badge.error`
- `ui.modal.shell`

**Type safety:** `tokens` and `ui` objects use `as const` to preserve literal keys.

## Affected Screens (Replace Hard‑Code)
Primary:
- `src/Layout.tsx`
- `src/Dashboard.tsx`
- `src/Leads.tsx`
- `src/Customers.tsx`
- `src/Users.tsx`

Secondary (token cleanup only, no layout changes):
- `src/Suppliers.tsx`
- `src/Products.tsx`
- `src/Quotations.tsx`
- `src/Reports.tsx`
- `src/Settings.tsx`
- `src/Support.tsx`
- `src/EventLog.tsx`
- `src/Notification.tsx`

## Token Mapping (High Level)
- Primary brand: `--ht-green`, `--ht-green-dark`
- Accent/amber: `--ht-amber`, `--ht-amber-dark`
- Surface/text/border: `--bg-*`, `--text-*`, `--border-color`
- Status: `--ht-success-*`, `--ht-error-*`
- Shadow: `--shadow-sm`, `--shadow-md`
  - **Decision:** No new tokens. Replace any `--shadow-lg` usage with `--shadow-md`.
- Radius: `--radius-sm/md/lg/xl`

## Concrete Mapping Table (sample for current hard-codes)
| Hard-coded value | Replace with | Notes |
|---|---|---|
| `#3B82F6` | `tokens.colors.info` | Normalize blue KPI/labels to brand green |
| `#1A73E8` | `tokens.colors.info` | Normalize blue KPI in Leads to brand green |
| `#EAB308` | `tokens.colors.warning` | Normalize amber KPI |
| `#F5A623` | `tokens.colors.warning` | Normalize amber KPI |
| `#EF4444` | `tokens.colors.error` | Danger buttons/badges |
| `#10B981` | `tokens.colors.success` | Success labels |
| `#ECFDF5`, `#EFF6FF`, `#FFFBEB` | `tokens.colors.badgeBg.*` | Replace light-only backgrounds |
| `borderRadius: '6px'` | `tokens.radius.sm` | Buttons and pills |
| `borderRadius: '10px'` | `tokens.radius.lg` | Primary buttons/inputs |
| `borderRadius: '12px'` | `tokens.radius.lg` | Cards/modals (if standardized) |
| `boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)'` | `tokens.shadow.md` | Use existing token only |

**Full mapping will be enforced during implementation via replacement pass.**

## Data Flow / Logic
No data or business logic changes. Only style objects are centralized.  
Runtime behavior stays the same; only render styles are updated.

## Error Handling
None required beyond existing behavior. If a style token is missing, the browser falls back to default CSS behavior, but we will ensure all tokens referenced exist.

## Testing & Verification
Manual visual verification:
- Compare key screens before/after: Layout, Dashboard, Leads, Customers, Users.
- Validate dark-mode background and badge colors.
- Confirm tables/buttons maintain consistent spacing and radius.

**Acceptance checklist (visual):**
- Buttons: same height, radius, and hover feel across primary screens.
- Cards/KPI: same shadow and radius across Dashboard/Leads/Customers/Users.
- Badges: same padding and font size across lists/tables.
- Dark mode: no light-only background chips remain.

Optional: snapshot tests if present (none required by this spec).

**Static check (manual grep):**
- Search in `src` for `#`, `rgb(`, `rgba(`, `hsl(`, `hsla(`, and `box-shadow:` strings.
- Ensure no new hard-coded color/radius/shadow appears in `*.tsx`, `*.ts`, `*.css`.

**Guardrail (process):**
- Before finishing, run the static check and confirm any remaining matches are legitimate exceptions.

## Risks & Mitigations
- **Risk:** Missing token variables (e.g., `--shadow-lg`) due to prior usage.  
  **Mitigation:** Replace those usages with `--shadow-md` (no new tokens).
- **Risk:** Inconsistent spacing between screens after refactor.  
  **Mitigation:** Use `tokens.spacing` values uniformly.
- **Risk:** Visual regressions in dark mode.  
  **Mitigation:** Replace light hard-coded backgrounds with semantic tokens.

## Rollout Plan
1. Add `tokens.ts` and `styles.ts`.
2. Replace styles in primary screens.
3. Replace hard-coded values in secondary screens.
4. Manual visual pass (light/dark).
5. If regressions found, revert the most recent screen batch and adjust mapping based on user confirmation.

## Success Criteria
- No hard-coded hex colors in UI components (except images/icons).
- Buttons, cards, tables, badges have consistent radius, shadow, and spacing.
- Dark mode visually consistent with no “light-only” hard-coded backgrounds.

## Baseline Hard‑Code Locations (current)
Initial files with hard-coded UI values (from pre-check):
- `src/app.tsx`
- `src/Customers.tsx`
- `src/Dashboard.tsx`
- `src/EventLog.tsx`
- `src/Layout.tsx`
- `src/Leads.tsx`
- `src/Users.tsx`
- `src/Products.tsx`
- `src/Suppliers.tsx`
- `src/Quotations.tsx`
- `src/Reports.tsx`
- `src/Settings.tsx`
- `src/Support.tsx`
- `src/Notification.tsx`

This list will be validated with the static check before implementation begins.
## Token Aliases (explicit mapping in `tokens.ts`)
- `tokens.colors.primary` → `var(--ht-green)`
- `tokens.colors.primaryDark` → `var(--ht-green-dark)`
- `tokens.colors.warning` → `var(--ht-amber)`
- `tokens.colors.warningDark` → `var(--ht-amber-dark)`
- `tokens.colors.textPrimary` → `var(--text-primary)`
- `tokens.colors.textSecondary` → `var(--text-secondary)`
- `tokens.colors.textMuted` → `var(--text-muted)`
- `tokens.colors.surface` → `var(--bg-surface)`
- `tokens.colors.background` → `var(--bg-primary)`
- `tokens.colors.border` → `var(--border-color)`
- `tokens.colors.success` → `var(--ht-success-text)`
- `tokens.colors.error` → `var(--ht-error-text)`
- `tokens.colors.badgeBgSuccess` → `var(--ht-success-bg)`
- `tokens.colors.badgeBgError` → `var(--ht-error-bg)`
- `tokens.colors.info` → `var(--ht-green)` (unify prior blue accents to brand green)
- `tokens.colors.badgeBgInfo` → `var(--bg-surface)` (validate contrast in dark mode; if too low, fallback to `var(--bg-primary)`)

**Radius / Shadow / Spacing aliases:**
- `tokens.radius.sm` → `var(--radius-sm)`
- `tokens.radius.md` → `var(--radius-md)`
- `tokens.radius.lg` → `var(--radius-lg)`
- `tokens.radius.xl` → `var(--radius-xl)`
- `tokens.shadow.sm` → `var(--shadow-sm)`
- `tokens.shadow.md` → `var(--shadow-md)`
- `tokens.spacing.xs` → `4px`
- `tokens.spacing.sm` → `8px`
- `tokens.spacing.md` → `12px`
- `tokens.spacing.lg` → `16px`
- `tokens.spacing.xl` → `24px`
