# Thiết Kế: Theo Dõi Tỷ Giá VCB, Snapshot QBU, Và Cảnh Báo (>=2.5% hoặc 6 Tháng)

Ngày: 2026-03-23
Phạm vi: Sản phẩm/QBU, Bán hàng, Báo giá

## Mục tiêu
- Lưu được tỷ giá tại thời điểm nhập QBU (làm căn cứ lịch sử).
- Lấy tỷ giá hiện tại từ Vietcombank (VCB) theo ngày.
- Cảnh báo khi tỷ giá hiện tại tăng >= 2.5% so với tỷ giá gần nhất lúc nhập QBU.
- Cảnh báo nếu đã quá 6 tháng kể từ lần cập nhật QBU gần nhất (dựa trên Product.qbuUpdatedAt).
- Hiển thị cảnh báo ở 3 khu vực: Sản phẩm/QBU, Bán hàng, Báo giá.

## Phạm vi ngoài
- Không tự động thay đổi giá bán hay báo giá.
- Không triển khai logic tính giá mới; chỉ cảnh báo.

## Thiết kế dữ liệu
### 1) Bảng ExchangeRate (SQLite)
- id TEXT PRIMARY KEY
- baseCurrency TEXT (ví dụ: USD)
- quoteCurrency TEXT (ví dụ: VND)
- rate REAL
- source TEXT (VCB/manual)
- effectiveDate TEXT (YYYY-MM-DD)
- createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
Chỉ định “latest rate”:
- Latest = bản ghi có effectiveDate lớn nhất theo VN timezone.
- Nếu có nhiều bản ghi cùng effectiveDate, chọn bản có createdAt mới nhất.

### 2) Product (bổ sung 3 cột snapshot gần nhất của QBU)
- qbuRateSource TEXT
- qbuRateDate TEXT (YYYY-MM-DD)
- qbuRateValue REAL
Nguồn dữ liệu chính (source of truth) cho snapshot là 3 cột này. qbuData.rateSnapshot là bản sao để UI hiển thị nhanh.

### 3) QBU snapshot ở qbuData (JSON)
- qbuData.rateSnapshot = { source, date, rate }
- Mục tiêu: lưu căn cứ tỷ giá đúng thời điểm nhập QBU.

## Luồng dữ liệu
### A) Cập nhật tỷ giá VCB
- Job hàng ngày (timezone VN) lấy tỷ giá VCB -> lưu vào ExchangeRate.
- Rate type dùng để lưu: **VCB Transfer Selling Rate** (bán chuyển khoản) cho USD/VND.
- Nếu rate type này không có trong payload: trả warning, không ghi mới.
- Nút cập nhật thủ công trên Settings gọi API refresh.
- Nếu fetch lỗi: giữ rate gần nhất, API trả warning + lastKnownRateDate.

### B) Nhập/Cập nhật QBU
- Khi user lưu QBU:
  - Lấy tỷ giá latest từ ExchangeRate (USDVND, source=VCB).
  - Ghi vào qbuData.rateSnapshot.
  - Cập nhật qbuRateSource/qbuRateDate/qbuRateValue ở Product.
  - Cập nhật qbuUpdatedAt.

### C) Tính cảnh báo
- Cảnh báo tỷ giá:
  - latestRate >= qbuRateValue * 1.025
- Cảnh báo 6 tháng:
  - now - qbuUpdatedAt >= 6 tháng (định nghĩa: **>= 6 calendar months** theo VN timezone)
- Hiển thị nếu thỏa 1 trong 2 điều kiện.

## API dự kiến
- GET /api/exchange-rates/latest?pair=USDVND
  - Trả { rate, source, effectiveDate, warnings?: string[] }
- POST /api/exchange-rates/refresh
  - Trigger cập nhật thủ công từ VCB
  - Success: 200 + { rate, effectiveDate, warnings?: string[] }
  - Failure: 502 + { error, lastKnownRateDate? }
- GET /api/products, /api/products/:id
  - Trả kèm qbuRateSource, qbuRateDate, qbuRateValue, qbuUpdatedAt, qbuData.rateSnapshot

## UI/UX
- Sản phẩm/QBU:
  - Badge cảnh báo ngay trong tab QBU.
- Bán hàng:
  - Badge cảnh báo trên dòng sản phẩm (nếu có màn Bán hàng riêng).
- Báo giá:
  - Badge cảnh báo tại dòng chọn sản phẩm.
- Nội dung cảnh báo:
  - "Tỷ giá hiện tại tăng >= 2.5% so với lần nhập QBU gần nhất. Cần tính lại."
  - "QBU đã quá 6 tháng. Cần cập nhật lại."

## Xử lý lỗi & fallback
- Nếu chưa có tỷ giá trong ExchangeRate: hiển thị "Chưa có tỷ giá VCB" và không so sánh.
- Nếu qbuRateValue null: chỉ cảnh báo 6 tháng (nếu đủ điều kiện) hoặc bỏ qua.
- Nếu qbuRateValue khác qbuData.rateSnapshot.rate: ưu tiên qbuRateValue (source of truth).

## Testing
- Unit test logic so sánh tỷ giá >= 2.5%.
- Unit test logic 6 tháng.
- Integration test: update QBU -> lưu snapshot -> GET Product -> trả snapshot + cảnh báo.
- Test boundary VN timezone (effectiveDate cuối ngày).
- Test khi chưa có rate (no comparison).
- Test snapshot missing: UI hiển thị “Snapshot missing”.

## Rủi ro
- Endpoint VCB thay đổi: cần cấu hình URL ở SystemSetting để dễ cập nhật.
- Dữ liệu lịch sử QBU cũ không có snapshot: fallback không so sánh tỷ giá.

## Ghi chú phạm vi
- Manual rate entry chưa triển khai trong v1 (chỉ ghi nhận source=manual cho tương lai).
- Cần index cho ExchangeRate: (baseCurrency, quoteCurrency, effectiveDate).
