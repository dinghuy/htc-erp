# Product Spec

## Objective

Build a sales and operations CRM that controls the revenue flow from lead capture to ERP handoff with auditable workflow states.

## In Scope

- Lead management
- Account and contact master data
- Quotation lifecycle
- Approval workflow for pricing and commercial decisions
- Project handoff after a winning quotation
- Task orchestration across departments
- ERP outbox and delivery monitoring

## Out Of Scope For Phase 1

- Advanced analytics beyond core operational reporting
- Full support ticket expansion
- General-purpose chat features
- Non-core UX redesigns that do not improve the revenue flow

## Planned Expansion After Phase 1

- Work Hub expansion may add richer project workspace, task graph, activity stream, contextual collaboration, and project document review.
- This expansion must remain anchored to the revenue workflow and must not turn `htc-erp` into a general-purpose collaboration suite.
- Huly is the reference benchmark for these capabilities, but the target implementation remains native to the current modular monolith.

## Success Criteria

- Sales can create and advance the full revenue flow without Excel-only side channels.
- Managers can review and approve critical transitions.
- Operations receives complete project handoff data.
- ERP sync is observable, retryable, and auditable.
- AI contributors can implement bounded changes without needing to reverse-engineer the whole codebase.
