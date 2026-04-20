# UX Regression Core

## Purpose

Browser-driven regression suite để khóa các UX trap ở giao điểm giữa:

- seeded QA personas
- route protection
- navigation shell
- workspace tab gating
- approval lane permissions
- login thật theo từng role

Suite này ưu tiên `risk-based core first`, chưa exhaustive toàn bộ app.

## Deterministic Seed

Local suite không dùng dữ liệu dev ngẫu nhiên. Runner sẽ reset bộ QA seed qua:

- `POST /api/qa/reset-ux-seed`
- `GET /api/qa/ux-seed-contract`

Seed tạo sẵn:

- admin base user
- persona `sales`, `project_manager`, `sales + project_manager` (`qa_sales_pm`), `procurement`, `accounting`, `legal`, `director`, `viewer`
- project mẫu ở stage `quoting`, `won`, `delivery`
- approval lane `commercial`, `procurement`, `finance`, `legal`, `executive`
- task, blocker, missing documents, timeline và support/event-log artifacts để các màn chính đều có dữ liệu thật

Runner sẽ ưu tiên reset bằng admin seeded account. Nếu local DB đang ở trạng thái khác và mật khẩu admin không còn mặc định, runner fallback sang `POST /api/qa/bootstrap-ux-seed` với QA bootstrap header. Route này chỉ tồn tại ngoài production.

## Selector Contract

Stable selectors nằm ở:

- UI contract: [testIds.ts](../../frontend/src/testing/testIds.ts)
- Browser contract: [selector-contract.mjs](../../frontend/scripts/qa/selector-contract.mjs)

Các điểm bắt buộc phải giữ ổn định khi sửa UI:

- route shell root
- settings lane navigation
- approval lane controls
- project workspace tabs
- representative workspace modal

## Core Journeys

Manifest hiện tại nằm ở [ux-regression.manifest.mjs](../../frontend/scripts/qa/ux-regression.manifest.mjs)

Coverage vòng đầu:

1. `qa_admin -> settings -> admin lanes only`
2. `qa_sales -> commercial focus -> representative workspace -> no finance/legal lane actions`
3. `qa_project_manager -> execution focus -> commercial stays read-only`
4. `qa_sales_pm -> unified queue/workspace`
5. `qa_procurement -> inbox procurement focus -> procurement workspace`
6. `qa_accounting -> finance lane actions only`
7. `qa_legal -> legal lane actions only`
8. `qa_director -> executive lane + reports drill-down`
9. Smoke navigation cho `Home`, `My Work`, `Inbox`, `Approvals`, `Projects`, `Tasks`, `Reports`, `Settings`, `Support`, `EventLog`

## How To Run

1. Khởi động backend local.
2. Khởi động frontend local trên port audit cố định:

```powershell
cd frontend
.\scripts\npm-local.ps1 run dev:qa
```

Nếu `npm` global trên máy đã sạch, có thể dùng:

```powershell
cd frontend
npm run dev:qa
```

Hoặc dùng launcher một lệnh ở root repo:

```powershell
cd .
.\khoi-chay.bat
```

Kiểm tra stack sau khi bật:

```powershell
cd .
.\scripts\check-ux-audit-stack.ps1
```

3. Cài Playwright package nếu máy chưa có:

```bash
cd frontend
npm install
```

Trên Windows/Codex nếu `npm.ps1` đang lỗi do trỏ sai sang `%APPDATA%\npm`, dùng wrapper local:

```powershell
cd frontend
.\scripts\npm-local.ps1 install
```

4. Nếu không dùng Chrome/Edge hệ thống, cài browser Playwright:

```bash
npx playwright install chromium
```

Trên Windows/Codex có thể dùng:

```powershell
cd frontend
.\scripts\playwright-local.ps1 install chromium
```

5. Chạy suite:

```bash
cd frontend
npm run test:ux:audit
```

Nếu frontend không chạy ở `http://127.0.0.1:4173`, set `QA_FRONTEND_URL` trước khi chạy.

Chạy một phần suite theo persona:

```powershell
cd frontend
$env:QA_PERSONAS='accounting,legal'
npm run test:ux:audit
Remove-Item Env:QA_PERSONAS
```

Chạy một phần suite theo journey id:

```powershell
cd frontend
$env:QA_JOURNEY_IDS='accounting-finance-lane-boundary,legal-approval-boundary'
npm run test:ux:audit
Remove-Item Env:QA_JOURNEY_IDS
```

Smoke routes mặc định chạy khi không filter. Trong CI shard, chỉ shard cuối đặt `QA_INCLUDE_SMOKE=1`; các shard còn lại đặt `QA_INCLUDE_SMOKE=0`.

Chạy headed:

```bash
cd frontend
npm run test:ux:audit:headed
```

Artifacts sẽ nằm ở:

- `frontend/artifacts/ux-audit/<timestamp>/ux-regression-report.json`
- `frontend/artifacts/ux-audit/<timestamp>/ux-regression-report.md`
- screenshot theo từng journey

## CI Sharding

GitHub Actions workflow: `.github/workflows/ux-regression.yml`.

Shard groups:

- `sales-pm`: `sales`, `project_manager`
- `combined-procurement`: `sales_pm_combined`, `procurement`
- `finance-legal`: `accounting`, `legal`
- `director-smoke`: `director` plus smoke routes

Each shard must use an isolated `DB_PATH`, backend port, and frontend port. Artifact names use `ux-audit-<shard-name>` and include the JSON/Markdown reports plus screenshots under `frontend/artifacts/ux-audit/**`.

Khi local runner bị chặn bởi browser launch trong Codex, dùng runbook riêng:

- [ux-regression-codex-runbook.md](./ux-regression-codex-runbook.md)

Nếu có terminal audit bị treo hoặc cần dọn phiên cũ:

```powershell
cd .
.\scripts\cleanup-ux-audit-stack.ps1
```

## Expected Invariants

Mọi thay đổi chạm vào `navigation`, `workspace`, `approval`, `persona home`, hoặc `route protection` phải giữ các invariant sau:

- persona chỉ đổi qua login hoặc seeded account thật, không qua runtime impersonation
- `Settings` không được tự lộ lane admin nếu tài khoản thật không có role `admin`
- persona change không tự cấp thêm business permission
- route bị chặn phải rơi về màn hợp lệ, không kẹt người dùng
- read-only badge và capability hint phải khớp capability thật

## Definition Of Done

Một thay đổi UI/permission chỉ được coi là xong khi:

- update selector/manifest nếu flow thay đổi
- backend QA seed vẫn reset thành công
- `npm run test:ux:audit` pass hoặc có ghi chú rõ journey nào đang fail và vì sao
- checklist business/UAT liên quan vẫn còn hợp lệ
