# Sample Data Batch Note

- Batch tag: `SAMPLE_2026_03_25`
- ID prefix: `sample-20260325`
- Purpose: full-database test data in current CRM database (`backend/crm.db`)

## Seed command

```powershell
npx ts-node scripts/seed-sample-data.ts
```

## Cleanup command

```powershell
npx ts-node scripts/cleanup-sample-data.ts
```

## What gets removed by cleanup

- Core CRM tables: `User`, `Account`, `Contact`, `Lead`, `Product`, `ExchangeRate`, `Project`, `Task`, `Quotation`, `SupplierQuote`, `SalesOrder`, `SalesPerson`
- Project execution tables: `ProjectDocument`, `ProjectContract`, `ProjectContractAppendix`, `ProjectExecutionBaseline`, `ProjectProcurementLine`, `ProjectInboundLine`, `ProjectDeliveryLine`, `ProjectMilestone`, `ProjectTimelineEvent`, `ApprovalRequest`
- Pricing tables: `PricingQuotation`, `PricingLineItem`, `PricingRentalConfig`, `PricingOperationConfig`, `PricingMaintenancePart`, `PricingCostEntry`
- Messaging/system tables: `ChatMessage`, `Notification`, `ErpOutbox`, `Activity`, `SystemSetting`
- Matching rule: remove rows by `id` prefix `sample-20260325-` and/or marker `[SAMPLE_2026_03_25]` (or equivalent `SMP-*` code keys where applicable)
