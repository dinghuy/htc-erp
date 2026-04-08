# HTC ERP Database Table Rationalization Matrix

This matrix classifies active database tables in `backend/src/persistence/sqlite/bootstrap.ts`.
Completed reductions that are no longer active are tracked separately at the end of this document.

Reduction labels:

- `Keep separate`: preserve as-is
- `Merge into parent`: reduce later through a compatibility-backed migration
- `Remove legacy/dead`: remove because it is not the active runtime source
- `Defer`: do not merge now because the cost is higher than the benefit

## Decision Matrix

| Table | Domain | Shape | Runtime usage | Decision | Reason | Blocker / Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `Account` | CRM | root entity | High | Keep separate | Shared master data for customers and suppliers | None |
| `Contact` | CRM | 1:N from Account | High | Keep separate | Reused across quotation and account workflows | None |
| `Lead` | CRM | root entity | High | Keep separate | Distinct commercial funnel record | None |
| `Product` | Catalog | root entity | High | Keep separate | Core product source with media/QBU refs | None |
| `ExchangeRate` | Shared rates | time series | High | Keep separate | Historical rate snapshots are queried independently | None |
| `Project` | Project workspace | root entity | High | Keep separate | Central execution boundary | None |
| `Task` | Tasking | 1:N from Project | High | Keep separate | Primary workflow child with blockers, ordering, ownership | None |
| `SupplierQuote` | Procurement | 1:N from Project / Account | High | Keep separate | Supplier-side quote workflow is distinct | None |
| `Quotation` | Commercial | root entity | High | Keep separate | Header-level commercial artifact | None |
| `QuotationLineItem` | Commercial | 1:N from Quotation | High | Keep separate | Real line-item child table | None |
| `QuotationTermItem` | Commercial | 1:N from Quotation | High | Keep separate | Repeating bilingual term lines are true child rows | None |
| `Activity` | Audit/activity | append-only log | High | Keep separate | Shared audit/event feed | None |
| `ApprovalRequest` | Workflow | 1:N from Project/Quotation | High | Keep separate | Core approval engine table | None |
| `ProjectDocument` | Workflow/docs | 1:N from Project | High | Keep separate | Project-scoped review artifact | None |
| `ProjectBlocker` | Workflow | 1:N from Project | High | Keep separate | Explicit blocker register is domain-relevant | None |
| `ProjectContract` | Project commercial | 1:N over time | High | Keep separate | Main contract artifact | None |
| `ProjectContractAppendix` | Project commercial | 1:N from ProjectContract | High | Keep separate | Appendices are distinct legal/history entities | None |
| `ProjectExecutionBaseline` | Execution planning | 1:N over time | High | Keep separate | Baselines are versioned state snapshots | None |
| `ProjectProcurementLine` | Execution | 1:N from Project | High | Keep separate | Distinct procurement workflow state | None |
| `ProjectInboundLine` | Execution | 1:N from procurement line | High | Keep separate | Receiving is a separate operational event stream | None |
| `ProjectDeliveryLine` | Execution | 1:N from procurement line | High | Keep separate | Delivery is a separate operational event stream | None |
| `ProjectMilestone` | Execution | 1:N from Project | High | Keep separate | Active runtime milestone source | None |
| `ProjectTimelineEvent` | Execution/audit | 1:N from Project | High | Keep separate | Timeline is append-only and separate from milestone state | None |
| `PricingQuotation` | Pricing | root entity | High | Keep separate | Pricing draft/root aggregate | None |
| `PricingLineItem` | Pricing | 1:N from PricingQuotation | High | Keep separate | Real pricing child rows | None |
| `PricingMaintenancePart` | Pricing | 1:N from PricingQuotation | High | Keep separate | Repeating PM parts are true child rows | None |
| `PricingCostEntry` | Pricing actuals | 1:N from PricingQuotation | High | Keep separate | Cost entries are append-like finance records | None |
| `SalesOrder` | Commercial/execution | root entity | High | Keep separate | Active handoff target and execution trigger | None |
| `User` | Identity/RBAC | root entity | High | Keep separate | Canonical identity source | None |
| `ChatMessage` | Collaboration | 1:N | High | Keep separate | Distinct message stream | None |
| `Notification` | Collaboration | 1:N per user | High | Keep separate | Delivery/read state is independent | None |
| `EntityThread` | Collaboration | root/thread | High | Keep separate | Thread header is distinct from messages | None |
| `EntityThreadMessage` | Collaboration | 1:N from EntityThread | High | Keep separate | True child message rows | None |
| `SupportTicket` | Support | root entity | High | Keep separate | Support flow is distinct | None |
| `ErpOutbox` | Integration | append/retry queue | High | Keep separate | Outbox semantics require dedicated table | None |
| `SystemSetting` | Shared config | key/value | High | Keep separate | Repo uses centralized setting lookup | None |
| `Funnel` | CRM support | lookup/order | Medium | Defer | Small table but still a distinct CRM construct | Merge brings little value now |
| `Department` | Org support | tree/lookup | Medium | Defer | Distinct org model; not obviously reducible | Merge would blur HR/user semantics |
| `HrRequest` | HR | workflow entity | Medium | Keep separate | Separate workflow table | None |
| `PublicHoliday` | HR calendar | lookup/time series | Medium | Keep separate | Used as independent calendar source | None |
| `ProductCategory` | Catalog | hierarchy | Medium | Keep separate | Proper category tree | None |
| `ContactChannel` | CRM | 1:N from Contact | Medium | Keep separate | Repeating channels are true child rows | None |
| `TimeSpendReport` | Worklog | 1:N from Task/User | High | Keep separate | True time-entry records | None |
| `TaskDependency` | Task graph | 1:N join edge | High | Keep separate | Graph edges should remain explicit | None |
| `TaskViewPreset` | User prefs | 1:N per user | Medium | Keep separate | Small but operationally clear and isolated | None |
| `ToDo` | Work management | root child | Medium | Keep separate | Separate checklist/todo surface | None |
| `WorkSlot` | Work management | 1:N from ToDo | Medium | Keep separate | Time blocks are repeating children | None |
## Completed Reductions

