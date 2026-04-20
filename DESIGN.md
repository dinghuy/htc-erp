# HTC ERP Design System Bridge

## Purpose

This file defines the active UI direction for `frontend/` after the UX/UI rebuild kicked off from the extracted design-system bundle in `tmp/htc-erp-design-system-extracted/`.

The bundle is a visual benchmark and pattern reference. It is **not** a second production design system.

## Source Of Truth

Use these files in this order:

1. `frontend/src/index.css`
2. `frontend/src/ui/tokens.ts`
3. `frontend/src/ui/styles.ts`
4. `frontend/src/ui/patterns.tsx`

Do not copy prototype CSS from `tmp/htc-erp-design-system-extracted/` into production code.

## Visual Direction

- Enterprise premium, not consumer SaaS
- Vietnamese-first operational UI
- Strong hierarchy, quieter decoration
- Tight spacing discipline and scan-first surfaces
- Flat-to-soft surfaces with restrained gradients only on shell and page hero areas

## Shell Grammar

- Sidebar is a stable operational rail, not a marketing canvas
- Topbar is compact and utility-first: search, alerts, theme toggle, account cluster
- App content sits inside one centered shell width and should read as one product across modules
- Shared route framing should come from reusable page primitives, not per-screen one-off headers

## Page Grammar

Use these primitives before inventing new screen structure:

- `PageHero`: primary route framing, top actions, short orientation copy
- `MetricCard`: KPI summaries and cockpit counters
- `PageSectionHeader`: section title + description + optional action
- `EntitySummaryCard`: list and workspace summary unit
- `FilterToolbar`: compact search/filter/control row
- `StatusChipRow`: supporting status and blocker chips

For long modal workflows:

- use one internal sticky rail for modal-local tabs/steps when the content below is long enough to scroll
- sticky rails stay inside the modal scroll container, not the app viewport
- sticky rails are navigation-only by default; do not pack action buttons, hint banners, or dense metadata into the rail

For dense revenue-workflow editors:

- use stacked operational cards when the user is comparing peer options, not tab panels that hide alternatives
- keep calculation or confirmation actions in one editor-local action dock, scoped to the selected card or offer
- use drag handles for reordering peer cards; avoid making inputs or whole forms accidental drag targets
- use inline click-to-detail rows directly beneath the selected line so dense line-item fields stay close to their source row
- hide irrelevant line inputs when a selected mode makes them non-actionable, such as hiding VAT percent for gross-price lines
- distinguish unnamed business options with selected borders and metadata chips in the editor, but do not print fallback technical names in customer-facing previews
- keep bilingual commercial terms as a first-class section, with Vietnamese and English fields visible together

## Language Policy

- UI labels, CTA text, helper text, empty states, loading states, and error copy are Vietnamese first
- English is allowed only when it is a stable module or lane term already grounded in the product
- Do not mix Vietnamese and English inside one control group unless the English term is the canonical system term

## Rollout Rule

- Shared primitives and shell changes land first
- Revenue-flow screens absorb the new grammar before secondary/admin surfaces
- Reuse beats reinvention; deletion beats duplicate styling
