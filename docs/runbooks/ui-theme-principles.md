# UI Theme Principles

## Purpose

Tài liệu này là chuẩn vận hành UI cho `frontend/` để tránh lặp lại lỗi:

- light mode vẫn hiển thị surface kiểu dark mode
- mỗi màn tự hardcode màu/gradient riêng
- cùng một trạng thái nhưng mỗi nơi một màu khác nhau
- native controls (`select`, `input`, scrollbar, browser chrome) không bám theme

Mục tiêu là mọi bề mặt UI đi theo cùng một hệ thống token, để sửa light/dark mode ở một chỗ thay vì vá từng màn.

## Source Of Truth

Thứ tự chuẩn để lấy màu và surface:

1. `frontend/src/index.css`
   - khai báo CSS variables cho light và dark
   - đây là source of truth cho theme runtime
2. `frontend/src/ui/tokens.ts`
   - expose semantic token cho TypeScript/TSX
   - feature code không nên truy cập hex trực tiếp nếu có thể diễn đạt bằng token
3. `frontend/src/ui/styles.ts`
   - chứa primitive UI dùng lại nhiều nơi như button, card, input, overlay
4. feature-level semantic constants
   - chỉ dùng khi một màn có ngữ nghĩa riêng, ví dụ `PRODUCT_DETAIL_PANEL_BG`
   - constant này phải map về token, không map về hex/rgba cứng

## Non-Negotiables

- Không hardcode màu cho app surface, panel, section, card, chip, empty state, sticky footer, drawer header.
- Không hardcode gradient tối kiểu `rgba(15, 23, 42, ...)` trong feature file cho các bề mặt bình thường.
- Không hardcode màu trạng thái như info/warning/violet badge nếu token tương đương đã tồn tại.
- Mọi `select`, `input`, `textarea` phải có `background-color` và `color` explicit theo theme.
- Theme toggle phải đồng bộ trên `html`, `body`, `color-scheme`, và `meta[name="theme-color"]`.

## Allowed Exceptions

Hardcode chỉ được phép khi đó là màu nghiệp vụ hoặc màu vật lý của nội dung, không phải màu theme:

- Quotation/print preview cần nền trắng thật để mô phỏng giấy in
- Ảnh/video/media frame cần overlay tối để đảm bảo chữ đọc được trên nội dung thật
- Crop mask, dimmer, image scrim, backdrop blur có thể dùng rgba trực tiếp nếu phục vụ media legibility
- Brand/partner color của tài liệu bên thứ ba

Nếu thuộc các trường hợp trên, comment ngắn giải thích lý do tại chỗ.

## Token Rules

Khi thêm một UI state mới:

1. Xác định semantic role trước
   - info accent
   - warning surface
   - subtle surface
   - hero gradient
   - panel gradient
2. Thêm cả light và dark variant trong `frontend/src/index.css`
3. Export token qua `frontend/src/ui/tokens.ts`
4. Nếu là pattern dùng nhiều nơi, đưa vào `frontend/src/ui/styles.ts` hoặc `tokens.surface`
5. Feature code chỉ consume token đã export

Ví dụ các semantic token hiện có:

- `tokens.colors.infoAccentBg`
- `tokens.colors.infoAccentText`
- `tokens.colors.warningSurfaceBg`
- `tokens.colors.warningSurfaceBgSoft`
- `tokens.colors.warningSurfaceBorder`
- `tokens.colors.warningSurfaceText`
- `tokens.colors.violetStrongBg`
- `tokens.colors.violetStrongText`
- `tokens.surface.panelGradient`
- `tokens.surface.heroGradient`
- `tokens.surface.heroGradientSubtle`
- `tokens.surface.drawerHeader`
- `tokens.surface.detail`

## Feature Rules

Trong feature file:

- Ưu tiên `tokens.colors.*` cho color semantic
- Ưu tiên `tokens.surface.*` cho panel/gradient/surface semantic
- Nếu một màn cần 1-3 surface riêng, tạo local constants ở đầu file
- Không lặp lại cùng một `var(--...)` string ở nhiều block trong cùng file

Mẫu tốt:

```ts
const PRODUCT_DETAIL_PANEL_BG = tokens.surface.panelGradient;
const PRODUCT_DETAIL_HERO_BG = tokens.surface.heroGradient;
const PRODUCT_DETAIL_SURFACE_BG = tokens.colors.surfaceSubtle;
```

Mẫu xấu:

```ts
background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.9) 100%)'
background: '#fff7ed'
color: '#6d28d9'
```

## Review Checklist

Trước khi merge một thay đổi UI:

1. Search các hardcode có rủi ro theme:

```powershell
Get-ChildItem -Path .\frontend\src -Recurse -File -Include *.ts,*.tsx,*.css |
  Select-String -Pattern '#fff7ed|#fffaf0|#fff3e0|#e0f2fe|#ede9fe|rgba\(15, 23, 42|rgba\(2, 6, 23'
```

2. Kiểm tra shell dùng chung:
   - `frontend/src/ui/OverlayModal.tsx`
   - `frontend/src/ui/styles.ts`
   - `frontend/src/ui/tokens.ts`
   - `frontend/src/index.css`

3. Kiểm tra native controls:
   - `select`
   - `option`
   - `input`
   - `textarea`

4. Kiểm tra 4 trạng thái tối thiểu:
   - light mode desktop
   - dark mode desktop
   - light mode mobile
   - dark mode mobile

5. Chạy verify:

```powershell
cd frontend
npm run build
```

## Refactor Trigger

Nếu thấy một màu hoặc gradient lặp từ 2 nơi trở lên:

- không copy thêm lần thứ 3
- dừng lại và nâng nó lên token semantic

Nếu thấy một component shared đang áp theme riêng theo màn:

- đưa logic đó về `ui/` layer
- không để mỗi feature tự override bằng hardcode

## Current Implementation References

Các file hiện đang là chuẩn tham chiếu sau đợt refactor light/dark mode:

- `frontend/src/index.css`
- `frontend/src/ui/tokens.ts`
- `frontend/src/ui/OverlayModal.tsx`
- `frontend/src/Products.tsx`
- `frontend/src/ops/GanttCommandBar.tsx`
- `frontend/src/ops/OperationsOverview.tsx`
- `frontend/src/projects/ProjectWorkspaceHub.tsx`

Khi thêm màn mới, hãy copy pattern từ các file này thay vì dựng màu mới từ đầu.
