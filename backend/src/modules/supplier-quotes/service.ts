import { supplierQuoteRepository } from './repository';

type SupplierQuoteCreator = (db: any, input: any) => Promise<any>;

type CreateSupplierQuoteServiceDeps = {
  createSupplierQuote: SupplierQuoteCreator;
};

export function createSupplierQuoteService(deps: CreateSupplierQuoteServiceDeps) {
  const { createSupplierQuote } = deps;

  return {
    listSupplierQuotes(query: Record<string, string | undefined>) {
      return supplierQuoteRepository.findAll({
        category: query.category,
        projectId: query.projectId,
        linkedQuotationId: query.linkedQuotationId,
      });
    },

    createSupplierQuote(input: Record<string, unknown>) {
      return createSupplierQuote(null, {
        supplierId: input.supplierId,
        projectId: input.projectId || null,
        linkedQuotationId: input.linkedQuotationId,
        category: input.category,
        quoteDate: input.quoteDate,
        validUntil: input.validUntil,
        items: input.items,
        attachments: input.attachments,
        changeReason: input.changeReason,
        status: input.status || 'active',
      });
    },

    updateSupplierQuote(id: string, input: Record<string, unknown>) {
      return supplierQuoteRepository.updateById(id, {
        supplierId: input.supplierId,
        projectId: typeof input.projectId === 'string' && input.projectId.trim() ? input.projectId : null,
        linkedQuotationId: typeof input.linkedQuotationId === 'string' && input.linkedQuotationId.trim() ? input.linkedQuotationId : null,
        category: input.category,
        quoteDate: input.quoteDate,
        validUntil: input.validUntil,
        items: input.items,
        attachments: input.attachments,
        changeReason: input.changeReason,
        status: input.status,
      });
    },

    deleteSupplierQuote(id: string) {
      return supplierQuoteRepository.deleteById(id);
    },
  };
}
