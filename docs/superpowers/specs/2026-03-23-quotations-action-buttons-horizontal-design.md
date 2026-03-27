# Quotations Action Buttons Horizontal Layout

## Goal
Display the two action buttons (Save Draft / Export PDF) side-by-side horizontally, and allow them to wrap onto a new line automatically when the container is too narrow.

## Context
The action buttons live in the `actionButtons` panel within `frontend/src/Quotations.tsx` and currently render in a vertical column. The user wants a horizontal layout across all breakpoints, with automatic wrapping on narrow screens.

## Requirements
- Buttons are laid out horizontally in the action panel.
- When there is not enough width, buttons wrap to the next line automatically.
- Applies to desktop and mobile.
- Preserve existing button styles and inline style pattern.
- No new CSS classes or global styles.

## Proposed Solution (Chosen)
Use a flex container with wrapping:
- `display: 'flex'`, `flexDirection: 'row'`, `flexWrap: 'wrap'`, and `gap: '12px'`.
- Give each button flexible sizing to allow wrapping: `flex: '1 1 220px'` (or similar) and/or `minWidth`.
- Keep existing button styling intact.

## Acceptance Criteria
- On wide screens, two buttons appear in a single row.
- On narrow screens, the buttons wrap to two rows without overflow.
- No visual regressions in the preview panel or other parts of the layout.
