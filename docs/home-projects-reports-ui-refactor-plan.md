# Kế Hoạch Refactor UI Cho `Home + Dự án + Báo cáo`

> Status: `partial`
> Role: active planning input for home/workspace/report surfaces while frontend shell migration is still in progress.
> Canonical references: `docs/architecture/overview.md`, `docs/qa/ux-regression-core.md`, `frontend/src/app.tsx`

## Tóm tắt
Refactor theo hướng `enterprise gọn rõ`, tập trung vào 3 màn `Home`, `Dự án`, `Báo cáo`, đồng thời chạm vào `Layout` ở mức cần thiết để giải quyết các vấn đề đang lặp lại: trộn ngôn ngữ, hierarchy rối, card quá nhiều tín hiệu, hero bị lãng phí không gian, và cụm account/header bị trùng chức năng.

Cách làm được chọn là `refactor màn chính có chung pattern`, không redesign toàn app. Nghĩa là:
- Chuẩn hóa lại khung đọc thông tin và component pattern dùng chung.
- Giữ lại hệ token/dark theme hiện tại, không thay branding.
- Sửa luôn lỗi render có tác động UI như duplicate key ở `Home` và `Projects`.

## Phương án Chọn
### Phương án được chọn: Refactor shared patterns + 3 màn ưu tiên
- Tạo một bộ pattern hiển thị chung cho `hero`, `section header`, `metric card`, `status/badge row`, `action card`, `list/card shell`.
- Dùng lại pattern này ở `Layout`, `Home`, `Projects`, `Reports` để giảm cảm giác mỗi màn là một “ngôn ngữ” riêng.
- Ưu tiên khả năng scan nhanh, khoảng trắng hợp lý, và giảm nhiễu trước khi tăng độ “premium”.

### Không chọn: polish cục bộ
- Chỉ vá text, spacing, CTA sẽ không xử lý được nguyên nhân gốc là hierarchy và density.

### Không chọn: redesign rộng
- Chưa mở rộng sang toàn bộ route/component system. Việc này sẽ làm plan lan phạm vi và chậm vòng cải thiện đầu tiên.

## Thay đổi triển khai
### 1. Shared layout và navigation
- Gọn lại cụm account ở header thành một block duy nhất: tên + vai trò + avatar/menu; bỏ trùng chức năng logout giữa topbar và vùng account.
- Sidebar vẫn giữ, nhưng chỉ một điểm logout rõ ràng trong desktop navigation; mobile drawer giữ hành vi tương đương.
- Giảm độ nặng thị giác của top header để trọng tâm quay về nội dung màn.
- Chuẩn hóa tab label cấp cao để không trộn “Workspace / Master Data / Admin” với copy tiếng Việt ngẫu nhiên trong cùng vùng.

### 2. Chuẩn hóa ngôn ngữ hiển thị
- Áp dụng chính sách `song ngữ có chủ đích`: nhãn nghiệp vụ/thuật ngữ hệ thống được phép giữ tiếng Anh khi đó là tên lane hoặc tên cockpit, nhưng label giao diện, trạng thái, helper text, CTA, badge đếm, empty/loading/error text phải theo một quy tắc thống nhất.
- Tạo bảng quy ước cho các nhóm text sau và áp dụng nhất quán ở 3 màn:
  - CTA/action text
  - Status label
  - Metric/card label
  - Helper/description text
  - Empty/loading/error states
- Tận dụng hệ `i18n` hiện có thay vì hardcode thêm copy mới trong component.

### 3. Refactor màn Home
- Đổi hero từ kiểu “mảng gradient + CTA nổi rời” sang layout 2 vùng rõ: `context summary` bên trái, `top actions` bên phải hoặc bên dưới trên mobile.
- Giảm số action card cạnh tranh nhau; giữ 1 primary action, 1 secondary action, 1 watch item. Các action còn lại chuyển xuống section phụ nếu cần.
- Nhóm lại các metric card theo mục tiêu đọc nhanh, bỏ cảm giác mỗi card là một khối tách biệt không liên hệ.
- Section highlight chỉ giữ tín hiệu quan trọng nhất cho mỗi project: tên, trạng thái chính, một next action, tối đa 2 badge hỗ trợ.
- Sửa duplicate key ở list highlights để tránh render glitch khi cập nhật dữ liệu.

### 4. Refactor màn Dự án
- Biến phần trên màn thành 3 lớp rõ:
  - `page header`
  - `focus presets + KPI`
  - `filter toolbar`
