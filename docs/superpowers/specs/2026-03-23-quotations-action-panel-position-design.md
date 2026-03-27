# Quotations Action Panel Placement (Right Column)

## Goal
Move the two action buttons (Save Draft / Export PDF) to sit above the Preview panel in the right column, so the preview never overlaps the buttons while scrolling. The preview should be pushed down accordingly.

## Context
Screen: Quotations detail view with two-column layout.
Right column currently contains the preview panel and action buttons. Scrolling causes the preview to overlap the buttons.
User request: keep actions in the right column, positioned directly above the preview panel.

## Requirements
- Place the action panel immediately above the preview panel within the right column.
- Ensure the preview is visually pushed down; it must not overlap the action buttons when scrolling.
- Desktop behavior: keep the two-column layout; actions remain in the right column.
- Mobile behavior: keep existing mobile layout (actions below the active tab content).
- Keep inline style patterns consistent with the current file.
- No extra UI features or layout refactors.

## Proposed Solution (Chosen)
Option 1: Right-column action panel sits above preview and is sticky within the right column.
- In the right column wrapper, render the action panel before the preview panel.
- Make the action panel sticky with `top: 24px` (matching existing spacing), so it stays visible and does not get overlapped.
- Adjust the preview panel to use `top` offset (or keep it non-sticky) to avoid overlapping the sticky action panel.
- Ensure z-index layering favors the action panel if needed.

## Desktop Layout
Right column order:
1) Action panel (sticky)
2) Preview panel (sticky or non-sticky, but below the action panel)

## Mobile Layout
No change. Mobile keeps the current tab-based layout:
- Form tab: form + action panel
- Preview tab: preview panel + action panel

## Non-Goals
- No global header changes
- No new buttons or features
- No refactor of preview rendering

## Acceptance Criteria
- On desktop, action buttons appear above the preview in the right column.
- On scroll, the preview never visually covers the buttons.
- Mobile layout remains unchanged.
