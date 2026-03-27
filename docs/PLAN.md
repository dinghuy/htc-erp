# Kế Hoạch Tái Chuẩn Hóa CRM Để AI Phát Triển Đúng Chuẩn IT

## Summary

- Giữ hướng **nâng cấp dần trên stack hiện tại** thay vì viết lại từ đầu: frontend Preact/Vite, backend Express/TypeScript, nhưng tái cấu trúc thành **modular monolith** để AI có thể làm việc theo module nhỏ, ít phá vỡ nhau.
- Mục tiêu chính của roadmap là **CRM gắn chặt ERP**, với Phase 1 khóa vào **core revenue flow**: `Lead -> Account/Contact -> Quotation -> Approval -> Project handoff -> Task -> ERP outbox`.
- Baseline hiện tại đủ tốt để tái cấu trúc an toàn: test backend/frontend đang pass, nhưng rủi ro kiến trúc cao do backend đang dồn logic vào một file lớn và frontend còn nhiều màn hình quá nặng.
- Tất cả công việc AI về sau phải đi theo chuỗi cố định: **spec ngắn -> task rõ acceptance criteria -> code -> test -> UAT checklist -> merge**, không làm kiểu “prompt rồi sửa tay liên tục”.

## Implementation Changes

- **Phase 0: Thiết lập nền phát triển chuẩn**
  - Khởi tạo Git ngay tại `crm-app` và chuẩn hóa `.gitignore` để loại toàn bộ `db`, `log`, `dist`, `tmp`, test artifacts ra khỏi source tree.
  - Thiết lập bộ tài liệu bắt buộc: `product spec`, `architecture overview`, `ADR`, `API catalog`, `runbook`, `UAT checklist`, `AI task template`.
  - Đặt Definition of Ready/Done cho mọi task AI: có mục tiêu, phạm vi, dữ liệu vào/ra, API liên quan, test cần chạy, và tiêu chí nghiệm thu.

- **Phase 1: Khóa domain và phạm vi sản phẩm**
  - Chốt canonical model cho các thực thể lõi: `Lead`, `Account`, `Contact`, `Quotation`, `Project`, `Task`, `ApprovalRequest`, `ERP event`.
  - Chuẩn hóa role/permission và toàn bộ enum trạng thái để frontend/backend không tự giữ logic riêng.
  - Đóng băng các module ngoài core flow ở mức “maintenance only” trong giai đoạn đầu: dashboard nâng cao, support, báo cáo phức tạp, chat, tối ưu UI phụ.

- **Phase 2: Tái cấu trúc backend thành modular monolith**
  - Tách `server.ts` thành các khối rõ trách nhiệm: `bootstrap`, `auth`, `master-data`, `quotation`, `project workspace`, `task/approval`, `integration/erp`, `shared`.
  - Mỗi module phải có ranh giới cố định: `route -> schema/validator -> service -> repository -> mapper`.
  - Không cho phép business rule nằm trực tiếp trong route handler; mọi nghiệp vụ pricing, approval, project handoff, ERP sync phải đi vào service layer.
  - Tách schema database initialization khỏi seed/demo logic; seed chỉ chạy qua script riêng, không trộn trong startup path.

- **Phase 3: Chuẩn hóa dữ liệu và tích hợp ERP**
  - Giữ SQLite cho local/dev smoke ở ngắn hạn, nhưng đưa vào lớp database abstraction và migration framework để chuyển dần sang **PostgreSQL cho UAT/production**.
  - Chuẩn hóa ERP integration theo mô hình **outbox + idempotency + retry policy + dead-letter visibility**; không gọi ERP trực tiếp từ flow nghiệp vụ đồng bộ.
  - Toàn bộ import từ Excel/CSV phải được coi là ingestion workflow riêng, có validate, preview, mapping và audit trail.

- **Phase 4: Tái cấu trúc frontend theo feature**
  - Chuyển frontend từ màn hình lớn sang cấu trúc theo feature/domain, dùng chung API client, auth/session guard, shared form schema và shared table/filter patterns.
  - Ưu tiên làm sạch các màn hình của core flow trước: Leads, Customers/Accounts, Quotations, Projects, Tasks, Approval-related views.
  - Tách UI shell, navigation, permission gating và feature screens để AI có thể sửa từng phần mà không chạm toàn app.

- **Phase 5: Chuẩn hóa delivery pipeline**
  - Thiết lập CI bắt buộc: backend tests, frontend tests, typecheck, API contract checks, migration smoke, seed smoke.
  - Tách môi trường `local`, `dev`, `uat`, `prod`; có backup policy, env template, secret management, release checklist và rollback procedure.
  - Chỉ sau khi pipeline ổn định mới mở lại các hạng mục mở rộng như reporting sâu, support workflow đầy đủ, analytics, automation nâng cao.

## Public APIs / Interfaces / Types

- Chuẩn hóa API dưới namespace ổn định, khuyến nghị `api/v1`, tối thiểu cho các nhóm:
  - `auth`
  - `leads`
  - `accounts` và `contacts`
  - `quotations`
  - `projects`
  - `tasks`
  - `approvals`
  - `integrations/erp/outbox`
- Bắt buộc có DTO/type dùng chung cho:
  - `Role`, `Permission`, `AccountType`
  - `QuotationStatus`, `ProjectStage`, `TaskStatus`, `ApprovalStatus`, `ERPEventStatus`
  - `AuditFields`, `Pagination`, `FilterQuery`, `ApiError`
- Hợp đồng ERP phải có các trường cố định:
  - `eventType`
  - `aggregateType`
  - `aggregateId`
  - `payloadVersion`
  - `idempotencyKey`
  - `status`
  - `retryCount`
  - `sentAt`
  - `lastError`

## Test Plan

- Unit test cho business rules lõi: quotation totals, approval transitions, project handoff, ERP retry/idempotency, permission checks.
- Backend integration test cho toàn bộ happy path và role matrix của core flow.
- Migration test từ schema SQLite hiện tại sang schema chuẩn hóa mới, kèm rollback/smoke.
- Frontend contract test cho API client và derived state của màn hình lõi.
- UAT script theo persona:
  - sales tạo lead, account, quotation
  - manager duyệt/đẩy workflow
  - operations nhận handoff thành project/task
  - ERP sync gửi đúng 1 lần hoặc retry đúng luật
- Release gate:
  - không merge task AI nào nếu thiếu spec ngắn
  - không merge nếu chưa có test hoặc checklist UAT tương ứng
  - không merge thay đổi cross-module lớn trong một lần

## Assumptions And Defaults

- Giữ stack hiện tại trong giai đoạn đầu; **không rewrite sang framework mới** ở Phase 1.
- `crm-app` sẽ trở thành repo gốc chính thức của sản phẩm.
- Phase 1 chỉ tập trung core revenue flow; các module ngoài luồng này chỉ sửa lỗi và ổn định.
- PostgreSQL là đích đến cho môi trường vận hành nghiêm túc; SQLite chỉ giữ vai trò local/dev trong giai đoạn chuyển tiếp.
- AI được giao việc theo đơn vị nhỏ, mỗi task chỉ chạm **một module hoặc một luồng rõ ràng**, luôn kèm spec, acceptance criteria, test command và expected result.
