import {
  computeLineItemPricing,
  ensureArray,
  normalizeQuotationLineItems,
  normalizeQuotationVatMode,
  roundCurrencyValue,
} from './quotationShared';

export type QuotationOfferGroup = {
  id?: string | null;
  groupKey: string;
  label?: string | null;
  currency: string;
  vatComputed: boolean;
  totalComputed: boolean;
  sortOrder: number;
};

export type OfferGroupValidation = {
  errors: string[];
  primaryError: string | null;
  canComputeVat: boolean;
  canComputeTotal: boolean;
  hasMixedVatMode: boolean;
  hasMixedCurrency: boolean;
  hasInvalidLineValues: boolean;
  isEmpty: boolean;
};

export type ComputedOfferGroup = QuotationOfferGroup & {
  displayLabel: string;
  items: Array<any>;
  validation: OfferGroupValidation;
  summary: {
    currency: string;
    netSubtotal: number;
    vatTotal: number;
    grossTotal: number;
  } | null;
};

function buildDefaultOfferGroupKey(index: number) {
  const alphabetIndex = index % 26;
  const cycle = Math.floor(index / 26);
  const suffix = String.fromCharCode(65 + alphabetIndex);
  return cycle === 0 ? `group-${suffix.toLowerCase()}` : `group-${suffix.toLowerCase()}-${cycle + 1}`;
}

function buildDefaultOfferGroupLabel(index: number) {
  const alphabetIndex = index % 26;
  const suffix = String.fromCharCode(65 + alphabetIndex);
  return `Phương án ${suffix}`;
}

function normalizeGroupKey(value: unknown, index: number, legacyIsOption?: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (normalized) return normalized;
  if (legacyIsOption === true || Number(legacyIsOption) === 1) return 'group-b';
  return index === 0 ? 'group-a' : buildDefaultOfferGroupKey(index);
}

export function createEmptyOfferGroup(index: number, currency = 'VND'): QuotationOfferGroup {
  return {
    id: null,
    groupKey: index === 0 ? 'group-a' : buildDefaultOfferGroupKey(index),
    label: '',
    currency,
    vatComputed: false,
    totalComputed: false,
    sortOrder: index,
  };
}

