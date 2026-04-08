# HTC ERP Database Doctrine

## Purpose

This document defines the database design rules for `htc-erp`.

It replaces generic database advice with repo-specific doctrine for the current architecture:

- modular monolith
- SQLite runtime today
- PostgreSQL still a future target, not the current source of truth
- workflow-heavy application with read-heavy workspace and reporting surfaces

Use this document to evaluate schema changes, table reductions, query optimizations, and migration proposals.

## Core Rules

### 1. Model the workflow, not just the entities

Tables must reflect real business boundaries and workflow steps.

- Keep separate tables for true workflow entities such as `Task`, `ApprovalRequest`, `ProjectDocument`, `SalesOrder`, and `ProjectTimelineEvent`.
- Keep separate tables for true 1:N children such as `QuotationLineItem`, `PricingLineItem`, `ProjectProcurementLine`, `ProjectInboundLine`, and `ProjectDeliveryLine`.
- Do not merge workflow child tables just to reduce table count.

If removing a table makes the workflow harder to understand or hides state transitions inside opaque JSON, the reduction is not acceptable.

### 2. Use selective normalization

`htc-erp` does not optimize for academic normalization purity. It optimizes for correctness, maintainability, and fast operational reads.

- Normalize shared reference data that is edited often and reused across modules: `Account`, `Contact`, `User`, `Project`.
- Keep 1:N workflow children normalized when the child rows are independently filtered, ordered, or audited.
- Allow controlled denormalization when it improves read performance for dashboard, inbox, approvals, workspace, or executive reporting.

The question is not “can this be normalized more?” The question is “does normalization here improve the real system?”

### 3. Reduce table count only in specific cases

A table may be removed or merged only when it is one of the following:

- dead or unmounted legacy structure
- duplicate concept with a newer active source of truth
- weak 1:1 extension table whose fields do not justify the extra join cost

A table must not be merged only because “fewer tables looks simpler.”

### 4. Optimize reads for workspace and reporting

The workspace, inbox, approvals queue, home summary, ops summary, and executive cockpit are first-class product surfaces.

- Prefer aggregate CTEs, grouped joins, and summary read models over repeated correlated subqueries.
- Add indexes based on actual query shapes, not generic checklists.
- Avoid broad fanout joins that inflate counts.
- Treat query stability and predictable counts as product behavior, not implementation detail.

### 5. Use transactions for multi-step writes

Transactions are mandatory when one user action updates multiple related records and the system would be left inconsistent if one step failed.

Examples:

- quotation create, update, and revise
- quotation-to-sales-order handoff
- approval + timeline + side-effect packages where the change must be atomic

Do not wrap every CRUD call in a transaction. Use them where state integrity truly depends on it.

### 6. Prefer auditability before blanket soft delete

The repo does not currently enforce a global soft-delete policy. That is intentional.

- Use audit trails for important state transitions and actor attribution.
- Apply soft delete only to high-history business entities when there is a real retention need.
- Hard delete is still acceptable for low-value supporting rows such as presets, temporary dependencies, or certain QA/setup data.

The default rule is not “never hard delete.” The default rule is “do not lose important business history silently.”

### 7. Treat access control as app-layer RBAC today

Because the current runtime is SQLite, `htc-erp` does not have native PostgreSQL row-level security.

- Authorization and row filtering must be enforced in service and query layers.
- Role-based visibility must remain explicit in code.
- Any documentation or design that mentions RLS must frame it as a future PostgreSQL option, not a current guarantee.

### 8. Prefer typed columns and child tables before EAV

When the schema needs flexibility:

1. prefer typed columns
2. then prefer controlled JSON/TEXT for low-query, shape-volatile fields
3. use EAV only as a last resort

For `htc-erp`, defaulting to EAV would make querying, validation, indexing, and reporting worse. Do not introduce EAV without an explicit architecture review.

### 9. Backward compatibility is transitional, not permanent

Compatibility paths are allowed during migration, but they must have an exit.

- Keep old columns physically present during stabilization only when needed.
- Prefer startup backfill/migration over permanent runtime fallback reads.
- Track every compatibility shim with a planned removal step.

### 10. The current database target is “clear enough now, portable later”

The system should remain:

- operationally clean on SQLite now
- reasonably portable to PostgreSQL later

Do not introduce SQLite-only shortcuts that would trap the model. Also do not over-engineer for PostgreSQL before the repo actually uses it.

## What This Means In HTC ERP

### Good examples in the current direction

- `Quotation` + `QuotationLineItem` is a better shape than a single quotation blob because the line items are real workflow children.
- `ProjectProcurementLine`, `ProjectInboundLine`, and `ProjectDeliveryLine` should stay separate because they represent distinct operational states, not optional fields.
- `ProjectWorkspace` and reporting queries should use aggregates and scoped joins because these are operator-facing read models.

### Bad patterns to avoid

- adding a new table for every tiny 1:1 config object if the parent can hold the fields without harming clarity
- merging workflow tables simply to reduce table count
- adding soft delete to every table by default
- using JSON/EAV for data that must be filtered, counted, or sorted in core flows

## Immediate Reduction Policy

Apply these defaults unless a later canonical decision replaces them:

- Remove dead legacy tables and code first.
- Merge weak 1:1 config tables only after the parent write/read contract is stable.
- Keep workflow and 1:N child tables separate.
- Prefer reducing runtime fallback logic before reducing more tables.

Completed reductions under this doctrine so far:

- `Milestone` removed in favor of `ProjectMilestone`
- `SalesPerson` folded into `User`
- quotation weak 1:1 config tables folded into `Quotation`
- pricing weak 1:1 config tables folded into `PricingQuotation`

## Follow-On Decisions

The current next-step order is:

1. keep completed reductions documented and avoid reintroducing legacy fallback paths
2. improve query shape and indexes for read-heavy surfaces
3. only revisit table reduction when a new weak 1:1 or dead runtime structure appears

The companion table matrix is the concrete decision surface for those steps.