- Toolbar filter chuyển sang pattern gọn hơn: search + 3 filter chính + overflow/toggle cho filter phụ trên viewport hẹp.
- Project card giảm density:
  - Giữ title, account, owner, timeline, progress, next action.
  - Không lặp nhiều badge cùng nghĩa.
  - Không hiển thị cảnh báo cùng nội dung 2 lần.
  - Chỉ giữ tối đa 1 blocker chính và 1-2 support chips.
- Action row của mỗi card chuẩn hóa thứ tự: `Workspace` -> `Chi tiết` -> thao tác quản trị.
- Sửa duplicate key ở project badges/pending approver blocks để loại rủi ro reorder sai.

### 5. Refactor màn Báo cáo
- Chọn một visual grammar thống nhất với `Home`, không để `Reports` trông như sản phẩm khác.
- Giữ hero ngắn hơn, ít “trình diễn” hơn, tập trung vào question the screen answers.
- Gom metric + watchlist/focus panels theo cùng pattern card với `Home`.
- Với role-based cockpit, thống nhất cách đặt eyebrow, title, note, panel title, badge tone.
- Trên desktop, các cột panel phải cân bằng hơn; trên mobile, các panel xếp dọc theo thứ tự ưu tiên thông tin thay vì giữ nguyên 2 cột logic desktop.

### 6. Shared component/pattern additions
- Thêm hoặc trích ra các primitive/pattern dùng chung cho 3 màn:
  - `PageHero`
  - `PageSectionHeader`
  - `MetricCard`
  - `ActionCard`
  - `StatusChipRow`
  - `EntitySummaryCard`
  - `FilterToolbar`
- Không thay public API backend; chỉ thay interface component frontend nội bộ ở mức cần thiết để dùng lại pattern.
- Các component mới phải nhận prop thiên về semantics, không chỉ style, để implementer không quay lại hardcode từng màn.

## Thay đổi đối với interface/types
- Không có thay đổi API backend bắt buộc.
- Có thể cần mở rộng props nội bộ của component frontend để chuẩn hóa:
  - hero/title/eyebrow/action slots
  - badge item model
  - summary card item model
  - filter toolbar action model
- Nếu thêm key/label model dùng chung, ưu tiên tạo type nội bộ ở layer UI hoặc feature-shared thay vì để mỗi màn tự dựng shape riêng.
- Các key i18n mới hoặc map i18n bổ sung là một phần của plan, không được để text mới hardcode rải rác.

## Test plan
### Kiểm thử trực quan và hành vi
- Desktop `1440x1024` và mobile `390x844` cho cả 3 màn.
- Kiểm tra header sau refactor không còn trùng logout/account controls.
- Kiểm tra hero của `Home` và `Reports` không còn khoảng trống chết lớn và CTA bám chặt vào context.
- Kiểm tra project cards dễ scan hơn, không còn badge/cảnh báo lặp.

### Kiểm thử nội dung
- Audit toàn bộ 3 màn để đảm bảo copy tuân thủ quy tắc song ngữ đã chọn.
- Empty/loading/error states trên 3 màn dùng cùng voice và cùng policy ngôn ngữ.

### Kiểm thử ổn định
- Console sạch lỗi duplicate key trên `Home` và `Projects`.
- Filter và list update không làm nhảy sai item hoặc reorder bất thường.
- Mobile drawer và top header không che nội dung hoặc tạo trạng thái mở sai khi đổi viewport.

### Acceptance criteria
- Người dùng có thể xác định `mục tiêu màn`, `trạng thái chính`, `hành động tiếp theo` trong vài giây đầu ở cả 3 màn.
- Mỗi card dự án chỉ còn một tín hiệu hành động chính, không lặp message.
- Ngôn ngữ hiển thị nhất quán theo policy đã chọn.
- Không có regression về routing, role-based visibility, search, filter và workspace open actions.

## Giả định và mặc định
- Chỉ refactor `Layout`, `Home`, `Projects`, `Reports` và shared UI cần thiết; chưa mở rộng toàn app.
- Giữ dark palette, tokens, brand color hiện tại; không đổi nhận diện.
- Không đổi business logic, không đổi quyền, không đổi shape API.
- Ưu tiên semantic cleanup và reuse component hơn là thêm hiệu ứng hình ảnh.
- Các path nhiều khả năng bị chạm chính: `src/Layout.tsx`, `src/Home.tsx`, `src/Projects.tsx`, `src/Reports.tsx`.
