import { normalizeText } from './common';

type MapReviseQuotationInputParams = {
  source: any;
  body: any;
  id: string;
  revisionNo: number;
  buildRevisionLabel: (revisionNo: number) => string;
};

export function mapReviseQuotationInput(params: MapReviseQuotationInputParams) {
  const { source, body, id, revisionNo, buildRevisionLabel } = params;
  const nextQuoteNumber = normalizeText(body?.quoteNumber) || `${source.quoteNumber || source.id}-${buildRevisionLabel(revisionNo)}`;

  return {
    id,
    quoteNumber: nextQuoteNumber,
    quoteDate: normalizeText(body?.quoteDate) || source.quoteDate || new Date().toISOString().slice(0, 10),
    subject: normalizeText(body?.subject) || source.subject || null,
    accountId: normalizeText(body?.accountId) || source.accountId || null,
    contactId: normalizeText(body?.contactId) || source.contactId || null,
    projectId: source.projectId || null,
    salesperson: normalizeText(body?.salesperson) || source.salesperson || null,
    salespersonPhone: normalizeText(body?.salespersonPhone) || source.salespersonPhone || null,
    currency: normalizeText(body?.currency) || source.currency || 'VND',
    opportunityId: source.opportunityId || null,
    revisionNo,
    revisionLabel: normalizeText(body?.revisionLabel) || buildRevisionLabel(revisionNo),
    parentQuotationId: source.id,
    changeReason: normalizeText(body?.changeReason) || `Revision from ${source.quoteNumber || source.id}`,
    isWinningVersion: 0,
    items: JSON.stringify(body?.items || JSON.parse(source.items || '[]')),
    financialParams: JSON.stringify(body?.financialParams || JSON.parse(source.financialParams || '{}')),
    terms: JSON.stringify(body?.terms || JSON.parse(source.terms || '{}')),
    subtotal: body?.subtotal ?? source.subtotal ?? 0,
    taxTotal: body?.taxTotal ?? source.taxTotal ?? 0,
    grandTotal: body?.grandTotal ?? source.grandTotal ?? 0,
    status: 'draft',
    validUntil: body?.validUntil ?? source.validUntil ?? null,
  };
}
