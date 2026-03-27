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

## Shared Enum Families

- `Role`
- `Permission`
- `AccountType`
- `QuotationStatus`
- `ProjectStage`
- `TaskStatus`
- `ApprovalStatus`
- `ERPEventStatus`

## Audit Fields

Every mutable business entity should converge on:

- `id`
- `createdAt`
- `updatedAt`
- `createdBy` when available
- `updatedBy` when available
