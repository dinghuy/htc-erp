import { normalizeText } from './common';
import { normalizeQuotationInputStatus } from '../../../../quotation-status';

type MapUpdateQuotationInputParams = {
  body: any;
  current: any;
  nextStatus: unknown;
  buildRevisionLabel: (revisionNo: number) => string;
};

export function mapUpdateQuotationInput(params: MapUpdateQuotationInputParams) {
  const { body, current, nextStatus, buildRevisionLabel } = params;
  const currentRevisionNo = Number.isFinite(Number(current?.revisionNo)) ? Number(current.revisionNo) : 1;
  const revisionNo = Number.isFinite(Number(body?.revisionNo)) ? Number(body.revisionNo) : currentRevisionNo;

  return {
    quoteDate: body?.quoteDate || new Date().toISOString().slice(0, 10),
    subject: body?.subject,
    accountId: body?.accountId,
    contactId: body?.contactId,
    projectId: normalizeText(body?.projectId),
    salesperson: body?.salesperson,
    salespersonPhone: body?.salespersonPhone,
    currency: body?.currency,
    revisionNo,
    revisionLabel: body?.revisionLabel || current?.revisionLabel || buildRevisionLabel(currentRevisionNo),
    parentQuotationId: body?.parentQuotationId || current?.parentQuotationId || null,
    changeReason: body?.changeReason || current?.changeReason || null,
    isWinningVersion: typeof body?.isWinningVersion === 'boolean' || typeof body?.isWinningVersion === 'number'
      ? Number(body.isWinningVersion ? 1 : 0)
      : Number(current?.isWinningVersion ? 1 : 0),
    items: JSON.stringify(body?.items || []),
    financialParams: JSON.stringify(body?.financialParams || {}),
    terms: JSON.stringify(body?.terms || {}),
    subtotal: body?.subtotal,
    taxTotal: body?.taxTotal,
    grandTotal: body?.grandTotal,
    status: normalizeQuotationInputStatus(String(nextStatus)) || String(nextStatus),
    validUntil: body?.validUntil,
  };
}
