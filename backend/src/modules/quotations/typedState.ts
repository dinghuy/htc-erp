export type QuotationLineItemInput = {
  id?: string | null;
  sortOrder?: number | null;
  sku?: string | null;
  name?: string | null;
  unit?: string | null;
  currency?: string | null;
  vatMode?: 'net' | 'gross' | 'included' | 'excluded' | null;
  vatRate?: number | null;
  technicalSpecs?: string | null;
  remarks?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  isOption?: boolean | null;
  offerGroupKey?: string | null;
};

export type QuotationLineItemRecord = {
  id: string;
  sortOrder: number;
  sku: string | null;
  name: string | null;
  unit: string | null;
  currency: string;
  vatMode: 'net' | 'gross';
  vatRate: number;
  technicalSpecs: string | null;
  remarks: string | null;
  quantity: number;
  unitPrice: number;
  isOption: boolean;
  offerGroupKey: string;
};

export type QuotationOfferGroupInput = {
  id?: string | null;
  groupKey?: string | null;
  label?: string | null;
  currency?: string | null;
  vatComputed?: boolean | null;
  totalComputed?: boolean | null;
  sortOrder?: number | null;
};

export type QuotationOfferGroupRecord = {
  id: string | null;
  groupKey: string;
  label: string | null;
  currency: string;
  vatComputed: boolean;
  totalComputed: boolean;
  sortOrder: number;
};

export type QuotationFinancialConfig = {
  interestRate: number;
  exchangeRate: number;
  loanTermMonths: number;
  markup: number;
  vatRate: number;
  calculateTotals: boolean;
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
  calculateTotals: true,
};

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function normalizeNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
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

export function normalizeVatMode(
  value: unknown,
  fallback: 'net' | 'gross' = 'net',
): 'net' | 'gross' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'gross' || normalized === 'included') return 'gross';
  if (normalized === 'net' || normalized === 'excluded') return 'net';
  return fallback;
}

function buildDefaultOfferGroupKey(index: number) {
  const alphabetIndex = index % 26;
  const cycle = Math.floor(index / 26);
  const suffix = String.fromCharCode(97 + alphabetIndex);
  return cycle === 0 ? `group-${suffix}` : `group-${suffix}-${cycle + 1}`;
}

function normalizeOfferGroupKey(
  value: unknown,
  index: number,
  legacyIsOption?: unknown,
) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (normalized) return normalized;
  if (legacyIsOption === true || Number(legacyIsOption) === 1) return 'group-b';
  return index === 0 ? 'group-a' : buildDefaultOfferGroupKey(index);
}

export function normalizeQuotationLineItems(
  raw: unknown,
  defaults: { currency?: string | null; vatRate?: number | null; offerGroupKey?: string | null } = {},
): QuotationLineItemInput[] {
  return parseJsonArray(raw).map((item: any, index: number) => ({
    id: normalizeText(item?.id),
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
    sku: normalizeText(item?.sku),
    name: normalizeText(item?.name),
    unit: normalizeText(item?.unit) || 'Chiếc',
    currency: normalizeText(item?.currency) || normalizeText(defaults.currency) || 'VND',
    vatMode: normalizeVatMode(item?.vatMode, 'net'),
    vatRate: normalizeNumber(
      item?.vatRate,
      normalizeNumber(defaults.vatRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.vatRate),
    ),
    technicalSpecs: normalizeText(item?.technicalSpecs),
    remarks: normalizeText(item?.remarks),
    quantity: normalizeNumber(item?.quantity, 1),
    unitPrice: normalizeNumber(item?.unitPrice, 0),
    isOption: normalizeBoolean(item?.isOption, false),
    offerGroupKey: normalizeOfferGroupKey(
      item?.offerGroupKey ?? item?.groupKey ?? defaults.offerGroupKey,
      index,
      item?.isOption,
    ),
  }));
}

