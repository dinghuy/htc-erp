import { getDb } from '../../../sqlite-db';

export type SupplierQuoteFilters = {
  category?: string;
  projectId?: number | string;
  linkedQuotationId?: number | string;
};

export type SupplierQuoteWriteInput = {
  supplierId: number | string;
  projectId: number | string | null;
  linkedQuotationId: number | string | null;
  category: unknown;
  quoteDate: unknown;
  validUntil: unknown;
  items: unknown;
  attachments: unknown;
  changeReason: unknown;
  status: unknown;
};

export function createSupplierQuoteRepository() {
  return {
    findAll(filters: SupplierQuoteFilters) {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (filters.category) {
        conditions.push('sq.category = ?');
        params.push(filters.category);
      }
      if (filters.projectId) {
        conditions.push('sq.projectId = ?');
        params.push(filters.projectId);
      }
      if (filters.linkedQuotationId) {
        conditions.push('sq.linkedQuotationId = ?');
        params.push(filters.linkedQuotationId);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      return getDb().all(
        `SELECT sq.*, a.companyName as supplierName, p.name AS projectName, q.quoteNumber AS linkedQuotationNumber
         FROM SupplierQuote sq
         LEFT JOIN Account a ON sq.supplierId = a.id
         LEFT JOIN Project p ON sq.projectId = p.id
         LEFT JOIN Quotation q ON sq.linkedQuotationId = q.id
         ${whereClause}
         ORDER BY sq.quoteDate DESC, sq.createdAt DESC`,
        params,
      );
    },

    findById(id: number | string) {
      return getDb().get('SELECT * FROM SupplierQuote WHERE id = ?', [id]);
    },

    async updateById(id: number | string, input: SupplierQuoteWriteInput) {
      await getDb().run(
        `UPDATE SupplierQuote SET supplierId=?, projectId=?, linkedQuotationId=?, category=?, quoteDate=?, validUntil=?, items=?, attachments=?, changeReason=?, status=? WHERE id=?`,
        [
          input.supplierId,
          input.projectId,
          input.linkedQuotationId,
          input.category,
          input.quoteDate,
          input.validUntil,
          JSON.stringify(input.items || []),
          JSON.stringify(input.attachments || []),
          input.changeReason || null,
          input.status,
          id,
        ],
      );

      return this.findById(id);
    },

    deleteById(id: number | string) {
      return getDb().run('DELETE FROM SupplierQuote WHERE id = ?', [id]);
    },
  };
}

export const supplierQuoteRepository = createSupplierQuoteRepository();
