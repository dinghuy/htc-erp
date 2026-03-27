import { getDb } from '../../../sqlite-db';

type ListProjectsFilters = {
  accountId?: string;
  managerId?: string;
  status?: string;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
};

function appendDateRangeFilter(
  conditions: string[],
  params: any[],
  column: string,
  from?: string,
  to?: string,
) {
  const start = typeof from === 'string' ? from.trim() : '';
  const end = typeof to === 'string' ? to.trim() : '';

  if (start) {
    conditions.push(`${column} >= ?`);
    params.push(start);
  }
  if (end) {
    conditions.push(`${column} <= ?`);
    params.push(end);
  }
}

export function createProjectRepository() {
  async function insertProject(input: {
    id: string;
    code?: string | null;
    name: string;
    description?: string | null;
    managerId?: string | null;
    accountId?: string | null;
    projectStage: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO Project (id, code, name, description, managerId, accountId, projectStage, startDate, endDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.code || null,
        input.name,
        input.description || null,
        input.managerId || null,
        input.accountId || null,
        input.projectStage,
        input.startDate || null,
        input.endDate || null,
        input.status || null,
      ]
    );
  }

  async function updateProjectById(input: {
    id: string;
    code?: string | null;
    name: string;
    description?: string | null;
    managerId?: string | null;
    accountId?: string | null;
    projectStage: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
  }) {
    await getDb().run(
      `UPDATE Project
       SET code = ?, name = ?, description = ?, managerId = ?, accountId = ?, projectStage = ?,
           startDate = ?, endDate = ?, status = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.code || null,
        input.name,
        input.description || null,
        input.managerId || null,
        input.accountId || null,
        input.projectStage,
        input.startDate || null,
        input.endDate || null,
        input.status || null,
        input.id,
      ]
    );
  }

  async function deleteTasksByProjectId(projectId: string) {
    await getDb().run('DELETE FROM Task WHERE projectId = ?', [projectId]);
  }

  async function deleteProjectById(projectId: string) {
    await getDb().run('DELETE FROM Project WHERE id = ?', [projectId]);
  }

  async function listProjects(filters: ListProjectsFilters) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.accountId) {
      conditions.push('p.accountId = ?');
      params.push(filters.accountId);
    }
    if (filters.managerId) {
      conditions.push('p.managerId = ?');
      params.push(filters.managerId);
    }
    if (filters.status) {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }
    appendDateRangeFilter(conditions, params, 'p.startDate', filters.startDateFrom, filters.startDateTo);
    appendDateRangeFilter(conditions, params, 'p.endDate', filters.endDateFrom, filters.endDateTo);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return getDb().all(
      `
        SELECT p.*,
               u.fullName AS managerName,
               a.companyName AS accountName,
               (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id) AS taskCount,
               (SELECT COUNT(*) FROM Quotation q WHERE q.projectId = p.id) AS quotationCount,
               (SELECT COUNT(*) FROM SupplierQuote sq WHERE sq.projectId = p.id) AS supplierQuoteCount,
               (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id AND t.status != 'completed') AS openTaskCount,
               (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id AND t.dueDate IS NOT NULL AND date(t.dueDate) < date('now') AND t.status != 'completed') AS overdueTaskCount,
               (
                 SELECT q.id FROM Quotation q
                 WHERE q.projectId = p.id
                 ORDER BY COALESCE(q.quoteDate, q.createdAt) DESC, COALESCE(q.revisionNo, 0) DESC, q.createdAt DESC
                 LIMIT 1
               ) AS latestQuotationId,
               (
                 SELECT q.status FROM Quotation q
                 WHERE q.projectId = p.id
                 ORDER BY COALESCE(q.quoteDate, q.createdAt) DESC, COALESCE(q.revisionNo, 0) DESC, q.createdAt DESC
                 LIMIT 1
               ) AS latestQuotationStatus,
               (
                 SELECT q.quoteNumber FROM Quotation q
                 WHERE q.projectId = p.id
                 ORDER BY COALESCE(q.quoteDate, q.createdAt) DESC, COALESCE(q.revisionNo, 0) DESC, q.createdAt DESC
                 LIMIT 1
               ) AS latestQuotationNumber
        FROM Project p
        LEFT JOIN User u ON p.managerId = u.id
        LEFT JOIN Account a ON p.accountId = a.id
        ${whereClause}
        ORDER BY p.createdAt DESC
      `,
      params
    );
  }

  async function findProjectSummaryById(projectId: string) {
    return getDb().get(
      `
        SELECT p.*,
               u.fullName AS managerName,
               a.companyName AS accountName,
               (
                 SELECT q.id
                 FROM Quotation q
                 WHERE q.projectId = p.id
                 ORDER BY COALESCE(q.quoteDate, q.createdAt) DESC, COALESCE(q.revisionNo, 0) DESC, q.createdAt DESC
                 LIMIT 1
               ) AS latestQuotationId,
               (
                 SELECT q.status
                 FROM Quotation q
                 WHERE q.projectId = p.id
                 ORDER BY COALESCE(q.quoteDate, q.createdAt) DESC, COALESCE(q.revisionNo, 0) DESC, q.createdAt DESC
                 LIMIT 1
               ) AS latestQuotationStatus,
               (
                 SELECT q.quoteNumber
                 FROM Quotation q
                 WHERE q.projectId = p.id
                 ORDER BY COALESCE(q.quoteDate, q.createdAt) DESC, COALESCE(q.revisionNo, 0) DESC, q.createdAt DESC
                 LIMIT 1
               ) AS latestQuotationNumber,
               (SELECT COUNT(*) FROM Quotation q WHERE q.projectId = p.id) AS quotationCount,
               (SELECT COUNT(*) FROM SupplierQuote sq WHERE sq.projectId = p.id) AS supplierQuoteCount,
               (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id) AS taskCount,
               (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id AND t.status != 'completed') AS openTaskCount,
               (SELECT COUNT(*) FROM Task t WHERE t.projectId = p.id AND t.dueDate IS NOT NULL AND date(t.dueDate) < date('now') AND t.status != 'completed') AS overdueTaskCount
        FROM Project p
        LEFT JOIN User u ON p.managerId = u.id
        LEFT JOIN Account a ON p.accountId = a.id
        WHERE p.id = ?
      `,
      [projectId]
    );
  }

  async function listProjectQuotations(projectId: string) {
    return getDb().all(
      `
        SELECT q.*, a.companyName AS accountName, p.name AS projectName
        FROM Quotation q
        LEFT JOIN Account a ON q.accountId = a.id
        LEFT JOIN Project p ON q.projectId = p.id
        WHERE q.projectId = ?
        ORDER BY COALESCE(q.quoteDate, q.createdAt) DESC, COALESCE(q.revisionNo, 0) DESC, q.createdAt DESC
      `,
      [projectId]
    );
  }

  async function findQuotationByIdForProject(id: string, projectId: string) {
    return getDb().get(`SELECT * FROM Quotation WHERE id = ? AND projectId = ?`, [id, projectId]);
  }

  async function listProjectSupplierQuotes(projectId: string) {
    return getDb().all(
      `
        SELECT sq.*, a.companyName AS supplierName, q.quoteNumber AS linkedQuotationNumber
        FROM SupplierQuote sq
        LEFT JOIN Account a ON sq.supplierId = a.id
        LEFT JOIN Quotation q ON sq.linkedQuotationId = q.id
        WHERE sq.projectId = ?
        ORDER BY COALESCE(sq.quoteDate, sq.createdAt) DESC, sq.createdAt DESC
      `,
      [projectId]
    );
  }

  async function listProjectTasks(projectId: string) {
    return getDb().all(
      `
        SELECT t.*,
               u.fullName AS assigneeName,
               p.name AS projectName,
               a.companyName AS accountName,
               q.quoteNumber AS quotationNumber,
               q.status AS quotationStatus
        FROM Task t
        LEFT JOIN User u ON t.assigneeId = u.id
        LEFT JOIN Project p ON t.projectId = p.id
        LEFT JOIN Account a ON t.accountId = a.id
        LEFT JOIN Quotation q ON t.quotationId = q.id
        WHERE t.projectId = ?
        ORDER BY CASE WHEN t.dueDate IS NULL THEN 1 ELSE 0 END, t.dueDate ASC, t.createdAt DESC
      `,
      [projectId]
    );
  }

  async function listProjectActivities(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM Activity
        WHERE entityId = ?
           OR entityId IN (SELECT id FROM Quotation WHERE projectId = ?)
           OR entityId IN (SELECT id FROM Task WHERE projectId = ?)
        ORDER BY createdAt DESC
        LIMIT 50
      `,
      [projectId, projectId, projectId]
    );
  }

  async function listProjectApprovals(projectId: string) {
    return getDb().all(
      `
        SELECT ar.*, u.fullName AS approverName, rq.fullName AS requestedByName
        FROM ApprovalRequest ar
        LEFT JOIN User u ON ar.approverUserId = u.id
        LEFT JOIN User rq ON ar.requestedBy = rq.id
        WHERE ar.projectId = ?
        ORDER BY CASE ar.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, ar.createdAt DESC
      `,
      [projectId]
    );
  }

  async function listProjectDocuments(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM ProjectDocument
        WHERE projectId = ?
        ORDER BY department ASC, documentCode ASC, createdAt DESC
      `,
      [projectId]
    );
  }

  async function listProjectSalesOrders(projectId: string) {
    return getDb().all(
      `
        SELECT so.*, q.quoteNumber AS quotationNumber, q.status AS quotationStatus, a.companyName AS accountName
        FROM SalesOrder so
        LEFT JOIN Quotation q ON so.quotationId = q.id
        LEFT JOIN Account a ON so.accountId = a.id
        WHERE q.projectId = ?
        ORDER BY so.createdAt DESC, so.id DESC
      `,
      [projectId]
    );
  }

  async function listProjectQbuRounds(projectId: string) {
    return getDb().all(
      `
        SELECT pq.*,
               (
                 SELECT COUNT(*)
                 FROM PricingLineItem pli
                 WHERE pli.quotationId = pq.id
               ) AS lineItemCount
        FROM PricingQuotation pq
        WHERE pq.projectId = ?
        ORDER BY COALESCE(pq.batchNo, 0) ASC, datetime(pq.updatedAt) DESC, datetime(pq.createdAt) DESC
      `,
      [projectId]
    );
  }

  async function findMainContract(projectId: string) {
    return getDb().get(
      `
        SELECT *
        FROM ProjectContract
        WHERE projectId = ?
        ORDER BY COALESCE(effectiveDate, createdAt) DESC, createdAt DESC
        LIMIT 1
      `,
      [projectId]
    );
  }

  async function findProjectContractById(id: string) {
    return getDb().get(`SELECT * FROM ProjectContract WHERE id = ?`, [id]);
  }

  async function findProjectContractByIdForProject(id: string, projectId: string) {
    return getDb().get(`SELECT * FROM ProjectContract WHERE id = ? AND projectId = ?`, [id, projectId]);
  }

  async function insertProjectContract(input: {
    id: string;
    projectId: string;
    quotationId?: string | null;
    contractNumber?: string | null;
    title?: string | null;
    signedDate?: string | null;
    effectiveDate?: string | null;
    status: string;
    currency: string;
    totalValue: number;
    summary?: string | null;
    lineItems: string;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectContract (
        id, projectId, quotationId, contractNumber, title, signedDate, effectiveDate, status, currency, totalValue, summary, lineItems, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.quotationId || null,
        input.contractNumber || null,
        input.title || null,
        input.signedDate || null,
        input.effectiveDate || null,
        input.status,
        input.currency,
        input.totalValue,
        input.summary || null,
        input.lineItems,
        input.createdBy || null,
      ]
    );
  }

  async function updateProjectContractById(input: {
    id: string;
    quotationId?: string | null;
    contractNumber?: string | null;
    title?: string | null;
    signedDate?: string | null;
    effectiveDate?: string | null;
    status: string;
    currency: string;
    totalValue: number;
    summary?: string | null;
    lineItems: string;
  }) {
    await getDb().run(
      `UPDATE ProjectContract
       SET quotationId = ?, contractNumber = ?, title = ?, signedDate = ?, effectiveDate = ?, status = ?, currency = ?,
           totalValue = ?, summary = ?, lineItems = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.quotationId || null,
        input.contractNumber || null,
        input.title || null,
        input.signedDate || null,
        input.effectiveDate || null,
        input.status,
        input.currency,
        input.totalValue,
        input.summary || null,
        input.lineItems,
        input.id,
      ]
    );
  }

  async function updateProjectStageById(projectId: string, projectStage: string) {
    await getDb().run(
      `UPDATE Project SET projectStage = ?, updatedAt = datetime('now') WHERE id = ?`,
      [projectStage, projectId]
    );
  }

  async function listContractAppendices(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM ProjectContractAppendix
        WHERE projectId = ?
        ORDER BY COALESCE(effectiveDate, createdAt) DESC, createdAt DESC
      `,
      [projectId]
    );
  }

  async function findProjectContractAppendixById(id: string) {
    return getDb().get(`SELECT * FROM ProjectContractAppendix WHERE id = ?`, [id]);
  }

  async function insertProjectContractAppendix(input: {
    id: string;
    projectId: string;
    contractId: string;
    appendixNumber?: string | null;
    title?: string | null;
    signedDate?: string | null;
    effectiveDate?: string | null;
    status: string;
    totalDeltaValue: number;
    summary?: string | null;
    lineItems: string;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectContractAppendix (
        id, projectId, contractId, appendixNumber, title, signedDate, effectiveDate, status, totalDeltaValue, summary, lineItems, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.contractId,
        input.appendixNumber || null,
        input.title || null,
        input.signedDate || null,
        input.effectiveDate || null,
        input.status,
        input.totalDeltaValue,
        input.summary || null,
        input.lineItems,
        input.createdBy || null,
      ]
    );
  }

  async function updateProjectContractAppendixById(input: {
    id: string;
    appendixNumber?: string | null;
    title?: string | null;
    signedDate?: string | null;
    effectiveDate?: string | null;
    status: string;
    totalDeltaValue: number;
    summary?: string | null;
    lineItems: string;
  }) {
    await getDb().run(
      `UPDATE ProjectContractAppendix
       SET appendixNumber = ?, title = ?, signedDate = ?, effectiveDate = ?, status = ?, totalDeltaValue = ?, summary = ?, lineItems = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.appendixNumber || null,
        input.title || null,
        input.signedDate || null,
        input.effectiveDate || null,
        input.status,
        input.totalDeltaValue,
        input.summary || null,
        input.lineItems,
        input.id,
      ]
    );
  }

  async function listExecutionBaselines(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM ProjectExecutionBaseline
        WHERE projectId = ?
        ORDER BY baselineNo ASC, createdAt ASC
      `,
      [projectId]
    );
  }

  async function listProcurementLines(projectId: string) {
    return getDb().all(
      `
        SELECT ppl.*, a.companyName AS supplierName
        FROM ProjectProcurementLine ppl
        LEFT JOIN Account a ON ppl.supplierId = a.id
        WHERE ppl.projectId = ?
        ORDER BY ppl.isActive DESC, ppl.createdAt ASC, ppl.id ASC
      `,
      [projectId]
    );
  }

  async function findProcurementLineById(id: string) {
    return getDb().get(`SELECT * FROM ProjectProcurementLine WHERE id = ?`, [id]);
  }

  async function findProcurementLineByIdForProject(id: string, projectId: string) {
    return getDb().get(
      `SELECT * FROM ProjectProcurementLine WHERE id = ? AND projectId = ?`,
      [id, projectId]
    );
  }

  async function updateProcurementLineById(input: {
    id: string;
    supplierId?: string | null;
    poNumber?: string | null;
    orderedQty: number;
    etaDate?: string | null;
    committedDeliveryDate?: string | null;
    status: string;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectProcurementLine
       SET supplierId = ?, poNumber = ?, orderedQty = ?, etaDate = ?, committedDeliveryDate = ?, status = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.supplierId || null,
        input.poNumber || null,
        input.orderedQty,
        input.etaDate || null,
        input.committedDeliveryDate || null,
        input.status,
        input.note || null,
        input.id,
      ]
    );
  }

  async function findInboundTotalsByProcurementLineId(procurementLineId: string) {
    return getDb().get(
      `SELECT
         COALESCE(SUM(receivedQty), 0) AS totalQty,
         MAX(actualReceivedDate) AS actualReceivedDate
       FROM ProjectInboundLine
       WHERE procurementLineId = ?`,
      [procurementLineId]
    );
  }

  async function findDeliveryTotalsByProcurementLineId(procurementLineId: string) {
    return getDb().get(
      `SELECT
         COALESCE(SUM(deliveredQty), 0) AS totalQty,
         MAX(actualDeliveryDate) AS actualDeliveryDate
       FROM ProjectDeliveryLine
       WHERE procurementLineId = ?`,
      [procurementLineId]
    );
  }

  async function updateProcurementLineRollup(input: {
    procurementLineId: string;
    receivedQty: number;
    deliveredQty: number;
    shortageQty: number;
    shortageStatus: string;
    status: string;
    actualReceivedDate?: string | null;
    actualDeliveryDate?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectProcurementLine
       SET receivedQty = ?, deliveredQty = ?, shortageQty = ?, shortageStatus = ?, status = ?,
           actualReceivedDate = ?, actualDeliveryDate = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.receivedQty,
        input.deliveredQty,
        input.shortageQty,
        input.shortageStatus,
        input.status,
        input.actualReceivedDate || null,
        input.actualDeliveryDate || null,
        input.procurementLineId,
      ]
    );
  }

  async function updateProcurementLineFromBaseline(input: {
    id: string;
    baselineId: string;
    itemCode?: string | null;
    itemName?: string | null;
    description?: string | null;
    unit?: string | null;
    contractQty: number;
    etaDate?: string | null;
    committedDeliveryDate?: string | null;
    shortageQty: number;
  }) {
    await getDb().run(
      `UPDATE ProjectProcurementLine
       SET baselineId = ?, isActive = 1, supersededAt = NULL, supersededByBaselineId = NULL,
           itemCode = ?, itemName = ?, description = ?, unit = ?, contractQty = ?,
           etaDate = ?, committedDeliveryDate = ?, shortageQty = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.baselineId,
        input.itemCode || null,
        input.itemName || null,
        input.description || null,
        input.unit || null,
        input.contractQty,
        input.etaDate || null,
        input.committedDeliveryDate || null,
        input.shortageQty,
        input.id,
      ]
    );
  }

  async function insertProcurementLine(input: {
    id: string;
    projectId: string;
    baselineId: string;
    sourceLineKey: string;
    itemCode?: string | null;
    itemName?: string | null;
    description?: string | null;
    unit?: string | null;
    contractQty: number;
    shortageQty: number;
    etaDate?: string | null;
    committedDeliveryDate?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectProcurementLine (
        id, projectId, baselineId, sourceLineKey, isActive, itemCode, itemName, description, unit,
        contractQty, orderedQty, receivedQty, deliveredQty, shortageQty, shortageStatus,
        etaDate, committedDeliveryDate, status, note
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'pending', ?, ?, 'planned', NULL)`,
      [
        input.id,
        input.projectId,
        input.baselineId,
        input.sourceLineKey,
        input.itemCode || null,
        input.itemName || null,
        input.description || null,
        input.unit || null,
        input.contractQty,
        input.shortageQty,
        input.etaDate || null,
        input.committedDeliveryDate || null,
      ]
    );
  }

  async function retireProcurementLine(input: {
    id: string;
    supersededAt: string;
    supersededByBaselineId: string;
  }) {
    await getDb().run(
      `UPDATE ProjectProcurementLine
       SET isActive = 0, status = 'superseded', supersededAt = ?, supersededByBaselineId = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [input.supersededAt, input.supersededByBaselineId, input.id]
    );
  }

  async function listInboundLines(projectId: string) {
    return getDb().all(
      `
        SELECT pil.*, ppl.itemCode, ppl.itemName, ppl.description AS procurementDescription,
               ppl.isActive AS procurementIsActive, ppl.supersededAt AS procurementSupersededAt
        FROM ProjectInboundLine pil
        LEFT JOIN ProjectProcurementLine ppl ON pil.procurementLineId = ppl.id
        WHERE pil.projectId = ?
        ORDER BY COALESCE(pil.actualReceivedDate, pil.createdAt) DESC, pil.createdAt DESC
      `,
      [projectId]
    );
  }

  async function findInboundLineById(id: string) {
    return getDb().get(`SELECT * FROM ProjectInboundLine WHERE id = ?`, [id]);
  }

  async function insertInboundLine(input: {
    id: string;
    projectId: string;
    procurementLineId: string;
    baselineId?: string | null;
    sourceLineKey?: string | null;
    receivedQty: number;
    etaDate?: string | null;
    actualReceivedDate?: string | null;
    status: string;
    receiptRef?: string | null;
    note?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectInboundLine (
        id, projectId, procurementLineId, baselineId, sourceLineKey, receivedQty, etaDate, actualReceivedDate, status, receiptRef, note, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.procurementLineId,
        input.baselineId || null,
        input.sourceLineKey || null,
        input.receivedQty,
        input.etaDate || null,
        input.actualReceivedDate || null,
        input.status,
        input.receiptRef || null,
        input.note || null,
        input.createdBy || null,
      ]
    );
  }

  async function updateInboundLineById(input: {
    id: string;
    procurementLineId: string;
    baselineId?: string | null;
    sourceLineKey?: string | null;
    receivedQty: number;
    etaDate?: string | null;
    actualReceivedDate?: string | null;
    status: string;
    receiptRef?: string | null;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectInboundLine
       SET procurementLineId = ?, baselineId = ?, sourceLineKey = ?, receivedQty = ?, etaDate = ?, actualReceivedDate = ?,
           status = ?, receiptRef = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.procurementLineId,
        input.baselineId || null,
        input.sourceLineKey || null,
        input.receivedQty,
        input.etaDate || null,
        input.actualReceivedDate || null,
        input.status,
        input.receiptRef || null,
        input.note || null,
        input.id,
      ]
    );
  }

  async function listDeliveryLines(projectId: string) {
    return getDb().all(
      `
        SELECT pdl.*, ppl.itemCode, ppl.itemName, ppl.description AS procurementDescription,
               ppl.isActive AS procurementIsActive, ppl.supersededAt AS procurementSupersededAt
        FROM ProjectDeliveryLine pdl
        LEFT JOIN ProjectProcurementLine ppl ON pdl.procurementLineId = ppl.id
        WHERE pdl.projectId = ?
        ORDER BY COALESCE(pdl.actualDeliveryDate, pdl.createdAt) DESC, pdl.createdAt DESC
      `,
      [projectId]
    );
  }

  async function findDeliveryLineById(id: string) {
    return getDb().get(`SELECT * FROM ProjectDeliveryLine WHERE id = ?`, [id]);
  }

  async function insertDeliveryLine(input: {
    id: string;
    projectId: string;
    procurementLineId: string;
    baselineId?: string | null;
    sourceLineKey?: string | null;
    deliveredQty: number;
    committedDate?: string | null;
    actualDeliveryDate?: string | null;
    status: string;
    deliveryRef?: string | null;
    note?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectDeliveryLine (
        id, projectId, procurementLineId, baselineId, sourceLineKey, deliveredQty, committedDate, actualDeliveryDate, status, deliveryRef, note, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.procurementLineId,
        input.baselineId || null,
        input.sourceLineKey || null,
        input.deliveredQty,
        input.committedDate || null,
        input.actualDeliveryDate || null,
        input.status,
        input.deliveryRef || null,
        input.note || null,
        input.createdBy || null,
      ]
    );
  }

  async function updateDeliveryLineById(input: {
    id: string;
    procurementLineId: string;
    baselineId?: string | null;
    sourceLineKey?: string | null;
    deliveredQty: number;
    committedDate?: string | null;
    actualDeliveryDate?: string | null;
    status: string;
    deliveryRef?: string | null;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectDeliveryLine
       SET procurementLineId = ?, baselineId = ?, sourceLineKey = ?, deliveredQty = ?, committedDate = ?, actualDeliveryDate = ?,
           status = ?, deliveryRef = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.procurementLineId,
        input.baselineId || null,
        input.sourceLineKey || null,
        input.deliveredQty,
        input.committedDate || null,
        input.actualDeliveryDate || null,
        input.status,
        input.deliveryRef || null,
        input.note || null,
        input.id,
      ]
    );
  }

  async function listMilestones(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM ProjectMilestone
        WHERE projectId = ?
        ORDER BY COALESCE(actualDate, plannedDate, createdAt) ASC, createdAt ASC
      `,
      [projectId]
    );
  }

  async function findMilestoneById(id: string) {
    return getDb().get(`SELECT * FROM ProjectMilestone WHERE id = ?`, [id]);
  }

  async function insertMilestone(input: {
    id: string;
    projectId: string;
    milestoneType?: string | null;
    title: string;
    plannedDate?: string | null;
    actualDate?: string | null;
    status: string;
    note?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectMilestone (
        id, projectId, milestoneType, title, plannedDate, actualDate, status, note, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.projectId,
        input.milestoneType || null,
        input.title,
        input.plannedDate || null,
        input.actualDate || null,
        input.status,
        input.note || null,
        input.createdBy || null,
      ]
    );
  }

  async function updateMilestoneById(input: {
    id: string;
    milestoneType?: string | null;
    title: string;
    plannedDate?: string | null;
    actualDate?: string | null;
    status: string;
    note?: string | null;
  }) {
    await getDb().run(
      `UPDATE ProjectMilestone
       SET milestoneType = ?, title = ?, plannedDate = ?, actualDate = ?, status = ?, note = ?, updatedAt = datetime('now')
       WHERE id = ?`,
      [
        input.milestoneType || null,
        input.title,
        input.plannedDate || null,
        input.actualDate || null,
        input.status,
        input.note || null,
        input.id,
      ]
    );
  }

  async function listTimelineEvents(projectId: string) {
    return getDb().all(
      `
        SELECT *
        FROM ProjectTimelineEvent
        WHERE projectId = ?
        ORDER BY COALESCE(eventDate, createdAt) DESC, createdAt DESC
      `,
      [projectId]
    );
  }

  async function insertTimelineEvent(event: {
    id: string;
    projectId: string;
    eventType: string;
    title: string;
    description?: string | null;
    eventDate?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    payload?: string | null;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectTimelineEvent (
        id, projectId, eventType, title, description, eventDate, entityType, entityId, payload, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.projectId,
        event.eventType,
        event.title,
        event.description || null,
        event.eventDate || null,
        event.entityType || null,
        event.entityId || null,
        event.payload || null,
        event.createdBy || null,
      ]
    );
  }

  async function findTimelineEventById(id: string) {
    return getDb().get(`SELECT * FROM ProjectTimelineEvent WHERE id = ?`, [id]);
  }

  async function findExecutionBaselineById(id: string) {
    return getDb().get(`SELECT * FROM ProjectExecutionBaseline WHERE id = ?`, [id]);
  }

  async function findMaxBaselineNo(projectId: string) {
    return getDb().get(
      `SELECT COALESCE(MAX(baselineNo), 0) AS maxBaselineNo
       FROM ProjectExecutionBaseline
       WHERE projectId = ?`,
      [projectId]
    );
  }

  async function clearCurrentExecutionBaseline(projectId: string) {
    await getDb().run(
      `UPDATE ProjectExecutionBaseline SET isCurrent = 0, updatedAt = datetime('now') WHERE projectId = ?`,
      [projectId]
    );
  }

  async function insertExecutionBaseline(input: {
    id: string;
    projectId: string;
    sourceType: 'main_contract' | 'appendix';
    sourceId: string;
    baselineNo: number;
    title: string;
    effectiveDate?: string | null;
    currency?: string | null;
    totalValue: number;
    lineItems: string;
    createdBy?: string | null;
  }) {
    await getDb().run(
      `INSERT INTO ProjectExecutionBaseline (
        id, projectId, sourceType, sourceId, baselineNo, title, effectiveDate, currency, totalValue, lineItems, isCurrent, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        input.id,
        input.projectId,
        input.sourceType,
        input.sourceId,
        input.baselineNo,
        input.title,
        input.effectiveDate || null,
        input.currency || 'VND',
        input.totalValue,
        input.lineItems,
        input.createdBy || null,
      ]
    );
  }

  return {
    insertProject,
    updateProjectById,
    deleteTasksByProjectId,
    deleteProjectById,
    listProjects,
    findProjectSummaryById,
    listProjectQuotations,
    findQuotationByIdForProject,
    listProjectSupplierQuotes,
    listProjectTasks,
    listProjectActivities,
    listProjectApprovals,
    listProjectDocuments,
    listProjectSalesOrders,
    listProjectQbuRounds,
    findMainContract,
    findProjectContractById,
    findProjectContractByIdForProject,
    insertProjectContract,
    updateProjectContractById,
    updateProjectStageById,
    listContractAppendices,
    findProjectContractAppendixById,
    insertProjectContractAppendix,
    updateProjectContractAppendixById,
    listExecutionBaselines,
    listProcurementLines,
    findProcurementLineById,
    findProcurementLineByIdForProject,
    updateProcurementLineById,
    findInboundTotalsByProcurementLineId,
    findDeliveryTotalsByProcurementLineId,
    updateProcurementLineRollup,
    updateProcurementLineFromBaseline,
    insertProcurementLine,
    retireProcurementLine,
    listInboundLines,
    findInboundLineById,
    insertInboundLine,
    updateInboundLineById,
    listDeliveryLines,
    findDeliveryLineById,
    insertDeliveryLine,
    updateDeliveryLineById,
    listMilestones,
    findMilestoneById,
    insertMilestone,
    updateMilestoneById,
    listTimelineEvents,
    insertTimelineEvent,
    findTimelineEventById,
    findExecutionBaselineById,
    findMaxBaselineNo,
    clearCurrentExecutionBaseline,
    insertExecutionBaseline,
  };
}