function ensureOfferGroupsCoverLineItems(
  groups: QuotationOfferGroupRecord[],
  lineItems: QuotationLineItemInput[],
  defaultCurrency: string,
) {
  const seen = new Set(groups.map((group) => group.groupKey));
  const nextGroups = [...groups];

  lineItems.forEach((lineItem, index) => {
    const groupKey = normalizeOfferGroupKey(lineItem.offerGroupKey, index, lineItem.isOption);
    if (seen.has(groupKey)) return;
    seen.add(groupKey);
    nextGroups.push({
      id: null,
      groupKey,
      label: null,
      currency: normalizeText(lineItem.currency) || defaultCurrency,
      vatComputed: false,
      totalComputed: false,
      sortOrder: nextGroups.length,
    });
  });

  return nextGroups
    .map((group, index) => ({
      ...group,
      sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function inferOfferGroupsFromLineItems(
  lineItems: QuotationLineItemInput[],
  options: { currency?: string | null; calculateTotals?: boolean } = {},
): QuotationOfferGroupRecord[] {
  const defaultCurrency = normalizeText(options.currency) || 'VND';
  if (!lineItems.length) {
    return [
      {
        id: null,
        groupKey: 'group-a',
        label: null,
        currency: defaultCurrency,
        vatComputed: false,
        totalComputed: false,
        sortOrder: 0,
      },
    ];
  }

  const groups = new Map<string, QuotationOfferGroupRecord>();
  lineItems.forEach((lineItem, index) => {
    const groupKey = normalizeOfferGroupKey(lineItem.offerGroupKey, index, lineItem.isOption);
    if (groups.has(groupKey)) return;
    const isPrimaryLegacyGroup = groupKey === 'group-a';
    const totalComputed = isPrimaryLegacyGroup && normalizeBoolean(options.calculateTotals, true);
    groups.set(groupKey, {
      id: null,
      groupKey,
      label: null,
      currency: normalizeText(lineItem.currency) || defaultCurrency,
      vatComputed: totalComputed,
      totalComputed,
      sortOrder: groups.size,
    });
  });

  return Array.from(groups.values());
}

export function normalizeQuotationOfferGroups(
  raw: unknown,
  defaults: {
    lineItems?: unknown;
    currency?: string | null;
    calculateTotals?: boolean;
  } = {},
): QuotationOfferGroupRecord[] {
  const lineItems = normalizeQuotationLineItems(defaults.lineItems, {
    currency: defaults.currency,
  });
  const defaultCurrency = normalizeText(defaults.currency) || 'VND';
  const rawGroups = parseJsonArray(raw);

  const explicitGroups = rawGroups.map((group: any, index: number) => ({
    id: normalizeText(group?.id),
    groupKey: normalizeOfferGroupKey(group?.groupKey, index),
    label: normalizeText(group?.label),
    currency: normalizeText(group?.currency) || defaultCurrency,
    vatComputed: normalizeBoolean(group?.vatComputed, false),
    totalComputed: normalizeBoolean(group?.totalComputed, false),
    sortOrder: Number.isFinite(Number(group?.sortOrder)) ? Number(group.sortOrder) : index,
  }));

  const groups = explicitGroups.length
    ? ensureOfferGroupsCoverLineItems(explicitGroups, lineItems, defaultCurrency)
    : inferOfferGroupsFromLineItems(lineItems, {
        currency: defaultCurrency,
        calculateTotals: defaults.calculateTotals,
      });

  return groups;
}

export function normalizeQuotationFinancialConfig(raw: unknown): QuotationFinancialConfig {
  const source = parseJsonObject(raw);
  return {
    interestRate: normalizeNumber(source.interestRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.interestRate),
    exchangeRate: normalizeNumber(source.exchangeRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.exchangeRate),
    loanTermMonths: normalizeNumber(source.loanTermMonths, DEFAULT_QUOTATION_FINANCIAL_CONFIG.loanTermMonths),
    markup: normalizeNumber(source.markup, DEFAULT_QUOTATION_FINANCIAL_CONFIG.markup),
    vatRate: normalizeNumber(source.vatRate, DEFAULT_QUOTATION_FINANCIAL_CONFIG.vatRate),
    calculateTotals: normalizeBoolean(source.calculateTotals, DEFAULT_QUOTATION_FINANCIAL_CONFIG.calculateTotals),
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
    termItems: (explicitTermItems.length ? explicitTermItems : fallbackTermItems).sort(
      (a: QuotationCommercialTermItemRecord, b: QuotationCommercialTermItemRecord) =>
        a.sortOrder - b.sortOrder,
    ),
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

export function parseLegacyQuotationOfferGroups(
  raw: unknown,
  lineItemsRaw: unknown,
  defaults: { currency?: string | null; calculateTotals?: boolean } = {},
) {
  return normalizeQuotationOfferGroups(raw, {
    lineItems: lineItemsRaw,
    currency: defaults.currency,
    calculateTotals: defaults.calculateTotals,
  });
}

export function buildTypedQuotationStateFromBody(body: any) {
  const financialConfig = normalizeQuotationFinancialConfig(body?.financialConfig);
  const lineItems = normalizeQuotationLineItems(body?.lineItems, {
    currency: body?.currency,
    vatRate: financialConfig.vatRate,
  });
  const offerGroups = normalizeQuotationOfferGroups(body?.offerGroups, {
    lineItems,
    currency: body?.currency,
    calculateTotals: financialConfig.calculateTotals,
  });

  return {
    lineItems,
    offerGroups,
    financialConfig,
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
