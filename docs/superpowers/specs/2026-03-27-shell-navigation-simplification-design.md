# Shell Navigation Simplification Design

Date: 2026-03-27
Status: Proposed
Scope: `frontend/src/Layout.tsx`, shell-level navigation chrome, mobile drawer behavior

## Problem

The current workspace shell feels crowded because it exposes multiple competing navigation layers at the same time:

- left sidebar with sectioned module links
- top header tabs for `Workspace`, `Master data`, `Admin`
- global search in the same visual band
- shell actions like theme, notifications, chat, and profile
- preview banner when role preview is active

On mobile, the drawer repeats the same taxonomy and adds another tab row, which increases cognitive load before the user reaches actual page content.

## Goal

Reduce UI noise in the workspace shell without changing route protection, permissions, or business flows.

Success criteria:

- one primary navigation source on desktop
- one consistent navigation pattern shared by desktop and mobile
- header reserved for utility actions, not primary wayfinding
- less chrome above the fold on mobile
- no change to allowed module gating or route resolution

## Chosen Approach

Keep the left sidebar as the single primary navigation surface.

What changes:

- remove desktop top header tabs as a navigation control
- reorganize sidebar into three explicit groups:
  - `Workspace`
  - `Master data`
  - `Admin`
- keep current items and permission gating, but render them under those group labels instead of splitting wayfinding across sidebar and header
- keep the global search in the header
- keep utility actions in the header:
  - theme toggle
  - notifications
  - ops chat shortcut
  - profile summary
- simplify the mobile drawer to mirror the same grouped sidebar structure and remove the extra tab-pill row

## Why This Approach

This is the lowest-risk path that removes the main source of confusion without rewriting route logic.

Benefits:

- clearer information architecture
- less duplicated navigation state
- smaller mobile header and less repeated chrome
- preserves existing role-based visibility model
- avoids a broad refactor of content modules

Trade-offs:

- sidebar becomes the main orientation tool, so section labels and spacing need to be clearer
- users who relied on top tabs lose one shortcut layer, but the result is more coherent

## Information Architecture

### Desktop

- Sidebar:
  - brand
  - grouped navigation
  - primary CTA if allowed (`Tạo deal`)
  - logout
- Header:
  - global search
  - utility actions
  - profile
- Main content:
  - unchanged for this pass

### Mobile

- Header:
  - menu button
  - search
  - utility actions
  - compact profile
- Drawer:
  - grouped navigation only
  - no duplicated tab pills
  - same item order and grouping as desktop
- Main content:
  - gains more above-the-fold space because shell chrome is reduced

## Layout Rules

- Only one visual element should read as “where I go next”: the sidebar/drawer navigation.
- Search should read as retrieval, not navigation.
- Utility icons should remain secondary and visually quieter than navigation.
- Group labels should create hierarchy but not compete with page titles.
- Active route styling should remain strong and localized to the nav item.

## Non-Goals

- redesigning `Home` content density
- changing module names or localization strategy
- changing route protection
- changing role preview flows
- changing notification or chat behavior

Those can be handled in later passes once shell noise is reduced.

## Implementation Outline

1. Remove desktop header tab navigation rendering.
2. Refactor sidebar rendering to include top-level groups:
   - `Workspace`
   - `Master data`
   - `Admin`
3. Reuse the same grouped renderer in mobile drawer.
4. Remove mobile drawer tab pills.
5. Tighten spacing in the mobile header so content starts earlier.
6. Keep all existing test ids for nav items where possible.

## Testing

Manual verification:

- desktop navigation still reaches all allowed modules
- active route remains visible
- mobile drawer opens/closes correctly
- mobile drawer shows same grouped taxonomy as desktop
- search still works
- role preview banner still appears and does not overlap broken header controls

Regression checks:

- existing permission gating still hides unauthorized modules
- `NewDeal` shortcut still works when `Sales` is allowed
- logout still accessible on desktop and mobile

## Risks

- some tests may currently assume presence of header tabs
- users may need one pass to adapt from top tabs to sidebar-only navigation
- if spacing is not tuned carefully, sidebar grouping can become visually long

## Follow-up After This Pass

If shell simplification works, the next pass should reduce `Home` density:

- compress hero actions
- reduce duplicate CTA blocks
- clarify one primary next step per persona
