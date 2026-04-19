# Users.tsx UI/UX Design Spec (Pending Approval)

Date: 2026-04-18
Scope target: `frontend/src/Users.tsx`
Status: Pending team-lead approvals A/B/C

## 1) Scope and boundaries

- `frontend/src/Users.tsx` only.
- Preserve admin-manage vs directory-readonly split.
- No API changes.
- No permission model changes.

## 2) Screen architecture

- Structure: hero/context -> filters/actions -> data surface.
- Admin mode: KPI chips + operational filters.
- Directory mode: lookup-first presentation.

## 3) Data presentation

- Admin: sortable desktop table + mobile cards.
- Directory: contact-first table/cards.
- Keep concise status and metadata density.

## 4) Add/Edit information architecture

- Keep grouped sections: Personal / Work / Account.
- Keep auto-username assist behavior.
- Preserve role normalization behavior.

## 5) Side panel behavior

- Manage mode: Profile / Access / Security / Activity tabs.
- Readonly mode: profile-only view.
- Lock/unlock remains confirmation-gated.

## 6) Theme/token discipline

- Token/UI primitives only.
- No new hardcoded theme colors.
- Reuse existing Users semantic constants.

## 7) Copy/language policy

- Reduce mixed EN/VI where meaning overlaps.
- Keep intentional bilingual only for domain/system terms.
- Prefer i18n keys for normalized copy.

## 8) Verification gate

- Desktop + mobile UAT for both modes.
- `typecheck` + core tests + build.
- UX audit only if shell/preview invariants are touched.

## Approval checkpoints requested

- A) Sections 1-3
- B) Sections 4-5
- C) Sections 6-8

## Self-review

- [x] Content mirrors docs_lane section set exactly.
- [x] Scope constrained to `frontend/src/Users.tsx`.
- [x] Approval gating retained as pending, not finalized.
