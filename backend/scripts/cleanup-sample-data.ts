import { initDb, getDb } from '../sqlite-db';

const BATCH_TAG = 'SAMPLE_2026_03_25';
const ID_PREFIX = 'sample-20260325';
const MARKER = `[${BATCH_TAG}]`;

async function runDelete(db: any, table: string, whereSql: string, params: any[] = []) {
  const exists = await db.get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
  if (!exists?.name) return 0;
  const result = await db.run(`DELETE FROM ${table} WHERE ${whereSql}`, params);
  return Number(result?.changes || 0);
}

async function main() {
  await initDb();
  const db = getDb();

  const deleted: Record<string, number> = {};
  await db.exec('BEGIN');
  try {
    deleted.PricingCostEntry = await runDelete(db, 'PricingCostEntry', `id LIKE ? OR note LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.PricingMaintenancePart = await runDelete(db, 'PricingMaintenancePart', `id LIKE ? OR note LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.PricingOperationConfig = await runDelete(db, 'PricingOperationConfig', `id LIKE ?`, [`${ID_PREFIX}-%`]);
    deleted.PricingRentalConfig = await runDelete(db, 'PricingRentalConfig', `id LIKE ?`, [`${ID_PREFIX}-%`]);
    deleted.PricingLineItem = await runDelete(db, 'PricingLineItem', `id LIKE ? OR description LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.PricingQuotation = await runDelete(db, 'PricingQuotation', `id LIKE ? OR changeReason LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);

    deleted.ProjectInboundLine = await runDelete(db, 'ProjectInboundLine', `id LIKE ? OR note LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.ProjectDeliveryLine = await runDelete(db, 'ProjectDeliveryLine', `id LIKE ? OR note LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.ProjectProcurementLine = await runDelete(db, 'ProjectProcurementLine', `id LIKE ? OR note LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.ProjectMilestone = await runDelete(db, 'ProjectMilestone', `id LIKE ? OR title LIKE ? OR note LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`, `%${MARKER}%`]);
    deleted.ProjectTimelineEvent = await runDelete(db, 'ProjectTimelineEvent', `id LIKE ? OR title LIKE ? OR description LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`, `%${MARKER}%`]);
    deleted.ProjectExecutionBaseline = await runDelete(db, 'ProjectExecutionBaseline', `id LIKE ? OR title LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.ProjectContractAppendix = await runDelete(db, 'ProjectContractAppendix', `id LIKE ? OR title LIKE ? OR summary LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`, `%${MARKER}%`]);
    deleted.ProjectContract = await runDelete(db, 'ProjectContract', `id LIKE ? OR title LIKE ? OR summary LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`, `%${MARKER}%`]);
    deleted.ProjectDocument = await runDelete(db, 'ProjectDocument', `id LIKE ? OR note LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.ApprovalRequest = await runDelete(db, 'ApprovalRequest', `id LIKE ? OR title LIKE ? OR note LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`, `%${MARKER}%`]);

    deleted.Task = await runDelete(db, 'Task', `id LIKE ? OR notes LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.SalesOrder = await runDelete(db, 'SalesOrder', `id LIKE ? OR orderNumber LIKE 'SMP-%' OR notes LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.SupplierQuote = await runDelete(db, 'SupplierQuote', `id LIKE ? OR changeReason LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.Quotation = await runDelete(db, 'Quotation', `id LIKE ? OR quoteNumber LIKE 'SMP-%' OR subject LIKE ? OR changeReason LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`, `%${MARKER}%`]);
    deleted.Project = await runDelete(db, 'Project', `id LIKE ? OR code LIKE 'SMP-%' OR description LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);

    deleted.Contact = await runDelete(db, 'Contact', `id LIKE ? OR email LIKE '%@sample-%'`, [`${ID_PREFIX}-%`]);
    deleted.Account = await runDelete(db, 'Account', `id LIKE ? OR code LIKE 'SMP-%' OR description LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.Lead = await runDelete(db, 'Lead', `id LIKE ? OR companyName LIKE 'Sample %'`, [`${ID_PREFIX}-%`]);
    deleted.Product = await runDelete(db, 'Product', `id LIKE ? OR sku LIKE 'SMP-%'`, [`${ID_PREFIX}-%`]);
    deleted.ExchangeRate = await runDelete(db, 'ExchangeRate', `id LIKE ? OR source LIKE ?`, [`${ID_PREFIX}-%`, `%${BATCH_TAG}%`]);
    deleted.SalesPerson = await runDelete(db, 'SalesPerson', `id LIKE ? OR email LIKE '%@htg.local'`, [`${ID_PREFIX}-%`]);

    deleted.ChatMessage = await runDelete(db, 'ChatMessage', `id LIKE ? OR content LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.Notification = await runDelete(db, 'Notification', `id LIKE ? OR content LIKE ?`, [`${ID_PREFIX}-%`, `%${MARKER}%`]);
    deleted.ErpOutbox = await runDelete(db, 'ErpOutbox', `id LIKE ? OR dedupeKey LIKE ? OR payload LIKE ?`, [`${ID_PREFIX}-%`, `${BATCH_TAG}:%`, `%${BATCH_TAG}%`]);
    deleted.Activity = await runDelete(db, 'Activity', `id LIKE ? OR title LIKE ? OR description LIKE ? OR entityId LIKE ?`, [`${ID_PREFIX}-%`, `%${BATCH_TAG}%`, `%${MARKER}%`, `${ID_PREFIX}-%`]);
    deleted.User = await runDelete(db, 'User', `id LIKE ? OR username LIKE 'sample.%' OR employeeCode LIKE 'SMP-%'`, [`${ID_PREFIX}-%`]);
    deleted.SystemSetting = await runDelete(db, 'SystemSetting', `key = ? OR key LIKE ?`, [`sample.batch.${BATCH_TAG}`, `sample.batch.${BATCH_TAG}%`]);

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }

  console.log('Full sample data cleanup completed');
  console.log(JSON.stringify({ batchTag: BATCH_TAG, idPrefix: ID_PREFIX, deleted }, null, 2));
}

main().catch((error) => {
  console.error('[cleanup-sample-data] Error:', error?.message || error);
  process.exit(1);
});