- `Milestone` -> removed as legacy in favor of `ProjectMilestone`; `DROP TABLE` added to `finalize.ts`
- `SalesPerson` -> merged into `User` behind `/api/salespersons` compatibility behavior; `DROP TABLE` in `finalize.ts:501`
- `QuotationFinancialConfig` -> merged into `Quotation`; `DROP TABLE` in `finalize.ts`
- `QuotationTermProfile` -> merged into `Quotation`; `DROP TABLE` in `finalize.ts`
- `PricingRentalConfig` -> merged into `PricingQuotation`; `DROP TABLE` in `finalize.ts`
- `PricingOperationConfig` -> merged into `PricingQuotation`; `DROP TABLE` in `finalize.ts`
- `HulyBridgeJob` -> orphaned ghost table (planned Huly sync integration never implemented); no source code references; `DROP TABLE` added to `finalize.ts`
- `TaskIntegrationLink` -> removed from source code; only existed in `dist/` (stale compiled artifact); `DROP TABLE` added to `finalize.ts`

## Current Reduction Policy

- Do not pursue more table reduction by collapsing true 1:N workflow children.
- Keep `QuotationLineItem`, `QuotationTermItem`, `PricingLineItem`, `PricingMaintenancePart`, and `PricingCostEntry` separate.
- Prefer future work on query shape, indexes, and runtime fallback removal over merge-for-merge's-sake table reduction.

## Hard Guards

Do not merge these categories just to reduce table count:

- workflow child tables
- append-only logs/queues
- graph/edge tables
- message/thread tables
- procurement/inbound/delivery operational state tables

If a future proposal wants to reduce table count further, it must explain why it does not damage workflow clarity or read/write stability.

## Dual-Track Text Field Resolution (Completed)

Two tables had FK columns added (`departmentId`, `categoryId`) but remained NULL because the lookup tables were empty. Fixed in `finalize.ts`:

- `Department` seeded from distinct `User.department` values; `User.departmentId` backfilled (8/8 rows linked)
- `ProductCategory` seeded from distinct `Product.category` values; `Product.categoryId` backfilled (13/13 rows linked)

**Future path:** When the HR and Catalog modules are actively used, `User.department TEXT` and `Product.category TEXT` should be deprecated in favor of the FK columns. Do not remove the text fields until all queries and UI have migrated to use the FK + JOIN pattern.

## Non-Merge Decisions (Reviewed)

Tables reviewed for merge potential but kept separate for documented reasons:

| Table | Reviewed decision | Reason |
|-------|-------------------|--------|
| `SalesOrder` | Keep separate | 1:1 with Quotation but stores a financial snapshot at order-time; items/totals are intentionally frozen independently of Quotation revisions. 254 code references. |
| `ChatMessage` | Keep separate | Global broadcast chat — no entityType/entityId; has per-message `readAt` tracking not present in `EntityThreadMessage`; semantically distinct from entity-scoped threads. |
| `Lead` | Keep separate | Pre-conversion CRM entity with different schema shape (contactName, source) and lifecycle from Account. Has `funnelId FK` linking to pipeline. |
| `Funnel` | Keep separate | FK-referenced by `Lead.funnelId`; designed for multiple configurable pipelines with sortOrder. Not a simple SystemSetting. |
| `ExchangeRate` | Keep separate | Time-series with date-range queries; cannot be stored in SystemSetting key-value. |
