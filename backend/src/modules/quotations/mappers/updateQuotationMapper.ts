import { normalizeText } from './common';
import { normalizeQuotationInputStatus } from '../../../../quotation-status';
import { buildTypedQuotationStateFromBody } from '../typedState';

type MapUpdateQuotationInputParams = {
  body: any;
  current: any;
  nextStatus: unknown;
  buildRevisionLabel: (revisionNo: number) => string;
};

export function mapUpdateQuotationInput(params: MapUpdateQuotationInputParams) {
  const { body, current, nextStatus, buildRevisionLabel } = params;
  const hasParentQuotationIdField = Object.prototype.hasOwnProperty.call(body ?? {}, 'parentQuotationId');
  const currentRevisionNo = Number.isFinite(Number(current?.revisionNo)) ? Number(current.revisionNo) : 1;
  const revisionNo = Number.isFinite(Number(body?.revisionNo)) ? Number(body.revisionNo) : currentRevisionNo;
  const typedState = buildTypedQuotationStateFromBody({
    lineItems: body?.lineItems ?? current?.lineItems,
    offerGroups: body?.offerGroups ?? current?.offerGroups,
    financialConfig: body?.financialConfig ?? current?.financialConfig,
    commercialTerms: body?.commercialTerms ?? current?.commercialTerms,
  });

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
    parentQuotationId: hasParentQuotationIdField ? normalizeText(body?.parentQuotationId) : (current?.parentQuotationId || null),
    changeReason: body?.changeReason || current?.changeReason || null,
    isWinningVersion: typeof body?.isWinningVersion === 'boolean' || typeof body?.isWinningVersion === 'number'
      ? Number(body.isWinningVersion ? 1 : 0)
      : Number(current?.isWinningVersion ? 1 : 0),
    lineItems: typedState.lineItems,
    offerGroups: typedState.offerGroups,
    financialConfig: typedState.financialConfig,
    commercialTerms: typedState.commercialTerms,
    subtotal: body?.subtotal,
    taxTotal: body?.taxTotal,
    grandTotal: body?.grandTotal,
    status: normalizeQuotationInputStatus(String(nextStatus)) || String(nextStatus),
    validUntil: body?.validUntil,
  };
}
