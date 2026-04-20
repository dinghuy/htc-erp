# Kế hoạch: Chỉnh sửa & Tối ưu phần User

## Context

Phần User trong HTC ERP cần được cải thiện ở 3 mặt:
1. **Frontend** — `Users.tsx` (1480 dòng) và `SettingsScreen.tsx` (24K+ dòng) quá lớn, bulk import bị tắt cứng, thiếu UX rõ ràng cho account status vs HR status
2. **Backend** — Routes không có schema validation (Zod), không enforce email/username uniqueness, avatar upload không giới hạn kích thước
3. **Stash/uncommit trước 19/4** — 8 stash đang treo, branch WIP, cần phân loại trước khi làm việc mới

---

## Phase 0 — Triage stash & branches trước 19/4

> Mục tiêu: không mất work cũ, không bị conflict ngầm.

### Stash cần xem lại

| Stash | Mô tả | Hành động đề xuất |
|-------|--------|-------------------|
| `stash@{0}` | WIP: port fallback behavior | Xem diff, quyết định apply hay drop |
| `stash@{1}` | codex-main-premerge-20260420 | Xem diff — likely safe to drop nếu đã merge |
| `stash@{2}` | codex-source-premerge-20260420 | Tương tự stash@{1} |
| `stash@{3}` | GitHub Desktop feat/user-edit | **Ưu tiên cao** — liên quan trực tiếp user module |
| `stash@{4-7}` | pre-rewrite, pre-rebase, pre-rewrite-local | Likely pre-safety snapshots, có thể drop |

**Lệnh triage nhanh:**
```bash
git stash show -p stash@{0}   # port fallback WIP
git stash show -p stash@{3}   # feat/user-edit changes
```

### Branch WIP cần xem

- `chore/isolate-main-wip-2026-04-19` — kiểm tra `git log --oneline main..chore/isolate-main-wip-2026-04-19`
- `chore/local-integration-2026-04-19` — tương tự
- `feat/user-edit` — có thể chứa work liên quan User UI, check trước khi làm mới

---

## Phase 1 — Backend: Validation Layer

**Files cần sửa:**
- `backend/src/modules/users/routes.ts` (156 dòng)
- Tạo mới: `backend/src/modules/users/schemas.ts`

### Việc cần làm

1. **Tạo `schemas.ts`** với Zod schemas:
   ```
   CreateUserSchema — required: fullName, email, role
                    — optional: phone, department, gender, language, employeeCode, dateOfBirth
                    — email: z.string().email()
                    — password: z.string().min(8) nếu có
   UpdateUserSchema — partial của CreateUser
   ImportUserRowSchema — validate row-level trong bulk import
   ```

2. **Thêm uniqueness check trong `service.ts`**:
   - Trước `createUser`: check email không trùng → throw `409 Conflict`
   - Trước `updateUser`: check email không trùng với user khác

3. **Avatar upload limit trong `routes.ts`**:
   - Thêm `limits: { fileSize: 2 * 1024 * 1024 }` vào multer config (hiện không có)

**Reuse:** pattern validation đã có trong quotations module (`backend/src/modules/quotations/schemas/`)

---

## Phase 2 — Frontend: Bật bulk import & tách file

**Files cần sửa:**
- `frontend/src/userCrudHelpers.ts:26` — xóa `false &&`
- `frontend/src/Users.tsx` — tách thành các component con

### Chi tiết

1. **Bật bulk import** (1 dòng fix):
   ```ts
   // Trước:
   return false && canManageUsersView;
   // Sau:
   return canManageUsersView;
   ```
   → Test: đăng nhập admin, vào Users, kiểm tra nút Import/Export hiện ra

2. **Tách `Users.tsx`** (1480 dòng → ~4 files nhỏ):
   - `UserTable.tsx` — table + filters + pagination
   - `UserFormModal.tsx` — Add/Edit modal (reuse AddUserModal + EditUserModal)
   - `UserDetailPanel.tsx` — tabbed detail (Profile, Access, Security, Activity)
   - `Users.tsx` — orchestrator (~200 dòng)

   **Không** tách `SettingsScreen.tsx` trong scope này (24K dòng, quá rủi ro, cần branch riêng).

3. **Làm rõ account status vs HR status trong UI**:
   - Thêm tooltip/hint cạnh trường `status` giải thích "Trạng thái nhân sự" vs `accountStatus` = "Trạng thái tài khoản"
   - Không cần thay đổi logic, chỉ label và hint text

---

## Phase 3 — Frontend: Password reset flow (tùy chọn)

Chỉ làm nếu Phase 1 & 2 xong và không có rủi ro scope creep.

- Admin: thêm button "Gửi link đặt lại mật khẩu" trong UserDetailPanel > Security tab
- Non-admin: link "Quên mật khẩu" trên màn hình login
- Backend cần endpoint `POST /api/users/:id/send-reset-email` — **chưa có**, cần backend work riêng

---

## Files then chốt

| File | Vai trò |
|------|---------|
| `frontend/src/Users.tsx` | Main user screen — quá lớn, cần tách |
| `frontend/src/userCrudHelpers.ts` | Bulk import flag — fix 1 dòng |
| `backend/src/modules/users/routes.ts` | HTTP handlers — thiếu validation |
| `backend/src/modules/users/service.ts` | Business logic — thiếu uniqueness check |
| `backend/src/modules/users/schemas.ts` | **Tạo mới** — Zod validation |
| `frontend/src/shared/domain/contracts.ts` | Permissions — chỉ đọc tham khảo |

---

## Thứ tự thực hiện đề xuất

```
Phase 0: Triage stash@{0} và stash@{3}, branch feat/user-edit
  → 15 phút, quyết định apply hay drop
Phase 1: Backend schemas.ts + validation routes  
  → ~2h, ít rủi ro, không thay đổi UI
Phase 2a: Bật bulk import (1 dòng)
  → ~5 phút + test
Phase 2b: Tách Users.tsx
  → ~3h, rủi ro trung bình (refactor)
Phase 3: Password reset  
  → Để backlog
```

---

## Verification

- Backend: `pnpm --dir backend typecheck && pnpm --dir backend test:core`
- Frontend: `pnpm --dir frontend typecheck && pnpm --dir frontend test:core && pnpm --dir frontend build`
- UAT: đăng nhập admin local (QA seed), test tạo user mới với email trùng → expect 409, test bulk import button hiện ra