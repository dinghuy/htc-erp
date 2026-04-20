# Quotation UI Convergence Plan

## Summary

Converge the active quotation surface in two phases:

1. Clean up the current checked-in source tree by hiding dormant project/revision/status controls, replacing list clutter with operational signals, restoring persisted VAT/totals controls, and hardening authoring overflow containment.
2. Add the optional-offer quotation model on top of the stabilized Phase 1 flow, using `lineItems[].isOption` as the canonical persisted flag and computing payable totals from main items only.

## Phase 1

- Remove project-linking and revision controls from the active quotation editor.
- Force create requests to send `autoCreateProject: false`.
- Remove list-level `Project`, `Revision`, `Tổng GT`, `Tạo SO`, and visible status-changing controls.
- Keep read-only status badges plus approval/reminder signals in the list.
- Persist `financialConfig.vatRate` and `financialConfig.calculateTotals` through the frontend/backend typed quotation contract.
- Place VAT and totals-toggle controls below the item workspace.
- Keep preview VAT labels dynamic and hide totals when `calculateTotals` is off.
- Add block-level overflow containment plus desktop fallback horizontal scroll for the split authoring layout.

## Phase 2

- Extend quotation line-item typed state and persistence with `isOption`, default `false`.
- Extend quotation line items with `currency`, `vatMode`, and `vatRate` so pricing semantics can be expressed per line instead of only at quotation level.
- Split the authoring surface into `Phương án chính` and `Phương án tùy chọn`.
- Keep quotation-level `currency` and `financialConfig.vatRate` as defaults for newly added lines, but treat per-line pricing fields as the source of truth after entry.
- Save a single `lineItems` array, serialized main-first then option-first with regenerated `sortOrder`.
- Render payable totals from main items only.
- Compute mixed-currency summaries per currency instead of forcing one misleading grand total across currencies.
- Allow all-optional quotations and hide preview totals in that state without adding an explanatory warning note.

## Verification

- Frontend quotation contract tests cover hidden controls, live VAT/totals wiring, optional-offer preview semantics, and per-line currency/VAT behavior.
- Frontend typecheck, targeted quotation Vitest runs, and production build must pass.
- Backend typed-state, create-flow, API, and typecheck verification must pass.
- Browser/UAT covers quotation authoring, list, preview, overflow containment, mixed/all-optional quotation behavior, and per-line currency/VAT pricing scenarios.
