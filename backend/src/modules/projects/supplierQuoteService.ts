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

  const normalizeNumericId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const projectId = normalizeNumericId(input.projectId);
  const linkedQuotationId = normalizeNumericId(input.linkedQuotationId);

  if (linkedQuotationId !== null && projectId !== null) {
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
