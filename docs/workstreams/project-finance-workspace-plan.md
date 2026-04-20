# Gộp Pricing vào tab Quản lý chi phí của Project Workspace

> Status: `planned`
> Role: decision-level plan for project finance workspace convergence; treat as planning guidance until canonical project/workspace docs absorb it.
> Canonical references: `docs/product/product-spec.md`, `docs/domain/canonical-model.md`, `docs/api/api-catalog.md`

## Summary
Gộp hoàn toàn module `Pricing` vào tab `finance` trong project workspace và đổi nhãn tab này thành `Quản lý chi phí`. Sau thay đổi, app không còn route/sidebar item `Pricing` độc lập; mọi QBU, actual cost, variance và pricing workflow chỉ được mở trong context của một project.

## Key Changes
- Điều hướng cấp app:
  - Xóa `Pricing` khỏi sidebar records và khỏi route render top-level trong `frontend/src/Layout.tsx` và `frontend/src/app.tsx`.
  - Xóa `Pricing` khỏi `AppModule`, `ROLE_MODULE_ACCESS`, `RECORD_ROUTES`, i18n route label, và các route tests đang coi `Pricing` là first-class route.
  - Giữ hành vi fallback hiện có: nếu còn chỗ nào cố điều hướng sang `Pricing`, route resolver sẽ rơi về `Home`/route hợp lệ thay vì giữ màn standalone.

- Project workspace:
  - Không giữ tab `pricing` riêng nữa; chỉ còn tab key `finance`.
  - Đổi label hiển thị của tab `finance` từ “Finance” sang `Quản lý chi phí`, nhưng giữ nguyên key nội bộ `finance` để không làm vỡ các nav context/test đang trỏ `workspaceTab: 'finance'`.
  - Bỏ `PricingTab` và render trực tiếp component `Pricing` bên trong `FinanceTab`.
  - `FinanceTab` trở thành một màn tổng hợp gồm:
    - phần cockpit/rủi ro tài chính hiện có
    - phần workspace pricing nhúng bên dưới, dùng `Pricing` với `embedded`, `projectId`, `projectContext`, `token`, `onChanged`, `readOnly={!canEditPricing}`.
  - Các CTA nội bộ đang `setTab('pricing')` phải đổi sang `setTab('finance')`, đặc biệt ở `OverviewTab` và mọi hero/workspace action liên quan.

- Permissions và wording:
  - Không đổi capability hiện tại: quyền sửa pricing vẫn tiếp tục đi qua `workspaceActionAccess.canEditPricing`.
  - Đổi copy người dùng từ “Pricing” sang ngôn ngữ thống nhất với yêu cầu mới, ưu tiên `Quản lý chi phí` ở tab/CTA/heading cấp workspace.
  - Trong component `Pricing`, khi `embedded === true`, heading nên phản ánh đây là phần của quản lý chi phí dự án, không còn là một workspace/module tách riêng.

## Tests
- Cập nhật unit tests cho route normalization/protection để bỏ giả định `Pricing` là route hợp lệ độc lập.
- Cập nhật tests liên quan navigation/persona nếu có assertion text “Finance” hoặc “Pricing”, nhưng giữ nguyên `workspaceTab: 'finance'` trong nav context tests.
- Thêm hoặc chỉnh test cho project workspace để xác nhận:
  - tab `finance` vẫn hiện theo role matrix cũ
  - không còn tab `pricing`
  - CTA “Mở Pricing” chuyển sang mở tab `finance`
  - `Pricing` được render trong `FinanceTab` và tôn trọng `canEditPricing`.

## Assumptions
- Không cần giữ backward-compatible deep link cho route `Pricing`; sau refactor route này bị loại bỏ.
- Không đổi key nội bộ `finance`; chỉ đổi nhãn hiển thị sang `Quản lý chi phí` để giảm churn ở nav context và persona-based QA checks.
- Không thay đổi backend/API hay shape dữ liệu của module pricing; đây là refactor điều hướng và composition UI ở frontend.
