export type QuotationLineItemInput = {
  id?: string | null;
  sortOrder?: number | null;
  sku?: string | null;
  name?: string | null;
  unit?: string | null;
  technicalSpecs?: string | null;
  remarks?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
};

export type QuotationLineItemRecord = {
  id: string;
  sortOrder: number;
  sku: string | null;
  name: string | null;
  unit: string | null;
  technicalSpecs: string | null;
  remarks: string | null;
  quantity: number;
  unitPrice: number;
};

export type QuotationFinancialConfig = {
  interestRate: number;
  exchangeRate: number;
  loanTermMonths: number;
  markup: number;
  vatRate: number;
};

export type QuotationCommercialTermItemInput = {
  id?: string | null;
  sortOrder?: number | null;
  labelViPrint?: string | null;
  labelEn?: string | null;
  textVi?: string | null;
  textEn?: string | null;
};

export type QuotationCommercialTermItemRecord = {
  id: string;
  sortOrder: number;
  labelViPrint: string | null;
  labelEn: string | null;
  textVi: string | null;
  textEn: string | null;
};

export type QuotationCommercialTerms = {
  remarksVi: string | null;
  remarksEn: string | null;
  termItems: QuotationCommercialTermItemRecord[];
};

export const DEFAULT_QUOTATION_FINANCIAL_CONFIG: QuotationFinancialConfig = {
  interestRate: 8.5,
  exchangeRate: 25400,
  loanTermMonths: 36,
  markup: 15,
  vatRate: 8,
};

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function normalizeNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseJsonObject(raw: unknown) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(raw: unknown) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeQuotationLineItems(raw: unknown): QuotationLineItemInput[] {
  return parseJsonArray(raw).map((item: any, index: number) => ({
    id: normalizeText(item?.id),
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
    sku: normalizeText(item?.sku),
    name: normalizeText(item?.name),
    unit: normalizeText(item?.unit) || 'Chiếc',
    technicalSpecs: normalizeText(item?.technicalSpecs),
    remarks: normalizeText(item?.remarks),
    quantity: normalizeNumber(item?.quantity, 1),
    unitPrice: normalizeNumber(item?.unitPrice, 0),
  }));
}

export function normalizeQuotationFinancialConfig(raw: unknown): QuotationFinancialConfig {
  const source = parseJsonObject(raw);
  return {
    interestRate: normalizeNumber(source.interestRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.interestRate),
    exchangeRate: normalizeNumber(source.exchangeRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.exchangeRate),
    loanTermMonths: normalizeNumber(source.loanTermMonths, DEFAULT_QUOTATION_FINANCIAL_CONFIG.loanTermMonths),
    markup: normalizeNumber(source.markup, DEFAULT_QUOTATION_FINANCIAL_CONFIG.markup),
    vatRate: normalizeNumber(source.vatRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.vatRate),
  };
}

function legacyTermItem(labelViPrint: string, labelEn: string, textVi: unknown, textEn: unknown, sortOrder: number) {
  const normalizedTextVi = normalizeText(textVi);
  const normalizedTextEn = normalizeText(textEn);
  if (!normalizedTextVi && !normalizedTextEn) return null;
  return {
    id: `${labelEn.toLowerCase()}-${sortOrder + 1}`,
    sortOrder,
    labelViPrint,
    labelEn,
    textVi: normalizedTextVi,
    textEn: normalizedTextEn,
  };
}

export function normalizeQuotationCommercialTerms(raw: unknown): QuotationCommercialTerms {
  const source = parseJsonObject(raw) as any;

  const explicitTermItems = Array.isArray(source.termItems)
    ? source.termItems.map((item: any, index: number) => ({
        id: normalizeText(item?.id) || `term-${index + 1}`,
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
        labelViPrint: normalizeText(item?.labelViPrint),
        labelEn: normalizeText(item?.labelEn),
        textVi: normalizeText(item?.textVi),
        textEn: normalizeText(item?.textEn),
      }))
    : [];

  const fallbackTermItems = [
    legacyTermItem('Hiệu lực', 'Validity', source.validity, source.validityEn, 0),
    legacyTermItem('Thanh toán', 'Payment', source.payment, source.paymentEn, 1),
    legacyTermItem('Giao hàng', 'Delivery', source.delivery, source.deliveryEn, 2),
    legacyTermItem('Bảo hành', 'Warranty', source.warranty, source.warrantyEn, 3),
  ].filter(Boolean) as QuotationCommercialTermItemRecord[];

  return {
    remarksVi: normalizeText(source.remarksVi ?? source.remarks),
    remarksEn: normalizeText(source.remarksEn),
    termItems: (explicitTermItems.length ? explicitTermItems : fallbackTermItems).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function parseLegacyQuotationLineItems(raw: unknown) {
  return normalizeQuotationLineItems(raw);
}

export function parseLegacyQuotationFinancialConfig(raw: unknown) {
  return normalizeQuotationFinancialConfig(raw);
}

export function parseLegacyQuotationCommercialTerms(raw: unknown) {
  return normalizeQuotationCommercialTerms(raw);
}

export function buildTypedQuotationStateFromBody(body: any) {
  return {
    lineItems: normalizeQuotationLineItems(body?.lineItems),
    financialConfig: normalizeQuotationFinancialConfig(body?.financialConfig),
    commercialTerms: normalizeQuotationCommercialTerms(body?.commercialTerms),
  };
}

export function buildPdfTermsFromCommercialTerms(commercialTerms: QuotationCommercialTerms) {
  const termItems = Array.isArray(commercialTerms?.termItems) ? commercialTerms.termItems : [];
  const matchTerm = (candidates: string[]) =>
    termItems.find((item) => {
      const labelVi = String(item?.labelViPrint || '').trim().toLowerCase();
      const labelEn = String(item?.labelEn || '').trim().toLowerCase();
      return candidates.some((candidate) => labelVi.includes(candidate) || labelEn.includes(candidate));
    });

  const validity = matchTerm(['hiệu lực', 'validity']);
  const payment = matchTerm(['thanh toán', 'payment']);
  const delivery = matchTerm(['giao hàng', 'delivery']);
  const warranty = matchTerm(['bảo hành', 'warranty']);

  return {
    validity: validity?.textVi || '30 ngày kể từ ngày báo giá',
    validityEn: validity?.textEn || null,
    payment: payment?.textVi || 'Thanh toán 30% khi kí hợp đồng, 70% trước khi giao hàng',
    paymentEn: payment?.textEn || null,
    delivery: delivery?.textVi || 'Giao hàng từ 4-6 tháng kể từ ngày kí hợp đồng',
    deliveryEn: delivery?.textEn || null,
    warranty: warranty?.textVi || 'Bảo hành theo tiêu chuẩn nhà sản xuất',
    warrantyEn: warranty?.textEn || null,
    remarks: commercialTerms?.remarksVi || null,
    remarksEn: commercialTerms?.remarksEn || null,
  };
}
