# Kế Hoạch Agent Audit UX Toàn App Và Regression Suite V1

> Status: `partial`
> Role: active planning input for UX audit coverage; deterministic QA routes, manifests, and runbooks exist, but the suite remains an active operational surface.
> Canonical references: `docs/qa/ux-regression-core.md`, `docs/qa/ux-regression-codex-runbook.md`, `backend/src/modules/platform/qaRoutes.ts`, `frontend/scripts/qa/*`

## Tóm tắt

Mục tiêu là biến bài học từ lỗi `admin preview bị kẹt ở role hẹp` thành một `browser-driven UX regression suite` chạy trên `local dev app`, có `deterministic QA seed`, và được dẫn bởi agent thay vì chỉ kiểm tay từng lần.

Vòng đầu sẽ theo hướng `risk-based core first`:
- Ưu tiên các journey có giao điểm giữa `navigation`, `role preview`, `route protection`, `workspace tabs`, `approval lanes`, và `escape hatches`.
- Các route phụ vẫn có smoke coverage, chưa exhaustive toàn bộ page ngay v1.
- `admin` tuyệt đối không được vô tình có thêm business permission khi dùng preview; suite phải kiểm cả quyền thật lẫn khả năng thoát preview.

## Thay đổi triển khai chính

### 1. Thiết lập một UX audit harness do agent điều phối
- Dùng `browser-debugger` làm agent chính để chạy audit trên local app đang chạy.
- Giữ một lớp `code-aware mapping` nhẹ từ route shell hiện tại để agent biết đầy đủ persona, route, lane, và điểm cần kiểm.
- Chuẩn hóa đầu ra của agent thành:
  - danh sách flow đã chạy
  - bằng chứng lỗi hoặc pass
  - màn hình bị kẹt / CTA không thoát được / route bị guard sai
  - khuyến nghị fix ngắn gọn theo flow

### 2. Thêm deterministic QA seed cho local
- Thêm một cơ chế reset/seed local để tạo dữ liệu chuẩn cho các persona và flow chính.
- Seed phải có ít nhất:
  - admin base user
  - user/preset cho `sales`, `project_manager`, `sales + PM`, `procurement`, `accounting`, `legal`, `director`, `viewer`
  - project mẫu ở các stage `quoting`, `won`, `delivery`
  - approval items theo lane `commercial`, `finance`, `legal`, `executive`
  - blocker / missing docs / tasks đủ để `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Reports` đều có dữ liệu thật
- Không dùng dữ liệu dev ngẫu nhiên làm nguồn chính cho suite.

### 3. Chuẩn hóa flow manifest và invariants
- Thêm một manifest/browser spec cho các journey cần kiểm, thay vì để agent tự đoán toàn bộ flow mỗi lần.
- Flow manifest v1 phải khóa các invariants này:
  - luôn có đường thoát khỏi `role preview`
  - `Mở Settings` từ preview không bị route guard chặn
  - `Back to Admin` luôn khả dụng khi preview active
  - preview chỉ đổi effective view, không nâng business permission
  - route bị chặn phải rơi về màn hợp lệ có đường tiếp tục, không kẹt người dùng
- Suite phải ưu tiên selector ổn định cho header, preview banner, preset buttons, primary CTA, workspace tabs, approval filters.

### 4. Bộ journey cần coverage ngay ở vòng đầu
- `Admin -> bật preview -> Viewer -> mở Settings -> đổi sang role khác -> quay lại admin`
- `Admin preview -> Sales -> My Work commercial focus -> mở workspace mẫu -> commercial CTA đúng -> không lộ finance/legal approve`
- `Admin preview -> PM -> execution focus -> workspace timeline/delivery -> commercial ở read-only`
- `Admin preview -> Sales + PM -> unified home/my work -> commercial + execution cùng tồn tại -> không cần switch mode`
- `Admin preview -> Procurement -> Inbox procurement focus -> workspace procurement tab -> không sửa pricing`
- `Admin preview -> Accounting -> finance approvals -> finance workspace -> approve lane đúng, lane khác không được`
- `Admin preview -> Legal -> legal approvals -> legal workspace -> contract/doc review đúng, không finance approve`
- `Admin preview -> Director -> executive approvals/reports -> cockpit drill-down read-mostly`
- Smoke checks bổ sung cho `Viewer`, `Projects`, `Tasks`, `Reports`, `Support`, `EventLog` để bắt broken navigation hoặc empty trap

### 5. Tài liệu và quy trình vận hành
- Mở rộng `docs/qa/uat-checklist-core-revenue-flow.md` hoặc thêm một checklist UX riêng cho regression core.
- Ghi rõ cách chạy audit:
  - khởi động local app
  - reset QA seed
  - chạy agent/browser audit
  - lưu kết quả pass/fail theo flow
- Definition of Done cho các thay đổi UI/permission sau này phải yêu cầu update flow checklist nếu đụng `navigation`, `role preview`, `route protection`, `workspace`, `approval`, hoặc `persona home`.

## Thay đổi ở interfaces / contracts / test surface

- Thêm một `UX regression manifest` cho flow definitions, gồm:
  - `persona`
  - `entryRoute`
  - `preconditions`
  - `expectedVisible`
  - `expectedHidden`
  - `escapeActions`
- Thêm local QA seed contract:
  - base URL local app
  - admin credential test
  - seed dataset identifiers cho project/approval/task mẫu
- Thêm selector contract cho browser audit:
  - preview banner
  - preview preset buttons
  - back-to-admin CTA
  - settings CTA trong preview
  - workspace tabs
  - approval lane controls
- Không thay đổi business authorization contract ngoài việc thêm test coverage; suite chỉ xác nhận quyền hiện tại.

## Test Plan

- Browser audit pass cho toàn bộ 8 journey core ở trên.
- Mỗi journey phải kiểm đủ 4 lớp:
  - vào đúng màn
  - thấy đúng CTA
  - không thấy CTA sai quyền
  - luôn thoát được sang trạng thái hợp lệ
- Regression riêng cho lỗi vừa gặp:
  - preview `viewer` vẫn mở được `Settings`
  - preview active luôn có `Back to Admin`
  - chuyển preset trên preview banner không bị current allowedModules chặn
- Negative checks:
  - `admin` preview `accounting/legal/director` không tự có quyền business ngoài role preview contract
  - route guard không làm mất escape hatch
  - workspace tab read-only badge và preview badge khớp với capability thật
- Smoke suite cho route phụ:
  - `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Tasks`, `Reports`, `Settings`, `Support`, `EventLog`

## Giả định và mặc định đã chốt

- Hướng chính là `browser-driven regression suite`, không chỉ one-off audit.
- Vòng đầu là `risk-based core first`, không exhaustive mọi page.
- Môi trường chạy là `local dev app`.
- Dữ liệu test dùng `deterministic QA seed`, không dựa vào dev data hiện có.
- Agent chính là browser audit agent; code-aware exploration chỉ là lớp hỗ trợ mapping.
- Ưu tiên cao nhất là các flow có khả năng tạo “UX trap” giữa `preview state`, `route guard`, `permission gating`, và `navigation shell`.
