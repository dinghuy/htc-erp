# Kế Hoạch UI Và Tính Năng Theo Vai Trò Cho Cross-Functional V1

> Status: `partial`
> Role: active planning input for cross-functional UX and role-centric navigation decisions.
> Canonical references: `docs/product/product-spec.md`, `docs/workstreams/role-permission-matrix-plan.md`, `docs/architecture/huly-work-hub-roadmap.md`

## Tóm tắt

Thiết kế sản phẩm theo mô hình `role-based home + shared project workspace + approval inbox`, nhưng không khóa cứng mỗi user vào một vai. `Sales` và `PM` vẫn là hai vai trò nghiệp vụ riêng, còn một user có thể được cấp đồng thời cả hai vai và dùng chung một trải nghiệm hợp nhất khi cần.

Mục tiêu v1:
- Một người có thể vừa bán hàng vừa điều phối dự án mà không phải dùng hai app tách biệt.
- Khi tổ chức tách riêng Sales và PM, hệ thống vẫn giữ được phân quyền, queue và trách nhiệm rõ ràng.
- Procurement, Accounting, Legal, Director làm việc trên cùng `Project Workspace` với lớp approval và risk control riêng.

## Mô hình trải nghiệm chính

### 1. Information architecture
- `Role Home`: homepage theo tập vai user đang có.
- `My Work`: queue hợp nhất theo assignment thực tế, không ép theo phòng ban cứng.
- `Project Workspace`: record trung tâm của deal/project/order.
- `Inbox / Approvals`: nơi xử lý yêu cầu duyệt, bổ sung hồ sơ, escalation.
- `Executive Cockpit`: dashboard riêng cho cấp điều hành.

### 2. Nguyên tắc cho Sales và PM
- `Sales` và `PM` là hai capability riêng:
  - Sales chịu trách nhiệm commercial flow, quotation, handoff.
  - PM chịu trách nhiệm execution flow, milestone, cross-functional coordination.
- Một user có thể có:
  - chỉ `sales`
  - chỉ `project_manager`
  - hoặc cả hai
- Nếu user có cả hai, UI mặc định hiển thị `Sales-PM unified workspace`:
  - một homepage
  - một queue công việc
  - một project workspace
  - action hiển thị theo trạng thái record và quyền hiện có
- Không dùng cơ chế “switch role mode” nặng ở v1; hệ thống tự hiện đúng action theo permission set.

### 3. Navigation đề xuất
- Cấp 1:
  - `Home`
  - `My Work`
  - `Projects`
  - `Inbox`
  - `Approvals`
  - `Reports`
  - `Master Data`
  - `Admin`
- Trong `Project Workspace`:
  - `Overview`
  - `Commercial`
  - `Procurement`
  - `Delivery`
  - `Finance`
  - `Legal`
  - `Tasks`
  - `Timeline`
  - `Documents`

## UI Và Tính Năng Theo Vai Trò

### 1. Sales
- Home:
  - Pipeline, quotation chờ duyệt, handoff pending, deal sắp hết hạn.
- Tính năng:
  - Lead/account/contact
  - Quotation versioning
  - Margin preview
  - Handoff checklist
  - Theo dõi trạng thái legal/procurement/accounting của từng deal

### 2. Project Manager
- Home:
  - Milestone trễ, blocker liên phòng ban, readiness giao hàng, task overdue.
- Tính năng:
  - Project workspace ownership
  - Timeline, milestone, dependency tracking
  - Delivery readiness gate
  - Escalation và cross-functional blocker management

### 3. Sales-PM combined user
- Home hợp nhất:
  - `Deals cần chốt`
  - `Projects cần đẩy`
  - `Handoff chưa sạch`
  - `Blockers ảnh hưởng margin/tiến độ`
- Tính năng chính:
  - Tạo quotation rồi tiếp tục theo dõi sang execution mà không đổi context
  - Nhìn một timeline xuyên suốt từ commercial tới delivery
  - Nhận queue theo việc thực tế, không tách queue sales và PM thành hai nơi
- Quy tắc UI:
  - Nếu record còn ở phase commercial, action sales nổi bật hơn
  - Nếu record đã handoff/won, action PM nổi bật hơn
  - Nếu một người giữ cả hai vai, audit log vẫn phải ghi rõ hành động theo “vai đang thực hiện”

