# HTC ERP App Shell Design System Spec

## Context

This spec defines the first rollout slice for implementing the exported `HTC ERP Design System` handoff bundle into the existing `htc-erp` frontend. The approved direction is **token-first, shell-later** with the first visible target being the **global app shell** rather than individual business screens.

The handoff bundle establishes a restrained B2B industrial ERP visual language:
- Roboto-first typography
- HTC green as the primary accent
- flat light/dark shell surfaces with clear borders
- low-drama motion and hover states
- compact, professional hierarchy for dense operational UI

This spec intentionally avoids deep screen-specific redesign in the first pass. It focuses on the shell and the shared foundations that screens inherit.

## Goal

Make the current HTC ERP app shell visually align with the exported design system while minimizing business-flow risk.

The first slice must produce these outcomes:
- shared tokens and base styles match the design handoff closely
- the shell (`Layout.tsx`) reflects the design language clearly in desktop and mobile states
- existing feature screens inherit the updated design language without requiring immediate per-screen rewrites
- route logic, data flows, and screen-specific business behavior remain unchanged

## Scope

### In scope

Foundation and shell files only:
- `frontend/src/index.css`
- `frontend/src/ui/tokens.ts`
- `frontend/src/ui/styles.ts`
- `frontend/src/Layout.tsx`

Visual work included in this slice:
- typography normalization to Roboto-first
- color, surface, border, radius, shadow, overlay, and focus-ring alignment
- shared button/input/card/badge style alignment
- shell layout alignment for sidebar, top header, content frame, and mobile drawer
- dark mode token parity using the same token path

### Explicitly out of scope for this slice

Do not redesign these internals in this pass unless shell styling forces trivial compatibility tweaks:
- Products/Equipment workspace internals
- Projects workspace internals
- Quotations workspace internals
- route behavior and permissions
- backend or API contracts
- shared client/network behavior
- non-shell overlay behavior changes unless needed to preserve shell visual consistency

## Implementation Strategy

### Strategy choice

Approved approach: **token-first, shell-later**.

This means the implementation proceeds in two layers:

1. **Foundation layer**
   - update global CSS variables and token mappings so the design language exists as the system of record
   - align shared style primitives so buttons, cards, inputs, badges, overlays, and page shells inherit the new visual rules

2. **Shell layer**
   - apply those updated primitives to `Layout.tsx`
   - update sidebar, header, nav states, content frame, and mobile drawer to match the design handoff as closely as possible without rewriting feature screens

This approach is preferred over a full shell rewrite because the app is still in a hybrid route/screen migration state. Updating the foundation first lowers blast radius while still making the shell visibly correct.

## Visual Specification

### Typography

Typography must follow the exported design language:
- Primary font: `Roboto`
- Fallbacks may remain `Inter, sans-serif`
- Body text: 14px regular/medium
- Labels and meta: 10–11px, extra-bold, uppercase, expanded tracking
- Section and page headings: 18/24/26/28/30 scale depending on hierarchy
- Tone must read as enterprise ERP, not consumer SaaS or marketing UI

Rules:
- no decorative fonts
- no serif usage
- no playful typographic experiments
- maintain concise all-caps treatment for section labels, table headers, and form labels where the existing UX already uses that pattern

### Color system

The shell must align to the handoff’s palette:
- Primary green: `#009B6E`
- Primary hover/darker green: `#007A56`
- Light page background: `#F8FAFC`
- Light surface/card background: `#FFFFFF`
- Light border: `#E2E8F0`
- Dark page background: `#0F172A`
- Dark surface/card background: `#1E293B`
- Dark border: `#334155`

Semantic states should follow the handoff rather than ad hoc local choices:
- success: green-tinted positive surface and text
- error: red-tinted surface and text
- warning: amber surface and text
- info: green/teal-tinted informational accents

No net-new palette should be invented in this slice. Existing tokens should be remapped or extended only where needed to express the handoff faithfully.

### Surface language

The app shell should look restrained and operational:
- flat page background
- flat or nearly flat cards and shell surfaces
- clear 1px borders
- light shadow only where elevation is needed
- strong gradients avoided in the main app shell

Allowed gradients in this slice:
- auth shell gradient may remain strong
- subtle shell tints such as hero or drawer-header accents may remain if they match the handoff and stay understated

Disallowed in this slice:
- consumer-style glossy surfaces
- decorative background meshes
- playful or high-contrast visual flourishes that break the industrial ERP tone

### Motion and interaction

Motion should remain minimal and functional:
- normal transitions: `0.2s ease`
- theme transitions: `0.3s ease` for background/text shifts
- drawer slide: simple ease transition
- no spring or bounce
- no ornamental animation in shell navigation

