import { normalizeNumber, normalizeText } from './common';
import { normalizeQuotationInputStatus } from '../../../../quotation-status';
import {
  buildTypedQuotationStateFromBody,
  type QuotationCommercialTerms,
  type QuotationFinancialConfig,
  type QuotationOfferGroupRecord,
  type QuotationLineItemInput,
} from '../typedState';

export type MappedStandaloneQuotationInput = {
  quoteNumber: string;
  quoteDate: string | null;
  subject: string | null;
  accountId: string | null;
  contactId: string | null;
  salesperson: string | null;
  salespersonPhone: string | null;
  currency: string;
  opportunityId: string | null;
  lineItems: QuotationLineItemInput[];
  offerGroups: QuotationOfferGroupRecord[];
  financialConfig: QuotationFinancialConfig;
  commercialTerms: QuotationCommercialTerms;
  validUntil: string | null;
  parentQuotationId: string | null;
  requestedRevisionNo: number | null;
  revisionLabel: string | null;
  changeReason: string | null;
  projectId: string | null;
  projectName: string | null;
  projectStage: string | null;
  projectStatus: string | null;
  autoCreateProject: boolean;
  finalStatus: string;
  normalizedSubtotal: number;
  normalizedTaxTotal: number;
  normalizedGrandTotal: number;
};

export function mapStandaloneQuotationInput(body: any): MappedStandaloneQuotationInput {
  const normalizedStatus = normalizeQuotationInputStatus(normalizeText(body?.status)) || 'draft';
  const requestedRevisionNoRaw = normalizeNumber(body?.revisionNo, NaN);
  const typedState = buildTypedQuotationStateFromBody(body);

  return {
    quoteNumber: normalizeText(body?.quoteNumber) || '',
    quoteDate: normalizeText(body?.quoteDate),
    subject: normalizeText(body?.subject),
    accountId: normalizeText(body?.accountId),
    contactId: normalizeText(body?.contactId),
    salesperson: normalizeText(body?.salesperson),
    salespersonPhone: normalizeText(body?.salespersonPhone),
    currency: normalizeText(body?.currency) || 'VND',
    opportunityId: normalizeText(body?.opportunityId),
    lineItems: typedState.lineItems,
    offerGroups: typedState.offerGroups,
    financialConfig: typedState.financialConfig,
    commercialTerms: typedState.commercialTerms,
    validUntil: normalizeText(body?.validUntil),
    parentQuotationId: normalizeText(body?.parentQuotationId),
    requestedRevisionNo: Number.isFinite(requestedRevisionNoRaw) ? requestedRevisionNoRaw : null,
    revisionLabel: normalizeText(body?.revisionLabel),
    changeReason: normalizeText(body?.changeReason),
    projectId: normalizeText(body?.projectId),
    projectName: normalizeText(body?.projectName),
    projectStage: normalizeText(body?.projectStage),
    projectStatus: normalizeText(body?.projectStatus),
    autoCreateProject: body?.autoCreateProject !== false,
    finalStatus: normalizedStatus,
    normalizedSubtotal: normalizeNumber(body?.subtotal, 0),
    normalizedTaxTotal: normalizeNumber(body?.taxTotal, 0),
    normalizedGrandTotal: normalizeNumber(body?.grandTotal, 0),
  };
}
