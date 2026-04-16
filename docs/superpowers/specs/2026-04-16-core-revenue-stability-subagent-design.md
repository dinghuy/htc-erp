# Core Revenue Stability Subagent Design

## Context
Mục tiêu hiện tại là làm cho luồng tạo báo giá đủ ổn định để trở thành trung tâm của core revenue flow, đồng thời kiểm soát chặt các phụ thuộc trực tiếp của nó: customer/account/contact context và product catalog. Phạm vi không mở rộng sang tối ưu toàn hệ thống; approvals/handoff được giữ làm gate verify cuối thay vì mở lane refactor riêng.

Thiết kế này ưu tiên `stability first`: tăng độ chắc của dependency chain, bổ sung regression coverage đúng chỗ, giảm lỗi stale/mismatch/state drift, và tránh mega-refactor bằng cách chia việc cho các subagent lane độc lập.

## Goal
Điều phối implementation theo mô hình subagent nhiều lane để ổn định core revenue flow, với trọng tâm là quote creation readiness.

## Scope
### In scope
- Customers/accounts/contacts readiness phục vụ báo giá
- Product catalog readiness phục vụ chọn line item
- Quotation create/save/submit stability
- Final verification xuyên luồng: `customer -> product -> quotation -> submit approval`

### Out of scope
- Refactor riêng approvals/handoff module
- Broad UX redesign ngoài quote flow
- Full rewrite các màn legacy lớn
- Mở rộng sang reports, support, shell/navigation trừ khi là blocker trực tiếp

## Recommended orchestration model
Chia thành 4 lane độc lập, trong đó 3 lane sửa code và 1 lane verification:

### Lane 1 — Customer readiness
**Purpose:** khóa dữ liệu đầu vào account/contact để quote form không dùng state bẩn.

**Focus areas:**
- account/contact CRUD regression
- account-contact linkage validity
- invalid/missing reference handling cho quote flow
- payload shape mà quote UI đang tiêu thụ

**Primary files:**
- `backend/src/modules/crm/routes.ts`
- `backend/src/modules/crm/repository.ts`
- `frontend/src/Customers.tsx`
- test files liên quan đến accounts/contacts

**Expected output:**
- regression tests cho account/contact linkage
- deterministic handling cho invalid/mismatch account-contact cases

### Lane 2 — Product readiness
**Purpose:** đảm bảo product catalog cung cấp dữ liệu ổn định cho quote line items.

**Focus areas:**
- product list/read shape stability
- malformed/stale product data
- selectability của product trong quote flow
- minimum product fields required by quotation UI

**Primary files:**
- `backend/src/modules/products/routes.ts`
- `backend/src/modules/products/service.ts`
- `frontend/src/Products.tsx`
- product-related tests

**Expected output:**
- regression tests cho product shape used by quotation
- xử lý rõ ràng cho stale/malformed product data nếu chạm quote flow

### Lane 3 — Quotation stability
**Purpose:** khóa golden path create/save/submit quotation.

**Focus areas:**
- dependency validation với account/contact/product
- totals/state consistency
- frontend readiness gating
- stale selection reset (account/contact/project/product)
- save draft / submit approval handoff readiness

**Primary files:**
- `backend/src/modules/quotations/routes/mutationRoutes.ts`
- `backend/src/modules/quotations/service.ts`
- `frontend/src/Quotations.tsx`
- `frontend/src/quotations/QuotationEditor.tsx`
- `frontend/src/quotations/quotationShared.ts`
- quotation-related tests

**Expected output:**
- failing tests trước cho dependency validation và state consistency
- fixes cho create/save/submit path
- quote form chỉ cho submit khi dependency chain đã sẵn sàng

### Lane 4 — Final verification only
**Purpose:** xác nhận toàn flow sau khi 3 lane chính hoàn tất.

**Focus areas:**
- verify backend/frontend targeted suites
- check package test lanes và missing critical tests
- run critical UAT path
- approvals/handoff chỉ làm downstream verification gate, không refactor riêng

**Verification path:**
1. create/select customer account
2. create/select contact under account
3. confirm product catalog loads and item can be chosen
4. create quotation with valid totals
5. save draft
6. submit approval
7. confirm downstream status is visible and không vỡ ở gate approval/handoff

## Boundary rules
- Customer lane không sửa quote orchestration trừ khi cần contract fix tối thiểu đã được quotation lane xác nhận.
- Product lane không sửa quote orchestration trừ khi cần contract fix tối thiểu đã được quotation lane xác nhận.
- Quotation lane là lane duy nhất được sửa glue integration ở `frontend/src/Quotations.tsx`.
- Verification lane ưu tiên chạy lại bằng chứng; không mở refactor riêng.
- Không gộp các lane thành một mega-PR logic. Mỗi lane phải có scope bounded và evidence riêng.

## Risks and controls
### Risk 1: lane chạm cùng file
**Control:** lane boundaries khóa trước; nếu có shared file như `frontend/src/Quotations.tsx`, chỉ quotation lane được sửa.

### Risk 2: fix cục bộ nhưng vỡ end-to-end
**Control:** final verification lane chạy critical path thật sau khi gom các lane.

### Risk 3: scope drift sang refactor lớn
**Control:** giữ mục tiêu `stability first`; mọi thay đổi architecture chỉ được phép khi trực tiếp phục vụ testability/readiness của quote flow.

## Success criteria
Thiết kế điều phối này được coi là thành công nếu:
- customer/product/quotation được tách thành lane rõ ràng, không đè scope nhau
- mỗi lane có test/regression target cụ thể
- quote creation path ổn định hơn sau khi customer/product readiness được khóa
- có final verification evidence cho critical core revenue path

## Next step
Sau khi spec này được review và chấp thuận, bước tiếp theo là viết implementation plan chi tiết cho 4 lane và sau đó dispatch subagents theo lane.