export function normalizeQuotationOfferGroups(
  raw: unknown,
  lineItemsRaw: unknown,
  defaultCurrency = 'VND',
): QuotationOfferGroup[] {
  const lineItems = normalizeQuotationLineItems(lineItemsRaw);
  const rawGroups = ensureArray<any>(raw);

  const groups = rawGroups.length
    ? rawGroups.map((group: any, index: number) => ({
        id: group?.id || null,
        groupKey: normalizeGroupKey(group?.groupKey, index),
        label: typeof group?.label === 'string' ? group.label : '',
        currency: String(group?.currency || defaultCurrency || 'VND').toUpperCase(),
        vatComputed: group?.vatComputed === true || Number(group?.vatComputed) === 1,
        totalComputed: group?.totalComputed === true || Number(group?.totalComputed) === 1,
        sortOrder: Number.isFinite(Number(group?.sortOrder)) ? Number(group.sortOrder) : index,
      }))
    : [];

  const seen = new Set(groups.map((group) => group.groupKey));
  lineItems.forEach((lineItem, index) => {
    const groupKey = normalizeGroupKey(lineItem.offerGroupKey, index, lineItem.isOption);
    if (seen.has(groupKey)) return;
    seen.add(groupKey);
    groups.push({
      id: null,
      groupKey,
      label: '',
      currency: String(lineItem.currency || defaultCurrency || 'VND').toUpperCase(),
      vatComputed: false,
      totalComputed: false,
      sortOrder: groups.length,
    });
  });

  if (!groups.length) {
    return [createEmptyOfferGroup(0, defaultCurrency)];
  }

  return groups
    .map((group, index) => ({
      ...group,
      sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index,
      totalComputed: group.vatComputed ? group.totalComputed : false,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function serializeQuotationLineItemsByOfferGroups(
  rawLineItems: unknown,
  rawOfferGroups: unknown,
) {
  const lineItems = normalizeQuotationLineItems(rawLineItems);
  const offerGroups = normalizeQuotationOfferGroups(rawOfferGroups, lineItems);
  const orderedGroupKeys = offerGroups.map((group) => group.groupKey);

  const bucketed = new Map<string, any[]>();
  lineItems.forEach((lineItem) => {
    const groupKey = lineItem.offerGroupKey || 'group-a';
    const bucket = bucketed.get(groupKey) || [];
    bucket.push(lineItem);
    bucketed.set(groupKey, bucket);
  });

  const ordered = orderedGroupKeys.flatMap((groupKey) => bucketed.get(groupKey) || []);
  const unseen = lineItems.filter((lineItem) => !orderedGroupKeys.includes(lineItem.offerGroupKey || 'group-a'));

  return [...ordered, ...unseen].map((lineItem, index) => ({
    ...lineItem,
    sortOrder: index,
  }));
}

function isMissingNumberish(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  const numeric = Number(String(value).replace(/,/g, '').trim());
  return !Number.isFinite(numeric);
}

function isInvalidQuantity(value: unknown) {
  if (isMissingNumberish(value)) return true;
  return Number(String(value).replace(/,/g, '').trim()) <= 0;
}

function isInvalidUnitPrice(value: unknown) {
  if (isMissingNumberish(value)) return true;
  return Number(String(value).replace(/,/g, '').trim()) < 0;
}

function isInvalidVatRate(value: unknown) {
  if (isMissingNumberish(value)) return true;
  return Number(String(value).replace(/,/g, '').trim()) < 0;
}

export function computeOfferGroupValidation(
  offerGroup: QuotationOfferGroup,
  rawItems: any[],
): OfferGroupValidation {
  const errors: string[] = [];
  const normalizedItems = normalizeQuotationLineItems(rawItems, {
    currency: offerGroup.currency,
  });

  if (!rawItems.length) {
    errors.push('Chưa có dòng sản phẩm để tính');
  }

  if (!String(offerGroup.currency || '').trim()) {
    errors.push('Thiếu tiền tệ của phương án');
  }

  const hasInvalidLineValues = rawItems.some((item) => isInvalidQuantity(item?.quantity) || isInvalidUnitPrice(item?.unitPrice));
  if (hasInvalidLineValues) {
    errors.push('Có dòng sản phẩm thiếu số lượng hoặc đơn giá');
  }

  const hasInvalidVatRate = rawItems.some((item) => isInvalidVatRate(item?.vatRate));
  if (hasInvalidVatRate) {
    errors.push('VAT % không hợp lệ');
  }

  const hasMixedCurrency = normalizedItems.some((item) => item.currency !== offerGroup.currency);
  if (hasMixedCurrency) {
    errors.push('Phương án có dữ liệu tiền tệ không nhất quán');
  }

  const vatModes = Array.from(new Set(normalizedItems.map((item) => normalizeQuotationVatMode(item.vatMode, 'net'))));
  const hasMixedVatMode = vatModes.length > 1;
  if (hasMixedVatMode) {
    errors.push('Phương án đang có line NET và gross lẫn nhau nên không thể tính VAT/tổng');
  }

  const primaryError = errors[0] || null;
  const canComputeVat = !primaryError;
  const canComputeTotal = canComputeVat && offerGroup.vatComputed;

  return {
    errors,
    primaryError,
    canComputeVat,
    canComputeTotal,
    hasMixedVatMode,
    hasMixedCurrency,
    hasInvalidLineValues: hasInvalidLineValues || hasInvalidVatRate,
    isEmpty: rawItems.length === 0,
  };
}

export function computeQuotationOfferWorkspace(
  rawLineItems: unknown,
  rawOfferGroups: unknown,
  defaultCurrency = 'VND',
) {
  const rawItems = ensureArray<any>(rawLineItems);
  const normalizedItems = normalizeQuotationLineItems(rawItems, { currency: defaultCurrency });
  const offerGroups = normalizeQuotationOfferGroups(rawOfferGroups, normalizedItems, defaultCurrency);

  const computedOfferGroups: ComputedOfferGroup[] = offerGroups.map((offerGroup, index) => {
    const groupItems = normalizedItems.filter((lineItem) => lineItem.offerGroupKey === offerGroup.groupKey);
    const decoratedItems = groupItems.map((lineItem) => ({
      ...lineItem,
      pricing: computeLineItemPricing(lineItem),
    }));
    const validation = computeOfferGroupValidation(
      offerGroup,
      rawItems.filter((_, itemIndex) => normalizedItems[itemIndex]?.offerGroupKey === offerGroup.groupKey),
    );
    const summary = validation.primaryError
      ? null
      : decoratedItems.reduce(
          (acc, row) => ({
            currency: offerGroup.currency,
            netSubtotal: roundCurrencyValue(acc.netSubtotal + row.pricing.netTotal, offerGroup.currency),
            vatTotal: roundCurrencyValue(acc.vatTotal + row.pricing.vatTotal, offerGroup.currency),
            grossTotal: roundCurrencyValue(acc.grossTotal + row.pricing.grossTotal, offerGroup.currency),
          }),
          {
            currency: offerGroup.currency,
            netSubtotal: 0,
            vatTotal: 0,
            grossTotal: 0,
          },
        );

    return {
      ...offerGroup,
      displayLabel: String(offerGroup.label || '').trim(),
      items: decoratedItems,
      validation,
      summary,
      sortOrder: Number.isFinite(Number(offerGroup.sortOrder)) ? Number(offerGroup.sortOrder) : index,
      totalComputed: offerGroup.vatComputed ? offerGroup.totalComputed : false,
    };
  });

  return {
    items: normalizedItems,
    offerGroups: computedOfferGroups,
  };
}

export function getOfferGroupDisplayTitle(group: Pick<QuotationOfferGroup, 'label' | 'sortOrder'>) {
  const label = String(group.label || '').trim();
  if (label) return label;
  return '';
}

export function getOfferGroupFallbackLabel(index: number) {
  return buildDefaultOfferGroupLabel(index);
}
