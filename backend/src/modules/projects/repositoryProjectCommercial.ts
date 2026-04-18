import { getDb } from '../../../sqlite-db';

export function createProjectCommercialRepository() {
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

  async function findQuotationById(id: string) {
    return getDb().get(`SELECT * FROM Quotation WHERE id = ?`, [id]);
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
    return getDb().run(
      `INSERT INTO ProjectContract (
        projectId, quotationId, contractNumber, title, signedDate, effectiveDate, status, currency, totalValue, summary, lineItems, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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

  async function updateQuotationStatusById(quotationId: string, status: string) {
    await getDb().run(
      `UPDATE Quotation SET status = ?, updatedAt = datetime('now') WHERE id = ?`,
      [status, quotationId]
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
    return getDb().run(
      `INSERT INTO ProjectContractAppendix (
        projectId, contractId, appendixNumber, title, signedDate, effectiveDate, status, totalDeltaValue, summary, lineItems, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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

  return {
    listProjectQuotations,
    findQuotationById,
    findQuotationByIdForProject,
    listProjectSupplierQuotes,
    listProjectSalesOrders,
    listProjectQbuRounds,
    findMainContract,
    findProjectContractById,
    findProjectContractByIdForProject,
    insertProjectContract,
    updateProjectContractById,
    updateProjectStageById,
    updateQuotationStatusById,
    listContractAppendices,
    findProjectContractAppendixById,
    insertProjectContractAppendix,
    updateProjectContractAppendixById,
  };
}
