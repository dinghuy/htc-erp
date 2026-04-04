import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../../sqlite-db';

export type SupplierQuoteCreateInput = {
  supplierId: unknown;
  projectId?: string | null;
  linkedQuotationId?: unknown;
  category: unknown;
  quoteDate: unknown;
  validUntil: unknown;
  items: unknown;
  attachments: unknown;
  changeReason: unknown;
  status?: unknown;
};

export async function createSupplierQuote(db: any, input: SupplierQuoteCreateInput) {
  const database = db || getDb();
  const id = uuidv4();
  const projectId = typeof input.projectId === 'string' && input.projectId.trim() ? input.projectId.trim() : null;
  const linkedQuotationId = typeof input.linkedQuotationId === 'string' && input.linkedQuotationId.trim()
    ? input.linkedQuotationId.trim()
    : null;

  if (linkedQuotationId && projectId) {
    const linkedQuotation = await database.get(
      'SELECT id FROM Quotation WHERE id = ? AND projectId = ?',
      [linkedQuotationId, projectId]
    );
    if (!linkedQuotation) {
      const err: any = new Error('linkedQuotationId does not belong to this project');
      err.status = 400;
      throw err;
    }
  }

  await database.run(
    `INSERT INTO SupplierQuote (id, supplierId, projectId, linkedQuotationId, category, quoteDate, validUntil, items, attachments, changeReason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.supplierId,
      projectId,
      linkedQuotationId,
      input.category,
      input.quoteDate,
      input.validUntil,
      JSON.stringify(input.items || []),
      JSON.stringify(input.attachments || []),
      input.changeReason || null,
      input.status || 'active',
    ]
  );

  return database.get('SELECT * FROM SupplierQuote WHERE id = ?', [id]);
}
