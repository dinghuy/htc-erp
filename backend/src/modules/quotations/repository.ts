import { getDb } from '../../../sqlite-db';

export type QuotationRecord = {
  id: string;
  quoteNumber: string;
  quoteDate: string;
  subject: string | null;
  accountId: string | null;
  contactId: string | null;
  projectId: string | null;
  salesperson: string | null;
  salespersonPhone: string | null;
  currency: string;
  opportunityId: string | null;
  revisionNo: number;
  revisionLabel: string;
  parentQuotationId: string | null;
  changeReason: string | null;
  isWinningVersion: number;
  items: string;
  financialParams: string;
  terms: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  status: string;
  validUntil: string | null;
};

export function createQuotationRepository() {
  async function listDetailed() {
    return getDb().all(
      `SELECT q.*, a.companyName as accountName, p.name AS projectName, p.projectStage
       FROM Quotation q
       LEFT JOIN Account a ON q.accountId = a.id
       LEFT JOIN Project p ON q.projectId = p.id
       ORDER BY q.createdAt DESC`
    );
  }

  async function findDetailedById(id: string) {
    return getDb().get(
      `SELECT q.*, a.companyName as accountName, p.name AS projectName, p.projectStage
       FROM Quotation q
       LEFT JOIN Account a ON q.accountId = a.id
       LEFT JOIN Project p ON q.projectId = p.id
       WHERE q.id = ?`,
      [id]
    );
  }

  async function findById(id: string) {
    return getDb().get('SELECT * FROM Quotation WHERE id = ?', [id]);
  }

  async function insert(record: QuotationRecord) {
    await getDb().run(
      `INSERT INTO Quotation (id, quoteNumber, quoteDate, subject, accountId, contactId, projectId, salesperson, salespersonPhone, currency, opportunityId, revisionNo, revisionLabel, parentQuotationId, changeReason, isWinningVersion, items, financialParams, terms, subtotal, taxTotal, grandTotal, status, validUntil)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.quoteNumber,
        record.quoteDate,
        record.subject,
        record.accountId,
        record.contactId,
        record.projectId,
        record.salesperson,
        record.salespersonPhone,
        record.currency,
        record.opportunityId,
        record.revisionNo,
        record.revisionLabel,
        record.parentQuotationId,
        record.changeReason,
        record.isWinningVersion,
        record.items,
        record.financialParams,
        record.terms,
        record.subtotal,
        record.taxTotal,
        record.grandTotal,
        record.status,
        record.validUntil,
      ]
    );
  }

  async function updateById(id: string, record: Omit<QuotationRecord, 'id' | 'quoteNumber' | 'opportunityId'>) {
    await getDb().run(
      `UPDATE Quotation SET quoteDate=?, subject=?, accountId=?, contactId=?, projectId=?, salesperson=?, salespersonPhone=?, currency=?, revisionNo=?, revisionLabel=?, parentQuotationId=?, changeReason=?, isWinningVersion=?, items=?, financialParams=?, terms=?, subtotal=?, taxTotal=?, grandTotal=?, status=?, validUntil=? WHERE id=?`,
      [
        record.quoteDate,
        record.subject,
        record.accountId,
        record.contactId,
        record.projectId,
        record.salesperson,
        record.salespersonPhone,
        record.currency,
        record.revisionNo,
        record.revisionLabel,
        record.parentQuotationId,
        record.changeReason,
        record.isWinningVersion,
        record.items,
        record.financialParams,
        record.terms,
        record.subtotal,
        record.taxTotal,
        record.grandTotal,
        record.status,
        record.validUntil,
        id,
      ]
    );
  }

  async function deleteById(id: string) {
    await getDb().run('DELETE FROM Quotation WHERE id = ?', [id]);
  }

  async function findPdfPayloadById(id: string) {
    return getDb().get(
      `SELECT q.*, a.companyName, a.address, a.taxCode FROM Quotation q
       LEFT JOIN Account a ON q.accountId = a.id
       WHERE q.id = ?`,
      [id]
    );
  }

  return {
    listDetailed,
    findDetailedById,
    findById,
    insert,
    updateById,
    deleteById,
    findPdfPayloadById,
  };
}
