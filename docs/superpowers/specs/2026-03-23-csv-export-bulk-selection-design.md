# CSV Export + Bulk Selection Design

## Muc tieu
- Them export cho suppliers.
- Chuan hoa CSV escape de an toan voi dau phay, xuong dong, dau nhay kep.
- Giam rui ro CSV injection khi mo bang Excel.
- Them chon nhieu hang va bulk actions cho tat ca bang du lieu.

## Pham vi
- Backend: export suppliers, CSV escape helper, export ho tro loc theo danh sach id (neu truyen).
- Frontend: them checkbox chon nhieu hang, thanh bulk actions, bulk delete/export/status update.

## Thiet ke Backend
### 1) CSV escape helper
- Them ham `csvEscape(value, opts)`:
  - Null/undefined -> chuoi rong.
  - Chuyen value sang string.
  - CSV injection mitigation (xem muc 2).
  - Neu gia tri co ky tu `,` hoac `\n` hoac `\r` hoac `"` thi:
    - Bao trong dau `"`.
    - Thay `"` thanh `""`.
- Ap dung cho tat ca export endpoints.

### 2) CSV injection mitigation
- Neu gia tri (sau khi trim) bat dau bang mot trong cac ky tu: `=`, `+`, `-`, `@` thi prefix 1 dau `'`.
- Truong hop so thuan (numeric fields) se KHONG prefix de khong lam sai gia tri.
- Numeric allowlist bat buoc theo export type (neu them field so moi phai cap nhat allowlist):
  - products: `basePrice`
  - accounts, leads, suppliers, users, contacts: khong co numeric field can allowlist.

### 3) Suppliers export
- Endpoint: `GET /api/suppliers/export`.
- Header: `code,company,description,tag,country,status`.
- Data mapping:
  - `code` -> Account.code
  - `company` -> Account.companyName
  - `description` -> Account.description
  - `tag` -> Account.tag
  - `country` -> Account.country
  - `status` -> Account.status
- Filter: chi lay Account voi `accountType='Supplier'`.

### 4) Export theo danh sach id
- Cho tat ca export endpoints, neu query `ids` (phan tach bang dau phay) thi chi export cac id do.
- Gioi han so luong ids: mac dinh 500 (de tranh vuot gioi han URL). Neu vuot, tra ve 400.
- Frontend neu nhan 400: thong bao "Ban da chon qua 500 dong. Hay loc nho hon truoc khi xuat CSV.".
- Neu khong co `ids`, export toan bo (giu hanh vi cu).

### 5) Headers & filename
- Headers: `Content-Type: text/csv; charset=utf-8` va `Content-Disposition: attachment; filename=...`.
- Filename: `export_<type>_YYYYMMDD_HHmm.csv`.
- Giu BOM `\uFEFF` de Excel doc dung UTF-8.

## Thiet ke Frontend (Bulk Selection)
### 1) UI
- Them cot checkbox o dau bang (header + row).
- Header checkbox: chon tat ca cac dong dang duoc filter hien thi.
- Khong co pagination hien tai, nen "select all" = tat ca dong dang hien tren bang.
- Neu tuong lai co pagination/virtualization, can cap nhat hanh vi select-all.
- Thanh bulk actions hien thi khi `selectedCount > 0`.

### 2) Bulk actions (mac dinh)
- Bo chon.
- Xoa.
- Xuat CSV (neu co selected -> export theo ids; neu khong -> export toan bo).
- Cap nhat trang thai (chi hien thi o bang co truong status).

### 3) Hanh vi
- Xoa hang loat: confirm 1 lan, goi DELETE tung id, thong bao so thanh cong/that bai.
- Cap nhat trang thai: chon status, goi PUT tung id voi payload `{ status: newStatus }`.
- Export: mo url export voi query `ids`.
- De giam tai, thuc thi bulk thao tac theo batch (concurrency 5).
- Gioi han bulk action toi da 500 dong (dong bo voi gioi han export). Neu vuot, thong bao nguoi dung de loc nho hon.

## Xu ly loi
- Neu mot phan thao tac loi: thong bao "X thanh cong, Y that bai".
- Best-effort, khong rollback.

## Kiem thu
- Test CSV export voi du lieu co dau phay, dau nhay kep, xuong dong.
- Test CSV injection: du lieu bat dau bang `=` hoac `+` hoac `-` hoac `@`.
- Test bulk select: chon tat ca, bo chon, xoa nhieu, export nhieu.

## Ghi chu
- Ung dung hien tai khong co phan quyen, nen export ids khong them logic permission.
- Khong thay doi schema DB.
- Uu tien it thay doi de giam rui ro.