Hover behavior must be subtle and utility-focused:
- nav item hover: soft success-tinted background, green emphasis
- active nav item: clear green emphasis with a right-edge or equivalent active indicator
- buttons: simple color and border-state shifts only

### Focus and accessibility

Focus styling must be standardized:
- 2px HTC green focus outline
- visible outline offset
- shared token-driven focus ring

Dark mode must remain token-driven through the existing `.dark` mechanism rather than a second styling path.

## Shell Layout Specification

### Sidebar

Desktop sidebar should align closely to the handoff:
- width approximately 240px
- `bg-surface` background
- right border using standard border token
- grouped nav sections with uppercase labels and muted text
- active item highlighted with primary green and a strong active indicator

Sidebar behavior should remain structurally consistent with the current codebase. This slice updates visual presentation, not navigation architecture.

### Header

Desktop top header should align closely to the handoff:
- approximately 64px high
- flat surface background
- clear lower border or separation from content
- restrained iconography and actions
- search/header actions should feel compact and operational rather than airy or decorative

### Content frame

The shell content container should use:
- centered shell width near the current 1400px convention
- 16–28px content padding depending on viewport
- clear spacing between page shell sections
- no special shell background effects beyond tokenized surfaces and borders

### Mobile shell

Mobile shell should preserve existing behavior while matching the new visual language:
- drawer-based nav remains
- drawer slide stays simple
- spacing, borders, icons, and typography reflect the same shell system as desktop
- no route logic changes

## File-by-File Design Intent

### `frontend/src/index.css`
- make CSS variables the primary source of truth for the new handoff-aligned token values
- ensure light and dark values mirror the exported bundle closely
- keep semantic aliases clear enough for `tokens.ts` to consume without local hex duplication elsewhere
- normalize global typography and base element defaults where appropriate

### `frontend/src/ui/tokens.ts`
- expose the handoff-aligned semantic token layer used by TSX
- preserve compatibility for existing callers where practical
- add or refine token names only when necessary to express the shell design cleanly

### `frontend/src/ui/styles.ts`
- update shared primitives to reflect the new shell language
- buttons, cards, table surfaces, inputs, badges, page shell primitives, modal shell, overlay primitives, and form labels should visually align to the handoff
- avoid feature-specific styling decisions here

### `frontend/src/Layout.tsx`
- apply the new shell primitives to the global layout
- align sidebar, nav groups, header, search, user area, and mobile drawer visually to the handoff
- preserve route handling, search behavior, permissions, notifications, and responsive logic

## Non-Goals

This slice is not expected to make every screen pixel-close to the bundle immediately.

It is acceptable for interior screen content to remain structurally legacy after this pass as long as:
- the shell clearly matches the design system
- shared primitives are aligned
- no screen is visually broken by the new foundation

## Verification Strategy

### Required verification

Run the narrowest relevant verification for this slice:
- frontend typecheck
- frontend build
- browser/UAT verification for shell behavior

### Required UAT views

Check these shell states:
- desktop light mode
- desktop dark mode
- mobile light mode
- mobile dark mode

### Required UX checks

Validate:
- sidebar width, grouping, active state, and hover state
- header height, spacing, and alignment
- search/header controls still usable
- content frame spacing remains stable
- drawer/mobile nav still opens, closes, and locks focus/scroll as expected
- no obvious regressions in one or two representative feature screens rendered inside the new shell

## Risks and Mitigations

### Risk: shell tokens break interior screens
Mitigation:
- keep token names stable where possible
- use semantic remapping instead of broad primitive deletion
- verify representative screens after shell changes

### Risk: hybrid route architecture makes shell rewrite brittle
Mitigation:
- do not rewrite route structure
- do not change navigation information architecture in this slice
- keep `Layout.tsx` behavior intact and update presentation only

### Risk: design drift between exported bundle and implementation
Mitigation:
- treat the exported bundle as the visual source of truth for this slice
- prefer exact value adoption for typography, palette, spacing intent, border treatment, and shell proportions where compatible with the codebase

## Acceptance Criteria

This design is considered implemented correctly when:
- Roboto-first typography is active and consistent in the shell
- light/dark shell surfaces, borders, and text hierarchy match the handoff closely
- sidebar/header/content shell read as the HTC ERP handoff, not the prior shell style
- shared shell primitives reflect the same restrained B2B industrial language
- no business workflow or route logic changes are introduced
- frontend build and shell UAT evidence are collected

## Deferred Follow-Up After This Slice

Once the shell foundation is stable, later slices may target:
- Products workspace internals
- Projects workspace internals
- Quotations workspace internals
- dashboard and report surfaces
- deeper component parity for tables, forms, and content panels inside feature screens
