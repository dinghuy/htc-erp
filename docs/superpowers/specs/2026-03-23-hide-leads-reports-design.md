# Hide Leads/Reports Sidebar Tabs and Block Routes

## Summary
Temporarily hide the Leads and Reports tabs from the sidebar, and prevent direct navigation to those routes by normalizing any attempted access back to Dashboard.

## Scope
- Sidebar: remove Leads and Reports from the navigation list.
- Routing: block rendering of Leads and Reports when accessed directly; redirect to Dashboard.

Out of scope:
- Backend APIs for leads/reports
- Data model changes
- Auth/role-based access

## Proposed Changes
- `frontend/src/Layout.tsx`
  - Remove `Leads` and `Reports` items from the sidebar navigation array.
- `frontend/src/app.tsx`
  - Add a route guard to normalize `currentRoute` when it equals `Leads` or `Reports`.
  - Behavior: set `currentRoute` to `Dashboard` and render Dashboard instead of Leads/Reports.

## Behavior Details
- UI: Leads/Reports links are not visible in the sidebar.
- Direct URL / route access:
  - If the user lands on `Leads` or `Reports`, the app will immediately render Dashboard.

## Data Flow
- `currentRoute` is the single source for page selection.
- A guard runs on render (or via effect) to map disallowed routes to `Dashboard`.

## Error Handling
- None required beyond ensuring the route guard cannot create render loops.

## Testing
- Manual:
  - Sidebar shows no Leads/Reports.
  - Visiting `#Leads` or `#Reports` results in Dashboard view.

## Rollback
- Re-add items to sidebar list.
- Remove or relax the route guard.
