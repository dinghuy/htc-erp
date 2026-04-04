# Approval Flow Từ Báo Giá Đến Giao Hàng

> Status: `partial`
> Role: active planning input for approval and execution-state convergence.
> Canonical references: `docs/domain/canonical-model.md`, `docs/api/api-catalog.md`, `docs/api/erp-outbox-contract.md`, `backend/src/shared/contracts/domain.ts`

## Summary

Mở rộng flow Phase 1 từ roadmap hiện tại thành chuỗi vật lý hoàn chỉnh:

`Lead -> Account/Contact -> Quotation -> Approval -> Sales Order -> Procurement/Inbound -> Delivery -> Delivery Completion -> ERP outbox`

Plan này khóa theo các quyết định đã chốt:
- “Giao hàng” = giao hàng/vận chuyển thực tế, không chỉ handoff nội bộ.
- Approval bao phủ end-to-end, không dừng ở báo giá.
- Approval owners bám đúng role đang có trong repo: `sales`, `project_manager`, `procurement`, `accounting`, `legal`, `director`.
- Đầu ra triển khai sau này phải gồm cả state machine, approval gates, role ownership, acceptance criteria.

## Key Changes

### 1. Chuẩn hóa state machine end-to-end
Khóa các chặng nghiệp vụ chính và chỉ cho phép chuyển trạng thái qua các gate rõ ràng:

- `QuotationStatus`
  - `draft`
  - `submitted_for_approval`
  - `revision_required`
  - `approved`
  - `rejected`
  - `won`
  - `lost`
- `ApprovalStatus`
  - `pending`
  - `approved`
  - `rejected`
  - `changes_requested`
  - `cancelled`
- `SalesOrderStatus`
  - `draft`
  - `released`
  - `locked_for_execution`
  - `cancelled`
- `Procurement / Inbound`
  - procurement line: `planned`, `ordered`, `partially_received`, `received`, `cancelled`
  - inbound line: `pending`, `received`, `closed`
- `Delivery`
  - delivery line: `pending`, `scheduled`, `partially_delivered`, `delivered`, `blocked`, `closed`
- `ProjectStage`
  - thêm các stage phản ánh execution vật lý: `commercial_approved`, `order_released`, `procurement_active`, `delivery_active`, `delivery_completed`, `closed`

Quy tắc chuyển trạng thái:
- Không tạo/release `SalesOrder` nếu `Quotation` chưa `approved` và chưa `won`.
- Không cho logistics/delivery chạy nếu `SalesOrder` chưa `released`.
- Không cho `delivery_completed` nếu delivery lines chưa đạt điều kiện hoàn tất.
- Mọi trạng thái “khóa” chỉ đổi qua action có audit trail, không update trực tiếp trong UI/form.

### 2. Khóa approval gates theo role hiện có
Thiết kế approval theo milestone, không approval mọi thao tác nhỏ:

- Gate A: `Quotation commercial approval`
  - Owner mặc định: `sales` submit
  - Approver: `director`
  - Optional parallel approvers theo nội dung deal: `accounting`, `legal`
  - Kết quả: `approved`, `rejected`, `changes_requested`
- Gate B: `Sales order release`
  - Owner: `project_manager`
  - Approver: `director`
  - Optional reviewers: `accounting`, `legal`
  - Điều kiện vào gate: quotation `won`
- Gate C: `Procurement / execution commitment approval`
  - Owner: `project_manager`
  - Approver: `procurement` khi liên quan mua hàng
  - Optional: `accounting` nếu có điều kiện thanh toán/advance
- Gate D: `Delivery release approval`
  - Owner: `project_manager`
  - Approver: `director`
  - Optional reviewer: `procurement`
  - Điều kiện vào gate: đủ readiness cho giao hàng
- Gate E: `Delivery completion approval`
  - Owner: `project_manager`
  - Approver: `sales` hoặc `director`
  - Mục tiêu: xác nhận hoàn tất thương mại và sẵn sàng close / ERP finalize

Nguyên tắc:
- `legal`, `accounting`, `procurement` là conditional approvers, không luôn bắt buộc cho mọi đơn.
- Plan triển khai sau phải khóa rõ rule nào khiến từng approver trở thành required, thay vì hardcode mọi gate đều cần full chain.

