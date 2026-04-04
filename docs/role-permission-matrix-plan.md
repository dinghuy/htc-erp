# V1 Role Permission Matrix And Screen Plan

> Status: `partial`
> Role: active planning input for role surfaces; core role and permission contracts are already absorbed into shared contracts, but UI convergence is still in progress.
> Canonical references: `docs/domain/canonical-model.md`, `docs/product/product-spec.md`, `backend/src/shared/contracts/domain.ts`, `frontend/src/shared/domain/contracts.ts`

## Summary

V1 chốt theo hướng `role-based home + shared project workspace + approval inbox`, trong đó:

- `admin` là **system-only**: quản trị hệ thống, phân quyền, audit, support, và xem toàn cục; không mặc định có quyền duyệt nghiệp vụ nếu không được gán thêm role business.
- Giai đoạn đầu làm **sâu cho** `sales`, `project_manager`, `sales + project_manager`, `procurement`.
- `accounting`, `legal`, `director` ở mức `home/cockpit + queue + review`, chưa cần editor sâu như nhóm vận hành.
- Một user có thể có nhiều role; `sales + project_manager` dùng một trải nghiệm hợp nhất, không có switch mode.

## Permission Model

### Admin
- Module access: toàn bộ `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Reports`, `Master Data`, `Users`, `Settings`, `EventLog`, `Support`.
- Workspace access: xem toàn bộ tab `overview`, `commercial`, `procurement`, `delivery`, `finance`, `legal`, `tasks`, `timeline`, `documents`.
- Allowed actions:
  - quản lý user, role, settings, audit log, support
  - xem và chỉnh metadata hệ thống
  - mở mọi project/workspace để kiểm tra hoặc hỗ trợ
  - can thiệp dữ liệu vận hành khi cần support
- Not allowed by default:
  - không là approver chính thức cho `finance`, `legal`, `executive`, `procurement` nếu user không có role business tương ứng
  - không được dùng làm persona điều hành; nếu cần cockpit điều hành thì gán thêm `director`

### Sales
- Module access: `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Leads`, `Accounts`, `Contacts`, `Partners`, `Equipment`, `Sales`, `Pricing`
- Workspace tabs: `overview`, `commercial`, `procurement`, `delivery`, `tasks`, `timeline`, `documents`
- Allowed actions:
  - lead/account/contact management
  - quotation create/edit/versioning
  - handoff checklist
  - theo dõi trạng thái approval/document/blocker
- Not allowed:
  - user/settings admin
  - finance/legal approval trừ khi có role tương ứng

### Project Manager
- Module access: `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Tasks`, `ERP Orders`, `Ops Overview`, `Gantt`, `Ops Staff`, `Ops Chat`
- Workspace tabs: `overview`, `commercial`, `procurement`, `delivery`, `tasks`, `timeline`, `documents`
- Allowed actions:
  - project shell ownership
  - milestone/dependency/blocker orchestration
  - delivery readiness
  - task/project operational updates
- Not allowed:
  - commercial authoring sâu như quotation nếu không có `sales`
  - legal/finance approval chính thức

### Sales + Project Manager
- Không tạo role mới trong DB; đây là composition của `sales` + `project_manager`
- Module access: union của hai role trên
- Persona mode: `sales_pm_combined`
- Allowed actions:
  - đi xuyên từ quotation sang execution trên cùng project
  - queue hợp nhất theo assignment thật
  - commercial actions nổi bật khi project còn pre-handoff
  - execution actions nổi bật khi project đã won/handoff
- Audit requirement:
  - log phải lưu `actingCapability = sales | project_manager` trên từng action nghiệp vụ

### Procurement
- Module access: `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Tasks`, `ERP Orders`, `Suppliers`, `Equipment`, `Reports`
- Workspace tabs: `overview`, `procurement`, `delivery`, `tasks`, `timeline`, `documents`
- Allowed actions:
  - vendor/RFQ/PO/ETA/inbound shortage updates
  - escalation supply risk
- Not allowed:
  - quotation editing
  - legal/finance approval mặc định

