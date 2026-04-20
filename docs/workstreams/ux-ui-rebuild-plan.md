# Kế Hoạch Rebuild UX/UI Toàn App Từ Design System Extracted

> Status: `active`
> Role: active implementation plan for the shell-first UX/UI rebuild across the current frontend, starting with shared primitives and revenue-flow screens.
> Canonical references: `DESIGN.md`, `docs/runbooks/ui-theme-principles.md`, `frontend/src/index.css`, `frontend/src/ui/tokens.ts`, `frontend/src/ui/styles.ts`, `frontend/src/ui/patterns.tsx`

## Tóm tắt

Mục tiêu là tái tạo trải nghiệm `htc-erp` theo hướng `design-system-first`, dùng bundle extracted trong `tmp/htc-erp-design-system-extracted/` làm benchmark thị giác và pattern language, nhưng vẫn giữ nguyên route, domain flow, permission contract và backend API hiện tại.

Hướng chọn là:

- shell trước, screen sau
- shared primitive trước, feature-specific polish sau
- revenue-flow trước, admin/secondary surfaces sau

## Phạm vi Triển Khai

### P1 Foundation

- shell: sidebar, top header, account cluster, search, spacing rhythm, route framing
- bridge layer: token semantics, shared styles, shared page primitives
- docs: `DESIGN.md`, `ui-theme-principles`, active workstream entry

### P2 Revenue Flow

- `Home`
- `Dashboard`
- `Leads`
- `Customers`
- `Quotations`
- `Projects`

### P3 Remaining Surfaces

- `Tasks`
- ops/workspace supporting routes
- `Reports`
- `Users`
- `Settings`
- `EventLog`
- `Support`

## Quy Tắc Thiết Kế

- Bundle extracted là reference-only, không phải production source
- Không copy raw prototype CSS vào app
- Chỉ map visual language sang semantic token/pattern hiện có
- Ưu tiên `PageHero`, `MetricCard`, `PageSectionHeader`, `EntitySummaryCard`, `FilterToolbar`, `StatusChipRow`
- Ngôn ngữ giao diện theo chính sách `VI-first controlled`

## Verification

- typecheck + build frontend
- test core frontend
- shell/navigation/theme contracts không được regression
- revenue-flow screens phải giữ nguyên hành vi route, search, filter, workspace entry, approval escape paths