### 3. Public APIs / Interfaces / Types cần thêm hoặc chuẩn hóa
Khuyến nghị khóa ownership dưới `/api/v1/*`:

- `/api/v1/quotations`
- `/api/v1/approvals`
- `/api/v1/sales-orders`
- `/api/v1/projects`
- `/api/v1/project-procurement-lines`
- `/api/v1/project-inbound-lines`
- `/api/v1/project-delivery-lines`
- `/api/v1/erp/outbox`

Các contract/type cần bổ sung hoặc chuẩn hóa dùng chung:
- `SalesOrderStatus`
- `ProcurementLineStatus`
- `InboundLineStatus`
- `DeliveryLineStatus`
- `ApprovalGateType`
  - `quotation_commercial`
  - `sales_order_release`
  - `procurement_commitment`
  - `delivery_release`
  - `delivery_completion`
- `ApprovalDecision`
  - `approved`
  - `rejected`
  - `changes_requested`
- `ApprovalOwnerRole[]`
- `WorkflowTransitionResult`
- `WorkflowGuardFailure`
- `AuditEventPayload` cho quotation, sales order, procurement, delivery, completion

Nguyên tắc interface:
- Frontend không tự suy luận gate từ text/status rời rạc; backend trả về action availability và pending approvals.
- `ApprovalRequest` phải gắn được với nhiều aggregate: `Quotation`, `SalesOrder`, `Project`, `ProjectDeliveryLine` hoặc milestone giao hàng.
- ERP outbox chỉ phát event sau các mốc được phê duyệt hoặc hoàn tất, không phát từ draft states.

### 4. Phân rã implementation sau này
Triển khai nên đi theo 4 task bounded, không làm mega-PR:

- Task 1: khóa shared enums, approval gate types, transition guards ở backend/shared + frontend/shared.
- Task 2: chuẩn hóa quotation approval và sales-order release flow.
- Task 3: nối procurement/inbound/delivery với approval gates và audit timeline.
- Task 4: khóa delivery completion + ERP outbox trigger + UAT flow end-to-end.

File trọng tâm dự kiến:
- `backend/src/shared/contracts/domain.ts`
- `backend/src/modules/quotations/*`
- `backend/src/modules/sales-orders/*`
- `backend/src/modules/projects/*`
- `frontend/src/features/quotations/*`
- `frontend/src/features/projects/*`
- `frontend/src/features/sales-orders/*`

## Test Plan

Các scenario bắt buộc cho plan triển khai:
- Sales tạo quotation draft, submit approval, bị `changes_requested`, sửa và resubmit.
- Director approve quotation, quotation chuyển `approved`, rồi `won`.
- Project manager tạo/release sales order; hệ thống chặn nếu quotation chưa đủ điều kiện.
- Procurement/inbound update tiến độ; delivery release bị chặn nếu chưa đạt readiness.
- Delivery line đi từ `scheduled` -> `partially_delivered` -> `delivered`; delivery completion chỉ mở khi đủ điều kiện.
- Approval matrix theo role:
  - `sales` không tự approve gate của chính mình
  - `project_manager` không bypass delivery release
  - `procurement`, `accounting`, `legal` chỉ xuất hiện khi rule yêu cầu
  - `director` xử lý các gate khóa
- ERP outbox:
  - chỉ phát event ở mốc approved/released/completed
  - retry/idempotency không tạo duplicate sau approve lại hoặc cập nhật lại line

## Assumptions

- Giữ kiến trúc hiện tại của repo; chỉ mở rộng flow trên các module đã có như `quotations`, `sales-orders`, `projects`, `erp`.
- Approval là milestone-based, không phải approval cho từng field edit.
- `project_manager` là owner vận hành chính sau khi quotation thắng.
- `sales` vẫn giữ vai trò owner thương mại và đồng xác nhận hoàn tất giao hàng.
- Chi tiết conditional rules cho `legal`, `accounting`, `procurement` sẽ được khóa ở spec triển khai kế tiếp, nhưng boundary role đã cố định trong plan này.
