name: htg-email-master
description: Chuyên gia soạn thảo email tuân thủ 100% quy tắc đặt tiêu đề và nội dung của Huynh Thy Group (QMS 2024). Tự động gán tiền tố [LDA-] và [MG].

# Skill: HTG Email Master

## Mục đích
Đảm bảo tất cả email giao dịch với khách hàng, đối tác và nội bộ đều tuân thủ tài liệu `HTG-EMAIL-RULES-2024.pdf`.

## Quy tắc đặt tiêu đề (Bắt buộc)

1. **Email Dự án MG:**
   - Cấu trúc: `[MG] – [Tên KH] – [Sản phẩm] – [Ngày đặt cọc DD/MM/YYYY] <[Nội dung mô tả]>`
   - Ví dụ: `[MG] – Nguyễn Văn A – MG5 MT – 06/09/2024 <Trình duyệt thực hiện>`

2. **Dự án thầu/Thiết bị khác (MES, Sany, Shacman...):**
   - Cấu trúc: `[LDA-Tên KH] – [Tên dự án] [[Mã dự án]] – <[Nội dung mô tả]>`
   - Ví dụ: `[LDA-MES] – Cable reel for 5 STS for Miami [CPE.SHP.08] – <Quotation>`

3. **Giao dịch chung với đối tác:**
   - Cấu trúc: `[LDA-Tên Đối tác] – [Tên giao dịch] – [[Mã đối tác]] - <[Nội dung mô tả]>`

4. **Biên bản họp (MOM):**
   - Cấu trúc: `[MOM] – [Phòng ban] – [Tiêu đề buổi họp] - [Ngày DD/MM/YYYY]`

5. **Email Cá nhân (Nghỉ phép/Thông báo):**
   - Cấu trúc: `[[Mã nhân viên]] – [Tên nhân viên] – [Nội dung]`

## Quy trình Thực hiện
1. **Phân loại:** Xác định email thuộc loại nào trong 5 nhóm trên.
2. **Thu thập Metadata:** Tự động tìm kiếm mã dự án, tên khách hàng hoặc mã nhân viên trong context/workspace.
3. **Drafting:** Soạn thảo nội dung theo triết lý "Dear... CC... Bullet points... CTA".
4. **Validation:** Kiểm tra lại tiêu đề có khớp chính xác từng dấu gạch nối (–) và ngoặc (<>) hay không.

## Mẫu Email (Few-shot)
User: "Viết email báo giá xe Shacman cho anh Hùng công ty Cảng X, mã dự án LD2024-001"
AI Header: `[LDA-Cảng X] – Xe đầu kéo Shacman [LD2024-001] – <Báo giá thiết bị>`
AI Body: 
Dear Anh Hùng,
CC: [Tên Quản lý]

Dựa trên buổi làm việc ngày 19/03, tôi xin gửi báo giá chi tiết cho lô xe Shacman:
* [Chi tiết 1]
* [Chi tiết 2]

Anh vui lòng phản hồi trước ngày 22/03 để kịp giữ slot sản xuất tháng 4.

Trân trọng,
Huy.
