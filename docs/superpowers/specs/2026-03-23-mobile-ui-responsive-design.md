# Mobile UI Responsive Design (Full App)

## Goal
Deliver a complete mobile layout for the entire CRM app (<= 768px) with a hidden sidebar, compact header, and vertically stacked filters and actions. Ensure all screens are usable one-handed, with readable cards, and no regression on desktop.

## Scope
Applies to all screens:
- Layout shell (sidebar, header, content padding)
- Dashboard
- Leads
- Customers (Accounts/Contacts)
- Products
- Suppliers
- Quotations (Sales)
- Reports
- Users
- Settings
- Support
- EventLog

## Non-Goals
- No new features beyond responsive layout
- No redesign of PDF preview content layout (only placement and access)
- No backend changes

## Breakpoints
- Mobile breakpoint: <= 768px
- Desktop: > 768px (existing layout preserved)

## High-Level Approach (Hybrid)
- Use CSS media queries for shell-level layout and general stacking
- Use JS-driven `isMobile` toggles for complex screens (tables to cards, form/preview tabs)

## Shell / Navigation
- Sidebar hidden by default on mobile
- Add hamburger button in header to open a slide-in drawer for navigation
- Header compact: logo + short title + key icons (search, dark mode, avatar)
- Top tabs (Global/Operations/Service) collapse into a single row of chips, wrap to next line when narrow
- Content padding reduced to 12–16px

## Common Mobile Rules
- Headers (title + subtitle) stacked vertically
- Action buttons grouped in a horizontal scroll row (or stacked if necessary)
- Filters and form fields are full-width and stacked vertically
- Tables become card lists
- KPI blocks stacked in a single column
- Modals use full width with reduced padding

## Screen-Specific Requirements

### Dashboard
- KPI cards stack 1 column
- Recent Activities section above Sales Funnel
- Any horizontal chart/areas should be full-width

### Leads (Kanban)
- Columns become horizontally scrollable with each column full-width
- Search + CSV actions stacked vertically
- Cards remain draggable on touch

### Quotations (Sales)
- Split into two tabs on mobile: `Form` and `Preview`
- Default to `Form` tab; preview accessible with one tap
- Zoom controls remain functional
- Preview container is full-width

### Customers / Users / Products / Suppliers / Reports
- Replace tables with card list layout
- Each card shows primary identity + key fields
- Row actions moved to card footer

### EventLog
- Timeline becomes a vertical list of cards
- Timestamp and category align in a single line

### Settings
- Tabs become a horizontally scrollable segmented control
- Form grid collapses to a single column

### Support
- Help cards stack vertically
- Ticket form is full width

## UI Components / Tokens
- Continue using `tokens` and `ui` primitives
- Ensure buttons use `textOnPrimary` on mobile as on desktop
- Maintain current spacing scale and transitions (150–200ms)

## Accessibility
- Keep focus-visible outlines
- Ensure all controls remain >= 44px height on mobile
- Maintain contrast of text and badges

## Verification
- Manual visual check at 390x844 and 360x800
- Ensure major flows are usable: Create Lead, Create Quotation, View Dashboard

## Risks
- Inline styles may need `isMobile` branches to avoid complex CSS overrides
- PDF preview needs careful layout to avoid scaling bugs

## Deliverables
- Responsive UI behavior across all screens
- No regressions on desktop layout