### Accounting
- Module access: `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `ERP Orders`, `Reports`
- Workspace tabs: `overview`, `delivery`, `finance`, `tasks`, `timeline`, `documents`
- Allowed actions:
  - payment milestone review
  - invoice/deposit/receivable status updates
  - finance approvals
- Not allowed:
  - user/settings admin
  - legal review

### Legal
- Module access: `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Reports`
- Workspace tabs: `overview`, `legal`, `tasks`, `timeline`, `documents`
- Allowed actions:
  - contract review
  - clause/deviation/legal risk review
  - legal approvals / return with comments
- Not allowed:
  - commercial quote editing
  - finance approval

### Director
- Module access: `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Reports`, `EventLog`
- Workspace tabs: `overview`, `commercial`, `procurement`, `delivery`, `finance`, `legal`, `tasks`, `timeline`, `documents`
- Allowed actions:
  - executive cockpit
  - drill-down project risk/margin
  - executive approval
- Default behavior:
  - mostly review/approve/escalate, không phải editor vận hành hằng ngày

### Viewer
- Module access: `Home`, `My Work`, `Inbox`, `Projects`, `Reports`, `Support`
- Workspace tabs: `overview`, `commercial`, `delivery`, `tasks`, `timeline`, `documents`
- Read-only, không edit, không approve

## Screens To Build Or Finalize

### Shared screens for all authenticated users
- `Home`: role home theo persona hiện tại
- `My Work`: queue hợp nhất task + approvals + project follow-ups
- `Inbox`: missing docs, blocker, notifications, exception items
- `Approvals`: unified approval queue
- `Project Workspace`: 1 record trung tâm, tab visibility theo role

### Sales screens
- Sales Home: pipeline, quote pending, handoff pending, expiring deals
- Commercial Workspace: quotation versions, pricing, contract baseline summary
- Sales Queue inside My Work: deals cần chốt, hồ sơ cần bổ sung

### Project Manager screens
- PM Home: milestones trễ, critical blockers, delivery readiness
- Execution Workspace: tasks, timeline, delivery, dependencies
- PM Queue inside My Work: projects cần đẩy, blockers cần resolve

### Combined Sales-PM screens
- Unified Home:
  - Deals cần chốt
  - Projects cần đẩy
  - Handoff chưa sạch
  - Blockers ảnh hưởng margin/tiến độ
- Unified Workspace:
  - commercial + execution trong một flow
  - action prominence thay theo phase

### Procurement screens
- Procurement Home: PO pending, shortage, overdue ETA, vendor silent
- Procurement Workspace: RFQ/PO/inbound/delivery risk
- Procurement Queue: exception-driven worklist

### Accounting screens
- Accounting Home: invoice requests, payment milestones, receivable risk, ERP posting issues
- Finance Workspace tab: finance approvals + payment state + financial document state

### Legal screens
- Legal Home: contracts pending, deviation queue, missing legal docs
- Legal Workspace tab: contract review, legal approvals, appendices, document checklist

### Director screens
- Director Home: profit + risk cockpit
- Executive drill-down: top at-risk projects, approvals vượt ngưỡng, bottlenecks theo phòng ban

### Admin screens
- User & Role Admin: multi-role assignment, primary role, capability checklist
- System Admin: settings, support, audit/event log
- Global Project Access: mở mọi workspace để kiểm tra/support, nhưng không thay thế approver business

## Interfaces And Type Changes

- Keep `SystemRole` as:
  - `admin`, `sales`, `project_manager`, `procurement`, `accounting`, `legal`, `director`, `viewer`
  - `manager` chỉ giữ như alias tương thích cũ, map về `project_manager`
- Add explicit permission model constants:
  - `ROLE_MODULE_ACCESS`
  - `ROLE_WORKSPACE_TABS`
  - `ROLE_ACTION_PERMISSIONS`
  - `APPROVAL_PERMISSION_MAP`
- Keep `RoleProfile`:
  - `roleCodes`
  - `primaryRole`
  - `personaMode`
  - `allowedModules`
- Add action-level capability keys:
  - `manage_users`
  - `manage_settings`
  - `view_all_projects`
  - `edit_project_shell`
  - `edit_commercial`
  - `edit_execution`
  - `edit_procurement`
  - `approve_finance`
  - `approve_legal`
  - `approve_executive`
  - `review_documents`
- Audit/event model must include:
  - `actorUserId`
  - `actorRoles`
  - `actingCapability`
  - `entityType`
  - `entityId`
  - `action`
  - `timestamp`

## Test Plan

- User chỉ có `admin`:
  - thấy full navigation
  - vào được mọi workspace tab
  - sửa được user/settings
  - không thấy nút approve finance/legal/executive nếu không có role business tương ứng
- User chỉ có `sales`:
  - thấy commercial actions
  - không thấy finance/legal tabs
- User chỉ có `project_manager`:
  - thấy execution actions
  - không sửa quotation nếu không có `sales`
- User có `sales` + `project_manager`:
  - vào `sales_pm_combined`
  - home và queue hợp nhất
  - action đổi trọng tâm theo phase project
  - audit log ghi đúng `actingCapability`
- User `procurement`, `accounting`, `legal`, `director`:
  - thấy đúng home/cockpit và đúng workspace tab
  - không lộ editor/action ngoài phạm vi
- User `viewer`:
  - chỉ đọc, không edit, không approve
- Admin gán multi-role cho user:
  - session payload, route visibility, workspace tabs và actions cập nhật đúng sau login/reload

## Assumptions And Defaults

- `admin` là system-only, không mặc định là approver nghiệp vụ
- Nếu một người cần cả quyền hệ thống và quyền điều hành, gán đồng thời `admin` + `director`
- Giai đoạn đầu làm sâu cho `sales`, `project_manager`, `sales_pm_combined`, `procurement`
- `accounting`, `legal`, `director` giai đoạn đầu dừng ở mức cockpit + queue + review/approval
- `Project Workspace` là trung tâm; không tạo app riêng cho từng phòng ban
- UI desktop-first; mobile chỉ cần view/approve nhẹ ở v1
