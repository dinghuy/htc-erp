# UAT Checklist: Core Revenue Flow

## UX Regression Gate

- Chạy deterministic UX regression suite trước khi UAT tay:
  - [ux-regression-core.md](/C:/Users/dinghuy/OneDrive%20-%20HUYNH%20THY%20GROUP/Antigravity%20Workspace/crm-app/docs/qa/ux-regression-core.md)
- Xác nhận các flow preview không tạo UX trap:
  - `Mở Settings` vẫn hoạt động khi preview `viewer`
  - `Back to Admin` luôn còn
  - preview không làm lộ quyền business ngoài role đang giả lập

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
