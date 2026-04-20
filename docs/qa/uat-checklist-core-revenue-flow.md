# UAT Checklist: Core Revenue Flow

## UX Regression Gate

- Chạy deterministic UX regression suite trước khi UAT tay:
  - [ux-regression-core.md](./ux-regression-core.md)
- Xác nhận các flow QA persona dùng tài khoản seeded thật, không còn phụ thuộc runtime preview:
  - đăng nhập trực tiếp bằng đúng persona cần kiểm tra
  - `Settings` chỉ hiển thị lane admin khi tài khoản thật có role `admin`
  - persona switching không làm lộ quyền business ngoài role thật

## Sales

- Create a lead
- Convert lead into account/contact context
- Create a quotation with valid totals
- Submit quotation for approval

## Management

- Review approval request
- Approve or reject with visible status update
- Confirm protected transitions reject invalid roles

## Operations

- Create project handoff from winning quotation
- Verify project, task, and downstream operational records are created

## ERP

- Confirm outbox event is created once
- Confirm retry updates event status and audit fields
- Confirm failure state preserves last error details