### 4. Procurement
- Home:
  - PO cần tạo, vendor chưa phản hồi, line thiếu hàng, ETA trễ.
- Tính năng:
  - Procurement plan
  - RFQ/vendor comparison
  - PO tracking
  - Inbound receiving
  - Shortage/substitution/escalation

### 5. Accounting
- Home:
  - Yêu cầu xuất hóa đơn, công nợ đến hạn, milestone thanh toán, lỗi ERP posting.
- Tính năng:
  - Payment term validation
  - Invoice/deposit/milestone tracking
  - Receivable/payable status
  - ERP posting monitor

### 6. Legal
- Home:
  - Hợp đồng chờ review, deviation, phụ lục chờ ký, hồ sơ pháp lý thiếu.
- Tính năng:
  - Contract review queue
  - Clause checklist
  - Deviation register
  - Legal risk scoring
  - Approval / return with comments

### 7. Director
- Home:
  - `Profit + risk cockpit`
- Tính năng:
  - Margin by project
  - Receivable risk
  - Legal/supply risk
  - Escalation board
  - Approval vượt ngưỡng
  - Drill-down từ KPI xuống project

## Thay đổi quan trọng về interface / quyền / dữ liệu

- Thay `SystemRole` hiện tại bằng mô hình multi-role:
  - `sales`
  - `project_manager`
  - `procurement`
  - `accounting`
  - `legal`
  - `director`
  - `admin`
- User có thể có nhiều vai cùng lúc.
- Thay `ROLE_MODULES` bằng:
  - `ROLE_CAPABILITIES`
  - `ROLE_HOME_CONFIG`
  - `WORKSPACE_TAB_ACCESS`
  - `ACTION_PERMISSIONS`
- Thêm logic `combined persona`:
  - nếu user có cả `sales` và `project_manager`, dùng homepage và queue hợp nhất
  - không tạo role mới ở data model; đây là UI composition từ 2 role
- Bổ sung domain/shared objects:
  - `InboxItem`
  - `Blocker`
  - `RiskFlag`
  - `DocumentChecklist`
  - `ApprovalSLA`
  - `ProjectAssignmentRole`
- Audit model phải lưu:
  - user nào làm
  - action gì
  - trên record nào
  - trong ngữ cảnh capability nào (`sales` hay `project_manager`) nếu user có cả hai

## Lộ trình triển khai đề xuất

### Phase 1A
- Multi-role user model
- Unified `My Work`
- Project workspace chuẩn hóa
- Persona sâu cho `Sales`, `PM`, `Sales-PM combined`, `Procurement`

### Phase 1B
- Finance tab + accounting cockpit
- Legal tab + review flow
- Cross-functional approval inbox

### Phase 1C
- Director cockpit
- Risk scoring
- SLA và escalation reporting
- ERP/audit reporting hoàn chỉnh

## Test plan / kịch bản cần xác nhận

- User chỉ có `sales` chỉ thấy commercial actions.
- User chỉ có `project_manager` chỉ thấy execution actions.
- User có cả `sales` và `project_manager` thấy homepage hợp nhất, queue hợp nhất, nhưng action vẫn đúng theo phase và permission.
- Một deal được cùng một người tạo quotation, handoff và điều phối tiếp mà không phải đổi module thủ công.
- Khi tổ chức tách Sales và PM thành hai người khác nhau, assignment và approval vẫn chạy đúng.
- Procurement, Accounting, Legal, Director đều thấy cùng một project nhưng đúng tab và action của mình.
- Audit log phân biệt rõ hành động commercial và execution ngay cả khi do cùng một user thực hiện.

## Giả định và mặc định đã chốt

- Phạm vi là `Cross-functional v1`.
- `Project Workspace` là record trung tâm.
- `Sales` và `PM` không gộp thành một role dữ liệu cứng; một user có thể giữ đồng thời cả hai vai.
- Với user có cả hai vai, hệ thống dùng trải nghiệm hợp nhất thay vì bắt chuyển mode thủ công.
- `Sales + PM + Procurement` vẫn là nhóm cần trải nghiệm sâu nhất ở đợt đầu.
- `Accounting`, `Legal`, `Director` tham gia sâu qua cockpit + approval + control layer.
- `Director` ưu tiên `profit + risk cockpit`.
- V1 là desktop-first, mobile chủ yếu approve/view.
