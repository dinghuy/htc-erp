# Canonical Domain Model

## Core Entities

- `Lead`
- `Account`
- `Contact`
- `Quotation`
- `Project`
- `Task`
- `ApprovalRequest`
- `ErpOutboxEvent`

## Work Hub Contract Surface

- `ProjectWorkspaceSummary`
- `ProjectActivityItem`
- `TaskContextRef`
- `TaskDependency`
- `ApprovalQueueItem`
- `WorklogEntry`
- `EntityThread`
- `ThreadMessage`
- `ProjectDocument`
- `DocumentReviewState`

These contracts are no longer only speculative. They are the shared contract surface for Work Hub-style execution features and should stay persistence-neutral.

## Shared Enum Families

- `SystemRole`
- `ActionPermissionKey`
- `AccountType`
- `QuotationStatus`
- `ProjectStage`
- `TaskStatus`
- `ApprovalStatus`
- `ErpEventStatus`
- `SalesOrderStatus`
- `ProcurementLineStatus`
- `InboundLineStatus`
- `DeliveryLineStatus`
- `ApprovalGateType`
- `ApprovalDecision`
- `ProjectWorkspaceTabKey`
- `ApprovalLane`
- `TaskDependencyKind`
- `ThreadStatus`
- `DocumentReviewStatus`

## Source Of Truth

- `backend/src/shared/contracts/domain.ts` owns canonical entities, enum families, role/permission contracts, pagination/filter types, and the API error DTO.
- `scripts/sync-shared-contracts.mjs` generates `frontend/src/shared/domain/generatedContracts.ts`.
- Frontend feature code must import generated contract values or re-exported bridge types instead of maintaining hand-edited duplicates.
- Role aliasing remains supported for compatibility, but canonical role evaluation is based on normalized `SystemRole[]`.

## Role And Workflow Contracts

- Canonical role evaluation is driven by:
  - `SYSTEM_ROLES`
  - `LEGACY_ROLE_ALIASES`
  - `ROLE_PRIORITY`
  - `ROLE_ACTION_PERMISSIONS`
- Canonical workspace and approval interaction is driven by:
  - `WORKSPACE_TAB_KEYS`
  - `APPROVAL_LANES`
  - `APPROVAL_GATE_TYPES`
  - `APPROVAL_DECISIONS`
- Business workflow guards should return typed failure payloads through:
  - `WorkflowGuardFailure`
  - `WorkflowTransitionResult`

## ERP Outbox Envelope

- `eventType`
- `aggregateType`
- `aggregateId`
- `payloadVersion`
- `idempotencyKey`
- `status`
- `retryCount`
- `sentAt`
- `lastError`

## Audit Fields

Every mutable business entity should converge on the shared `AuditFields` shape:

- `id`
- `createdAt`
- `updatedAt`
- `createdBy` when available
- `updatedBy` when available

## Work Hub Notes

- Work Hub contracts must stay persistence-neutral and must not assume Huly storage or broker infrastructure.
- `ProjectWorkspaceSummary` is the aggregator DTO for project stage, task summary, approval summary, milestone summary, and recent activity.
- `TaskContextRef` and `TaskDependency` are the minimum contracts needed to replace today’s fragmented task navigation with a true execution graph.
- `EntityThread`, `ThreadMessage`, `ProjectDocument`, and `DocumentReviewState` are reserved for contextual collaboration and document review, not for a general-purpose chat or wiki platform.
- Active Work Hub implementation already includes activity stream, checklist, subtasks, bulk task actions, and saved task views; new docs must describe these as active capability surfaces, not as greenfield concepts.
