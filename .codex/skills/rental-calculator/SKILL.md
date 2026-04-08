name: rental-calculator
description: Chuyên gia tính toán mô hình tài chính cho dịch vụ cho thuê thiết bị (Equipment Rental). Tự động phân bổ lãi vay lũy tiến và khấu hao theo loại sản phẩm.

# Skill: Rental Calculator

## Mục đích
Hỗ trợ kinh doanh tính toán giá thuê linh hoạt với các biến số tài chính định mức của công ty.

## Logic Tài chính (Định mức 2024)
1. **Lãi vay (Interest Rate):**
   - Năm 1 & 2: 12% / năm.
   - Từ năm 3 trở đi: Lãi suất tăng thêm 3% của giá trị lãi suất năm trước đó (Tăng trưởng lũy kế 3%).
   - Công thức: `i(t) = i(t-1) * 1.03` (với $t > 2$).
2. **Khấu hao (Depreciation):**
   - Tùy thuộc vào loại sản phẩm. 
   - *Lưu ý: Agent cần yêu cầu người dùng nhập loại thiết bị hoặc tham số năm khấu hao cụ thể.*

## Quy trình Tính toán
1. **Thu thập biến số:** Giá trị tài sản, Thời gian thuê (tháng/năm), Loại thiết bị.
2. **Xử lý dòng tiền:**
   - Tính tổng lãi vay phải trả dựa trên số năm thuê thực tế.
   - Tính mức khấu hao hàng tháng.
   - Cộng dồn chi phí bảo trì (OPEX) từ Knowledge Base.
3. **Đề xuất:** Xây dựng giao diện Web để người dùng nhập liệu và nhận kết quả tính toán trực quan, bám sát mô hình tài chính của công ty.

## Mẫu thực hiện
User: "Tính giá thuê cho lô Shacman ETT giá $150k trong 5 năm."
Agent: "Đã nạp logic lãi vay 12% (tăng lũy kế 3% từ năm 3) và định mức khấu hao. Đang khởi tạo giao diện Web Calculator để anh nhập liệu..."
