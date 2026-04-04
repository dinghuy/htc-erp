# Content Padding 10px (All Tabs) - Design

## Goal
Remove the empty space at the top of pages by standardizing the main content area padding to 10px on all sides across all tabs.

## Scope
- Adjust only the main content wrapper in `Layout` that renders `{children}` beneath the top header.
- Keep header and sidebar padding unchanged.
- Do not add per-page overrides unless a page has an explicit override that conflicts with the new global padding.

## Approach
- Update the `Layout` content container style from `padding: '32px'` to `padding: '10px'`.
- Verify that no page-level layout wrappers re-introduce extra top padding; if found, align them to the global padding (only if they are explicitly adding extra space).

## Files
- `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\htc-erp\frontend\src\Layout.tsx`

## Success Criteria
- All tabs show reduced top spacing (no large blank area).
- Left/right/bottom spacing is also 10px for consistent alignment.
- No visual regressions in header or sidebar alignment.

## Non-Goals
- No changes to header, sidebar, or component styles.
- No per-page redesign or spacing refactors beyond the main wrapper.

