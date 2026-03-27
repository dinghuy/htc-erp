# Quotation PDF + Preview Pixel-Perfect Design (2026-03-22)

## Goal
Match the provided reference images pixel-perfect for both the in-app preview and the generated PDF. The PDF output and the preview should align in layout, typography, spacing, line weights, and table structure.

## Inputs & Assets
- Logo: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\LDA-logo.png`
- Font: `C:\Users\dinghuy\OneDrive - HUYNH THY GROUP\Antigravity Workspace\Times New Roman.ttf`
- Header text: Use exactly the text from the reference images.

## Layout Spec (A4 Portrait)
1. **Header**
   - Left: L&D logo at fixed size, aligned to top-left margin.
   - Right: Company info block aligned right; company name bold, address/tel/fax smaller.
   - Separator: Thin blue horizontal line below header.

2. **Title Block**
   - Centered title: `QUOTATION/BÁO GIÁ` in uppercase, bold.
   - Centered quote number: `No/Số: ...` just below title.

3. **Customer & Sales Info Grid**
   - Two-column grid beneath title.
   - Left column labels: Customer/KH, Address/DC, Tax/MST, Contact/LH, Subject/Nội dung.
   - Right column labels: Date/Ngày, Sale/NV, Crcy/Tiền, Phone/ĐT.
   - Labels bold, values normal.

4. **Intro Paragraph**
   - Two lines as in reference, Times New Roman 10–11pt.
   - Tight line-height to match image.

5. **Items Table**
   - Column order and headings:
     `No/Stt | Part name/Mã hàng | Commodity/Tên hàng hoá | Unit/ĐVT | Q.ty/S.lg | Unit price/Đơn giá | Total/Thành tiền | Remarks/Ghi chú`
   - Header background blue, text white (or exact contrast per image).
   - Grid lines thin (0.8–1px) in table body.
   - Commodity column supports multiline bullet-like text.
   - Row numbering supports nested `2.1`, `2.2`.

6. **Remarks & Terms**
   - `Remark:` label bold/italic, followed by English and Vietnamese remark lines (italicized text as in reference).
   - Terms section split into two columns:
     Left: English terms, Right: Vietnamese terms.
   - Numbered list, tight spacing.

7. **Closing + Signatures**
   - Closing sentence: `Best regard/Trân trọng./.`
   - Two signature blocks aligned left/right:
     Left: `L&D AUTO COMPANY LIMITED` and Vietnamese line.
     Right: `CUSTOMER` and Vietnamese line.

## Typography
- Primary font: Times New Roman (embedded in PDF).
- Size range: 9–12pt; title larger (per reference).
- Bold used for labels and section headings only.

## Preview Implementation
- Use the same font (Times New Roman) in preview via CSS `font-family`.
- Constrain preview box to A4 ratio and scale to fit sidebar while preserving proportions.
- Ensure spacing, line-heights, borders, and table grid match the PDF output.

## PDF Implementation
- Embed Times New Roman using pdf-lib fontkit.
- Use fixed coordinates and measured widths to match the reference.
- Use exact column widths and row heights as in the reference images.

## Data Mapping
- `quoteNumber`, `quoteDate`, `customer`, `contact`, `currency`, `salesPerson`, `salesPersonPhone`, `items`, `terms`, `remarks` map directly to fields as shown in the images.
- Long commodity text wraps within its column without overflow.

## Acceptance Criteria
- Visual parity between preview and generated PDF (side-by-side visually indistinguishable at normal zoom).
- Header, table, and terms sections match the reference images in spacing and typography.
- Logo and header text exactly match provided assets and text.
