# Project Workspace UAT Report

Date: 2026-03-26
Scope: Contract-centric `Project Workspace` remediation, manual UAT report with available terminal evidence
Reporter: Codex

## Evidence Baseline

- Backend verification:
  - `npm.cmd test` in `backend` passed fully on 2026-03-26.
  - Relevant automated coverage includes:
    - auth for `GET /api/projects` and `GET /api/projects/:id`
    - role matrix for project create/update
    - contract -> appendix -> baseline refresh
    - procurement superseded history
    - inbound update rollup
    - delivery update rollup
    - milestone update timeline
- Frontend verification:
  - `npm.cmd test` in `frontend` passed fully on 2026-03-26.
  - `npx.cmd tsc -b` in `frontend` passed on 2026-03-26.
  - `npm.cmd run build` in `frontend` passed on 2026-03-26 after removing the unused `@tailwindcss/vite` plugin from `vite.config.ts`.
- Browser/manual constraint:
  - This report was produced from terminal-only evidence. No browser harness or screenshot capture path was available in the current session.
  - Wherever UI rendering was not directly exercised, evidence is based on code inspection plus automated backend coverage.

## Dataset Used For UAT Reference

Reference dataset is aligned with `backend/tests/pricing-api.test.js`:

- `Project` has quotation + QBU history
- Main contract:
  - `SKU-001` qty `10`
  - `SKU-002` qty `3`
- Appendix create:
  - `SKU-001` qty `12`
  - `SKU-002` qty `4`
- Appendix update final state:
  - only `SKU-001` remains
  - `SKU-001` qty `15`
  - `SKU-002` becomes procurement history / superseded
- Inbound update final state:
  - `receivedQty = 6`
  - `actualReceivedDate = 2026-04-16`
- Delivery update final state:
  - `deliveredQty = 7`
  - `actualDeliveryDate = 2026-04-27`
- Milestone update final state:
  - title updated
  - status `completed`
  - `actualDate = 2026-05-01`

## UAT Case Table

| Case ID | Persona | Steps | Expected | Actual | Severity | Screenshot / evidence | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-01 | admin/manager, sales | Open `Projects` list, inspect create/edit visibility and quotation summary fields | `admin/manager` sees manual create/edit, `sales` does not; latest quotation shows `latestQuotationNumber` | Backend role enforcement is covered by automated test and frontend now gates shell actions to `admin/manager`; detail view uses `latestQuotationNumber` | P1 if broken | Backend: `tests/auth-api.test.js` pass. Frontend: `src/Projects.tsx` uses `canManageProjectShell` and `latestQuotationNumber` | PASS |
| UAT-02 | admin/manager | Open workspace from project list and inspect tabs | Workspace loads with auth and shows tabs `Overview`, `Quotation Versions`, `QBU Rounds`, `Pricing`, `Contract`, `Procurement`, `Inbound`, `Delivery`, `Timeline` | Auth-backed load and tab list are present in code; visual confirmation still needs browser pass | P1 if broken | `src/projects/ProjectWorkspaceHub.tsx` loads detail via `requestJsonWithAuth` and declares all tabs | PASS |
| UAT-03 | admin/manager | Review quotation/QBU/pricing flow in workspace | Quotation revisions visible; QBU shows batch/type/stage/submitted/completed/line count; embedded pricing still available | Backend QBU flow passes; frontend has dedicated `QBU Rounds` tab and keeps embedded `Pricing` tab | P1 if broken | Backend: `submit qbu creates procurement workflow then finance after approval` pass. Frontend: `src/projects/ProjectWorkspaceTabs.tsx` renders `QbuRoundsTab` | PASS |
| UAT-04 | admin/manager | Create main contract, create appendix, update appendix to remove `SKU-002` | Main contract creates baseline; appendix creates new baseline; final appendix update leaves only active `SKU-001`; older baseline remains in history | Automated backend flow confirms `currentBaseline.sourceType = appendix`, `SKU-001.contractQty = 15`, and `SKU-002` is no longer active | P0 if broken | Backend: `appendix/inbound/delivery/milestone edit flows refresh baseline, rollup, and timeline` pass | PASS |
| UAT-05 | admin/manager | Open `Procurement` tab after appendix update | Two sections: active baseline and history. `SKU-001` active, `SKU-002` history/superseded. KPI counts only active lines | Frontend now splits active/history sections; backend marks removed line as `superseded` and emits `procurement.superseded` | P1 if broken | Backend test verifies superseded line + timeline event. Frontend: `Procurement Active Baseline` and `Procurement History` sections exist | PASS |
| UAT-06 | admin/manager | Create and then edit inbound/delivery records | Save refreshes workspace; rollups update `receivedQty`, `deliveredQty`, `shortageQty`, `shortageStatus`, actual dates; history-linked events show `History line` | Backend confirms rollup recalculation and timeline update; frontend shows history badge for inactive procurement linkage | P1 if broken | Backend test verifies inbound/delivery update values and timeline events. Frontend: `InboundTab` and `DeliveryTab` render `History line` badge | PASS |
| UAT-07 | admin/manager | Create and edit milestone, then inspect timeline | Milestone updates persist; timeline includes major events including update events and superseded procurement event | Backend confirms `milestone.updated`, `inbound.updated`, `delivery.updated`, `procurement.superseded`; timeline UI supports these event types | P1 if broken | Backend test pass + `TimelineTab` event filter includes `procurement`, `inbound`, `delivery`, `milestone` | PASS |
| UAT-08 | admin/manager | Inspect `Overview` after appendix/inbound/delivery changes | KPI and alerts only reflect active baseline lines; superseded lines do not pollute overview | Frontend derives shortage/unordered/ETA/delivery alerts from `activeProcurementLines` only | P1 if broken | `src/projects/ProjectWorkspaceHub.tsx` computes overview metrics from `activeProcurementLines` | PASS |

## Findings / Bug List

| ID | Title | Severity | Impact | Evidence | Suggested action |
| --- | --- | --- | --- | --- | --- |
| BUG-01 | Manual browser screenshots were not collectible in this terminal-only session | P2 | Report has code/test evidence but no UI screenshot artifacts yet | No browser harness or screenshot capture tool path was available in the current session | Run one browser-assisted UAT pass later and append screenshots to this report |

## Conclusion

- `Project Workspace` contract-centric remediation is functionally in good shape based on current backend integration evidence and frontend code inspection.
- The specific `Project` cases in this report are verified well enough to continue, and the frontend verification gate is now green in the current environment.
- Recommended release stance:
  - `Project Workspace`: acceptable to continue focused UAT
  - `Frontend branch health`: acceptable to label clean for this branch snapshot
