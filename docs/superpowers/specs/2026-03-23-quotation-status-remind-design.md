# Quotation Status Transitions + Remind Badge

Date: 2026-03-23

## Summary
Add controlled quotation status transitions (draft -> sent -> accepted/rejected) and a "Remind" visual badge when a sent quotation is older than 14 days based on `createdAt`. The remind is a UI-only label and does not change `status`.

## Goals
- Allow status changes in both list view and detail view with enforced transitions.
- Show a "Remind" badge for sent quotations older than 14 days.
- Keep the data model unchanged (no DB schema change).

## Non-Goals
- No new DB fields such as `sentAt`.
- No automation to change status on its own.
- No email or notification sending.

## Current State
- Status is stored as a string in `Quotation.status`.
- The list view shows a status pill; no status transitions are available in UI.
- Backend accepts any `status` value on update (no validation).

## Decisions
- Valid statuses: `draft`, `sent`, `accepted`, `rejected`.
- Allowed transitions:
  - `draft -> sent`
  - `sent -> accepted`
  - `sent -> rejected`
- Remind logic:
  - `isRemind = (status === 'sent') && (nowUtc - createdAt >= 14 * 24h)`
  - Compute on server using UTC time.
  - `createdAt` is treated as ISO 8601 UTC and compared by milliseconds since epoch.
  - Based on `createdAt` (known limitation until a future `sentAt` exists). This means a quote created long ago may show Remind immediately after being sent.
  - Remind does not change status.
  - If `createdAt` is missing/invalid or in the future, `isRemind = false`.
  - Boundary is inclusive: exactly 14 * 24h qualifies as Remind.
- Terminal status lock: when `status` is `accepted` or `rejected`, the quotation is fully read-only (no edits).
- Legacy/unknown statuses: treat as read-only and show a fallback badge label `LEGACY` with tooltip “Unsupported status; editing disabled.” (no transitions allowed).

## Backend Changes
- `GET /api/quotations` returns `isRemind` computed from `createdAt`.
- `GET /api/quotations/:id` returns `isRemind` computed from `createdAt`.
- `PUT /api/quotations/:id` enforces allowed transitions and terminal lock.
  - If invalid, return `400` with a clear error.
- Log activity when status changes.
- Validate status on create (`POST /api/quotations`):
  - If `status` missing: default to `draft`.
  - If `status` present but invalid: return `400`.

### Transition Validation
- Precedence order:
  1. If current status is legacy/unknown -> block all updates.
  2. If current status is `accepted` or `rejected` -> block all updates.
  3. If `expectedStatus` provided and mismatches -> return `409`.
  4. Otherwise validate transition (if `status` present) or allow update (if `status` absent).
- If current status is `draft`, only allow `sent`.
- If current status is `sent`, allow `accepted` or `rejected`.
- If status unchanged, allow update (only if not blocked by precedence rules).
- If current status is `accepted` or `rejected`, block all updates (read-only).
- If request includes `expectedStatus` and it differs from current status, return `409` (conflict) and include `currentStatus` in response.
- If `expectedStatus` is missing, skip concurrency check.
- If body omits `status`, treat as “unchanged” but still enforce locks.

## Frontend Changes
- List view (quotations table):
  - Show status badge as today.
  - If `isRemind`, show an additional "Remind" badge.
  - Add a status selector or action menu in the row to change status (only valid next steps, not the current status).
  - Disable actions while saving; refetch after success.
  - Hide/disable row actions for read-only (accepted/rejected) and legacy statuses.
- Detail view (quotation form):
  - Add a status selector near action buttons.
  - If `isRemind`, show warning text: “Reminder: báo giá đã gửi hơn 14 ngày.”
  - If status is `accepted` or `rejected`, disable all editing controls and show a read-only notice.
- After status change, refresh list data and show a success toast.

## Error Handling
- Backend returns 400 on invalid transition with message, frontend displays toast.
- Error response shape: `{ code, message, allowed? }`.
- `409` when `expectedStatus` mismatches current status.
- Keep UI consistent with backend-allowed transitions to avoid errors.
  - Invalid status/transition: `code = INVALID_STATUS_TRANSITION`, include `allowed`.
  - Legacy/terminal lock: `code = READ_ONLY`, `allowed: []`.
  - Concurrency mismatch: `code = STATUS_CONFLICT`, include `currentStatus`.

## Testing
- API tests:
  - Valid transitions succeed.
  - Invalid transitions return 400.
  - `isRemind` true when createdAt >= 14 days and status == sent.
  - Terminal status blocks edits.
  - `expectedStatus` mismatch returns 409.
  - Legacy/unknown status blocks updates.
  - Missing/invalid/future `createdAt` yields `isRemind=false`.
  - Omitting `status` in PUT still enforces locks.
- UI tests (manual):
  - Status selector shows only valid next steps.
  - Remind badge displays on qualifying rows.
  - Read-only behavior on accepted/rejected.

## Rollout
- No migration required.
- Deploy backend first, then frontend.
