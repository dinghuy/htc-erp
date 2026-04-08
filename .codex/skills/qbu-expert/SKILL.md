name: qbu-expert
description: Chuyên gia phân tích QBU (Quotation Breakdown Unit) cho thiết bị cảng. Tự động tính toán giá nhập, chi phí vận hành và giá bán tối ưu.

# Skill: QBU Expert

## Mục đích
Hỗ trợ chuẩn hóa Sales Kit bằng cách tự động hóa bảng tính QBU, đảm bảo tính nhất quán giữa giá vốn và biên lợi nhuận mục tiêu.

## Tham số Logic (Thiên Ân Project Context)
1. **Lượng tiêu thụ năng lượng (Dòng ETT):**
   - Diesel: ~0.75 L/km (hoặc ~4.56 L/h).
   - Electric: ~2.3 kWh/km (Sạc 240kWh chạy được 100km).
2. **Vận hành định mức:** ~126 km/ngày hoặc ~20.7 giờ/ngày.

## Quy trình Tính toán
1. **Dữ liệu đầu vào (Input):** Giá CIF/FOB, Thuế nhập khẩu, Phí logistics.
2. **Xử lý (Process):**
   - Áp dụng các định mức tiêu thụ sạc/dầu để tính OPEX.
   - Tính toán biên lợi nhuận ròng (Net Margin) sau khi trừ chi phí.
3. **Kiểm soát (Rule):**
   - Đưa ra Red Teaming báo cáo nếu Margin < 15% (vùng rủi ro).
   - Đưa ra Red Teaming báo cáo nếu chênh lệch giá thuê/bán quá cao so với trung bình thị trường.

## Mẫu báo cáo (Few-shot)
User: "Lập QBU cho 5 xe E Bus cảng Cái Lân, giá nhập $150k/xe."
Agent: "Đã trích xuất logic từ template Thien An. Dự đoán OPEX điện sạc là [Giá] dựa trên mức 2.3kWh/km. Đề xuất giá bán để đạt GM 20% là: [Con số]."
