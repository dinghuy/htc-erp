import { API_BASE } from '../config';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

export type ApprovalGateSummary = {
  gateType?: string;
  status?: string | null;
  latestApprovalId?: string | null;
  pendingCount?: number;
  pendingApprovers?: Array<{
    approvalId?: string;
    approverRole?: string | null;
    approverName?: string | null;
  }>;
};

export type QuotationActionAvailability = {
  canEdit?: boolean;
  canDelete?: boolean;
  canRevise?: boolean;
  canRequestCommercialApproval?: boolean;
  canCreateSalesOrder?: boolean;
  blockers?: string[];
  linkedSalesOrderId?: string | null;
  linkedSalesOrderStatus?: string | null;
};

export type QuotationRow = {
  id: string;
  quoteNumber?: string | null;
  revisionNo?: number | null;
  revisionLabel?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  subject?: string | null;
  accountName?: string | null;
  accountId?: string | null;
  quoteDate?: string | null;
  createdAt?: string | null;
  grandTotal?: number | null;
  status?: string | null;
  isRemind?: boolean;
  approvalGateState?: ApprovalGateSummary | null;
  actionAvailability?: QuotationActionAvailability | null;
};

export const API = API_BASE;
export const PREVIEW_PAGE_WIDTH = 595.28;
export const PREVIEW_PAGE_HEIGHT = 841.89;
export const PREVIEW_MARGIN_X = 14.17;
export const PREVIEW_MARGIN_Y = 28.35;
export const PREVIEW_CONTENT_WIDTH = PREVIEW_PAGE_WIDTH - PREVIEW_MARGIN_X * 2;
export const PREVIEW_BASE_CONTENT_WIDTH = 495.28;
export const PREVIEW_SCALE = PREVIEW_CONTENT_WIDTH / PREVIEW_BASE_CONTENT_WIDTH;
export const PREVIEW_GRID_COL_LEFT = 255 * PREVIEW_SCALE;
export const PREVIEW_GRID_COL_RIGHT = 230 * PREVIEW_SCALE;
export const PREVIEW_GRID_GAP = 25 * PREVIEW_SCALE;
export const PREVIEW_LABEL_LEFT = 95 * PREVIEW_SCALE;
export const PREVIEW_LABEL_RIGHT = 80 * PREVIEW_SCALE;

export const statusBadgeStyle = (status?: string) => {
  return getQuotationStatusMeta(status).style;
};

export const quotationStyles = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  btnGhost: {
    ...ui.btn.ghost,
    fontSize: '12px',
    fontWeight: 700,
    color: tokens.colors.textSecondary,
    transition: 'all 0.2s ease',
  } as any,
  thSortable: { ...ui.table.thSortable, letterSpacing: '0.06em' } as any,
  thStatic: { ...ui.table.thStatic, letterSpacing: '0.06em' } as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, boxSizing: 'border-box', transition: 'all 0.2s ease' } as any,
  select: { ...ui.input.base, boxSizing: 'border-box', transition: 'all 0.2s ease' } as any,
  textarea: { ...ui.input.textarea, boxSizing: 'border-box' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: tokens.spacing.sm } as any,
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase' as any,
    letterSpacing: '0.1em',
    color: tokens.colors.primary,
    borderBottom: `2px solid ${tokens.colors.border}`,
    paddingBottom: '10px',
    marginBottom: '18px',
  } as any,
};

export const PAYMENT_PRESETS = [
  '30% khi ký hợp đồng, 70% trước khi giao hàng',
  '30% khi ký hợp đồng, 40% khi hàng đến cảng, 30% trước khi giao hàng',
  '100% khi ký hợp đồng',
  '30% khi ký hợp đồng, 70% trước khi xuất xưởng',
  'Theo điều khoản LC (Letter of Credit)',
];

export const DELIVERY_PRESETS = [
  '2-3 tháng kể từ ngày ký hợp đồng',
  '4-6 tháng kể từ ngày ký hợp đồng',
  '6-9 tháng kể từ ngày ký hợp đồng',
  'Trong vòng 30 ngày kể từ ngày xác nhận đơn hàng',
  '120-150 ngày kể từ ngày ký hợp đồng',
];

export const VALIDITY_PRESETS = [
  '15 ngày kể từ ngày báo giá',
  '30 ngày kể từ ngày báo giá',
  '45 ngày kể từ ngày báo giá',
];

export const WARRANTY_PRESETS = [
  'Bảo hành theo tiêu chuẩn nhà sản xuất',
  '12 tháng kể từ ngày giao hàng',
  '24 tháng kể từ ngày giao hàng',
  '12 tháng cho Prime Mover & Trailer, 5 năm cho pin',
];

export const UNITS = ['Chiếc', 'Bộ', 'Cái', 'Cặp', 'Hộp', 'Thùng', 'Kg', 'Gói'];
export const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'CNY'];
export const VAT_MODES = ['net', 'gross'] as const;
export const VALID_STATUSES = ['draft', 'submitted_for_approval', 'revision_required', 'approved', 'rejected', 'won', 'lost'] as const;
export const LEGACY_STATUS_ALIASES: Record<string, (typeof VALID_STATUSES)[number]> = {
  sent: 'submitted_for_approval',
  accepted: 'won',
  expired: 'lost',
};

function coerceBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

export function normalizeQuotationStatus(status?: string | null) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return '';
  if ((VALID_STATUSES as readonly string[]).includes(normalized)) return normalized;
  return LEGACY_STATUS_ALIASES[normalized] || '';
}

export const isLegacyStatus = (status?: string) => !normalizeQuotationStatus(status);

export const allowedTransitions = (status?: string) => {
  const normalized = normalizeQuotationStatus(status);
  if (normalized === 'draft') return ['submitted_for_approval'];
  if (normalized === 'submitted_for_approval') return ['approved', 'rejected', 'revision_required'];
  if (normalized === 'revision_required') return ['submitted_for_approval'];
  if (normalized === 'approved') return ['won', 'lost'];
  return [];
};

export function isReadOnlyQuotationStatus(status?: string | null) {
  const normalized = normalizeQuotationStatus(status);
  return !normalized || ['won', 'lost', 'rejected'].includes(normalized);
}

export function getQuotationStatusMeta(status?: string | null) {
  const normalized = normalizeQuotationStatus(status);
  if (normalized === 'submitted_for_approval') return { normalized, label: 'Chờ duyệt', style: ui.badge.info };
  if (normalized === 'revision_required') return { normalized, label: 'Cần chỉnh sửa', style: ui.badge.warning };
  if (normalized === 'approved') return { normalized, label: 'Đã duyệt', style: ui.badge.success };
  if (normalized === 'won') return { normalized, label: 'Đã thắng', style: ui.badge.success };
  if (normalized === 'lost') return { normalized, label: 'Đã mất', style: ui.badge.neutral };
  if (normalized === 'rejected') return { normalized, label: 'Từ chối', style: ui.badge.error };
  if (normalized === 'draft') return { normalized, label: 'Nháp', style: ui.badge.neutral };
  return { normalized: '', label: status ? String(status) : 'Không rõ', style: ui.badge.neutral };
}

export function getApprovalStateMeta(status?: string | null) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'pending') return { label: 'Chờ duyệt thương mại', style: ui.badge.warning };
  if (normalized === 'approved') return { label: 'Đã duyệt thương mại', style: ui.badge.success };
  if (normalized === 'rejected') return { label: 'Duyệt bị từ chối', style: ui.badge.error };
  if (normalized === 'not_requested') return { label: 'Chưa gửi duyệt', style: ui.badge.neutral };
  return { label: 'Không có trạng thái duyệt', style: ui.badge.neutral };
}

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

export const getVnDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIMEZONE }).format(date);

export const vnStartOfDay = (iso: string) => new Date(`${getVnDate(new Date(iso))}T00:00:00+07:00`);

export const hasRateIncreaseWarning = (latestRate: number | null, qbuRateValue: any) => {
  const base = Number(qbuRateValue);
  return latestRate != null && Number.isFinite(base) && latestRate >= base * 1.025;
};

export const hasQbuStaleWarning = (qbuUpdatedAt?: string | null) => {
  if (!qbuUpdatedAt) return false;
  const base = vnStartOfDay(qbuUpdatedAt);
  const due = new Date(base);
  due.setMonth(due.getMonth() + 6);
  const todayVn = new Date(`${getVnDate(new Date())}T00:00:00+07:00`);
  return todayVn >= due;
};

export const hasSnapshotMissingWarning = (
  qbuUpdatedAt?: string | null,
  qbuRateValue?: any,
  qbuRateDate?: any,
) => {
  if (!qbuUpdatedAt) return false;
  return qbuRateValue == null || qbuRateDate == null;
};

export function ensureArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeQuotationLineItems(
  value: unknown,
  defaults: { currency?: string | null; vatRate?: number | null; offerGroupKey?: string | null } = {},
) {
  const source = ensureArray<any>(value);
  return source.map((item: any) => ({
    id: item?.id || null,
    sku: item?.sku || '',
    name: item?.name || '',
    unit: item?.unit || 'Chiếc',
    technicalSpecs: item?.technicalSpecs || '',
    remarks: item?.remarks || '',
    quantity: (item?.quantity != null && Number.isFinite(Number(item.quantity))) ? Number(item.quantity) : 1,
    unitPrice: (item?.unitPrice != null && Number.isFinite(Number(item.unitPrice))) ? Number(item.unitPrice) : 0,
    sortOrder: item?.sortOrder ?? null,
    isOption: coerceBoolean(item?.isOption, false),
    offerGroupKey: String(item?.offerGroupKey || defaults.offerGroupKey || (coerceBoolean(item?.isOption, false) ? 'group-b' : 'group-a')),
    currency: item?.currency || defaults.currency || 'VND',
    vatMode: normalizeQuotationVatMode(item?.vatMode, 'net'),
    vatRate: normalizeVatRate(item?.vatRate, normalizeVatRate(defaults.vatRate, 8)),
  }));
}

export function normalizeQuotationVatMode(value: unknown, fallback: 'net' | 'gross' = 'net') {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'gross' || normalized === 'included') return 'gross';
  if (normalized === 'net' || normalized === 'excluded') return 'net';
  return fallback;
}

export function normalizeVatRate(value: unknown, fallback = 8) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeCalculateTotals(value: unknown, fallback = true) {
  return coerceBoolean(value, fallback);
}

export function calculateLineItemAmount(item: any) {
  const quantity = Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : 1;
  const unitPrice = Number.isFinite(Number(item?.unitPrice)) ? Number(item.unitPrice) : 0;
  return quantity * unitPrice;
}

export function getCurrencyPrecision(currency?: string | null) {
  return String(currency || 'VND').toUpperCase() === 'VND' ? 0 : 2;
}

export function roundCurrencyValue(value: unknown, currency?: string | null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const precision = getCurrencyPrecision(currency);
  const factor = 10 ** precision;
  return Math.round(numeric * factor) / factor;
}

export function formatCurrencyValue(value: unknown, currency?: string | null) {
  const normalizedCurrency = String(currency || 'VND').toUpperCase();
  return roundCurrencyValue(value, normalizedCurrency).toLocaleString('en-US', {
    minimumFractionDigits: getCurrencyPrecision(normalizedCurrency),
    maximumFractionDigits: getCurrencyPrecision(normalizedCurrency),
  });
}

export function sanitizeCurrencyInput(value: unknown, currency?: string | null) {
  const precision = getCurrencyPrecision(currency);
  const source = String(value ?? '').replace(/,/g, '');
  const hadDecimal = source.includes('.');
  const cleaned = source.replace(/[^\d.]/g, '');
  const [rawInteger = '', ...rest] = cleaned.split('.');
  const integerPart = rawInteger.replace(/^0+(?=\d)/, '') || (rawInteger.startsWith('0') ? '0' : rawInteger);
  if (precision === 0) {
    return integerPart;
  }
  const fractionPart = rest.join('').slice(0, precision);
  if (!hadDecimal) {
    return integerPart;
  }
  return `${integerPart || '0'}.${fractionPart}`;
}

export function formatCurrencyInputDisplay(value: unknown, currency?: string | null) {
  const sanitized = sanitizeCurrencyInput(value, currency);
  if (!sanitized) return '';
  const [integerPart = '', fractionPart = ''] = sanitized.split('.');
  const groupedInteger = (integerPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sanitized.includes('.') ? `${groupedInteger}.${fractionPart}` : groupedInteger;
}

function countCurrencyTokens(value: string) {
  return value.split('').filter((char) => /\d|\./.test(char)).length;
}

function resolveCaretFromTokenCount(value: string, tokenCount: number) {
  if (tokenCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d|\./.test(value[index])) {
      seen += 1;
      if (seen >= tokenCount) return index + 1;
    }
  }
  return value.length;
}

export function getCurrencyInputEditState(inputValue: string, selectionStart: number, currency?: string | null) {
  const normalizedSelection = Number.isFinite(selectionStart) ? selectionStart : inputValue.length;
  const tokenCountBeforeCaret = countCurrencyTokens(inputValue.slice(0, normalizedSelection));
  const rawValue = sanitizeCurrencyInput(inputValue, currency);
  const displayValue = formatCurrencyInputDisplay(rawValue, currency);
  const caretPosition = resolveCaretFromTokenCount(displayValue, tokenCountBeforeCaret);
  return {
    rawValue,
    displayValue,
    caretPosition,
  };
}

export function parseNumberInput(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!normalized) return 0;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function computeLineItemPricing(item: any) {
  const quantity = Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : 1;
  const currency = String(item?.currency || 'VND').toUpperCase();
  const vatMode = normalizeQuotationVatMode(item?.vatMode, 'net');
  const vatRate = normalizeVatRate(item?.vatRate, 8);
  const unitPrice = parseNumberInput(item?.unitPrice);
  const precision = getCurrencyPrecision(currency);
  const factor = 10 ** precision;
  const round = (value: number) => Math.round(value * factor) / factor;
  const unitGross = vatMode === 'gross' ? unitPrice : round(unitPrice * (1 + vatRate / 100));
  const unitNet = vatMode === 'gross' ? round(unitPrice / (1 + vatRate / 100)) : unitPrice;
  const grossTotal = round(quantity * unitGross);
  const netTotal = round(quantity * unitNet);
  const vatTotal = round(grossTotal - netTotal);
  return {
    quantity,
    currency,
    vatMode,
    vatRate,
    unitPrice,
    unitNet,
    unitGross,
    netTotal,
    vatTotal,
    grossTotal,
  };
}

export function splitQuotationLineItems(value: unknown) {
  const items = normalizeQuotationLineItems(value);
  const mainItems = items.filter((item) => item.isOption !== true);
  const optionItems = items.filter((item) => item.isOption === true);
  return {
    items,
    mainItems,
    optionItems,
    hasMainItems: mainItems.length > 0,
    hasOptionItems: optionItems.length > 0,
    isAllOptional: mainItems.length === 0 && optionItems.length > 0,
  };
}

export function serializeQuotationLineItems(value: unknown) {
  const { mainItems, optionItems } = splitQuotationLineItems(value);
  return [...mainItems, ...optionItems].map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

export function computeQuotationTotals(value: unknown, vatRate: unknown, calculateTotals: unknown) {
  const { items, mainItems, optionItems, isAllOptional } = splitQuotationLineItems(value);
  const normalizedVatRate = normalizeVatRate(vatRate);
  const shouldCalculate = normalizeCalculateTotals(calculateTotals);
  const decorate = (item: any) => {
    const withDefaults = {
      ...item,
      currency: item?.currency || 'VND',
      vatMode: item?.vatMode === 'included' ? 'included' : 'excluded',
      vatRate: normalizeVatRate(item?.vatRate, normalizedVatRate),
    };
    return {
      ...withDefaults,
      pricing: computeLineItemPricing(withDefaults),
    };
  };
  const decoratedMainItems = mainItems.map(decorate);
  const decoratedOptionItems = optionItems.map(decorate);
  const groupByCurrency = (rows: any[]) => {
    const groups = new Map<string, any>();
    rows.forEach((row) => {
      const currencyKey = row.pricing.currency;
      const current =
        groups.get(currencyKey) || {
          currency: currencyKey,
          items: [],
          netSubtotal: 0,
          vatTotal: 0,
          grossTotal: 0,
        };
      current.items.push(row);
      current.netSubtotal = roundCurrencyValue(current.netSubtotal + row.pricing.netTotal, currencyKey);
      current.vatTotal = roundCurrencyValue(current.vatTotal + row.pricing.vatTotal, currencyKey);
      current.grossTotal = roundCurrencyValue(current.grossTotal + row.pricing.grossTotal, currencyKey);
      groups.set(currencyKey, current);
    });
    return Array.from(groups.values());
  };
  const mainCurrencyGroups = groupByCurrency(decoratedMainItems);
  const optionCurrencyGroups = groupByCurrency(decoratedOptionItems);
  const singleMainCurrencyGroup = mainCurrencyGroups.length === 1 ? mainCurrencyGroups[0] : null;
  const subtotal = singleMainCurrencyGroup?.netSubtotal || 0;
  const taxTotal = shouldCalculate ? singleMainCurrencyGroup?.vatTotal || 0 : 0;
  const grandTotal = shouldCalculate ? singleMainCurrencyGroup?.grossTotal || 0 : 0;
  const optionValue = optionCurrencyGroups.length === 1 ? optionCurrencyGroups[0].grossTotal : 0;
  const shouldShowTotals = shouldCalculate && decoratedMainItems.length > 0;

  return {
    items,
    mainItems: decoratedMainItems,
    optionItems: decoratedOptionItems,
    subtotal,
    taxTotal,
    grandTotal,
    optionValue,
    vatRate: normalizedVatRate,
    calculateTotals: shouldCalculate,
    shouldShowTotals,
    isAllOptional,
    mainCurrencyGroups,
    optionCurrencyGroups,
  };
}

export function normalizeCommercialTerms(value: any) {
  const source = value && typeof value === 'object' ? value : {};
  const explicitTermItems = ensureArray<any>(source.termItems);
  const fallbackTermItems = !explicitTermItems.length
    ? [
        { labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: source.validity || '', textEn: source.validityEn || '' },
        { labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: source.payment || '', textEn: source.paymentEn || '' },
        { labelViPrint: 'Giao hàng', labelEn: 'Delivery', textVi: source.delivery || '', textEn: source.deliveryEn || '' },
        { labelViPrint: 'Bảo hành', labelEn: 'Warranty', textVi: source.warranty || '', textEn: source.warrantyEn || '' },
      ].filter((item: any) => item.textVi || item.textEn)
    : [];

  return {
    remarks: source.remarksVi ?? source.remarks ?? '',
    remarksEn: source.remarksEn ?? '',
    termItems: (explicitTermItems.length ? explicitTermItems : fallbackTermItems).map((item: any) => ({
      id: item?.id || null,
      sortOrder: item?.sortOrder ?? null,
      labelViPrint: item?.labelViPrint || '',
      labelEn: item?.labelEn || '',
      textVi: item?.textVi || '',
      textEn: item?.textEn || '',
    })),
  };
}

export function createInitialQuotationTerms() {
  return {
    remarks:
      'Giá trên đã bao gồm thuế VAT 8%. Giá trị VAT được tính theo thuế suất áp dụng tại thời điểm phát hành hóa đơn.\nDo biến động của thị trường toàn cầu, đơn giá có thể thay đổi khi có thông báo cập nhật từ nhà máy, phụ thuộc vào giá nguyên vật liệu, cước vận tải, tỷ giá ngoại tệ hoặc các yếu tố đầu vào khác trước thời điểm xác nhận đơn hàng.',
    remarksEn:
      'The above price includes VAT 8%. VAT applicable tax rate is calculated at the time of invoice issuance.\nDue to global market fluctuations, unit prices are subject to change upon updated notification from the factory, depending on raw material costs, freight rates, exchange rates, or other input factors prior to order confirmation.',
    termItems: [
      { labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: VALIDITY_PRESETS[1], textEn: '30 days from the date here of' },
      { labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: PAYMENT_PRESETS[0], textEn: '30% upon order, 70% balance before delivery' },
      { labelViPrint: 'Giao hàng', labelEn: 'Delivery', textVi: DELIVERY_PRESETS[1], textEn: '4-6 months from the date of signing the contract' },
      { labelViPrint: 'Bảo hành', labelEn: 'Warranty', textVi: WARRANTY_PRESETS[0], textEn: 'According to manufacturer standards' },
    ],
  };
}

export function createNewQuotationTerms() {
  return {
    remarks: '',
    remarksEn: '',
    termItems: [
      { labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: VALIDITY_PRESETS[1], textEn: '30 days from the date here of' },
      { labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: PAYMENT_PRESETS[0], textEn: '30% upon order, 70% balance before delivery' },
      { labelViPrint: 'Giao hàng', labelEn: 'Delivery', textVi: DELIVERY_PRESETS[1], textEn: '4-6 months from the date of signing the contract' },
      { labelViPrint: 'Bảo hành', labelEn: 'Warranty', textVi: WARRANTY_PRESETS[0], textEn: 'According to manufacturer standards' },
    ],
  };
}

export function buildQuotationReadiness(params: { selectedAccId?: string | null; lineItems?: unknown }) {
  const blockers: string[] = [];

  if (!params.selectedAccId) blockers.push('missing_account');
  if (ensureArray(params.lineItems).length === 0) blockers.push('empty_line_items');

  return {
    canSave: blockers.length === 0,
    blockers,
  };
}

export function buildSaveQuotationGuard(params: { selectedAccId?: string | null; lineItems?: unknown }) {
  const readiness = buildQuotationReadiness(params);
  const firstBlocker = readiness.blockers[0];

  const notifyMessage =
    firstBlocker === 'missing_account'
      ? 'Vui lòng chọn Khách hàng'
      : firstBlocker === 'empty_line_items'
        ? 'Vui lòng thêm ít nhất 1 sản phẩm'
        : null;

  return {
    ...readiness,
    notifyMessage,
  };
}

export function resolveSubmissionContactId(params: {
  selectedAccId?: string | null;
  selectedContactId?: string | null;
  contacts?: Array<{ id?: string | null; accountId?: string | null }>;
}) {
  const contact = ensureArray(params.contacts).find((item: any) => item?.id === params.selectedContactId);
  if (!contact) return '';
  return contact.accountId === params.selectedAccId ? params.selectedContactId || '' : '';
}

export function resetDependentSelections(params: {
  previousAccountId?: string | null;
  nextAccountId?: string | null;
  selectedContactId?: string | null;
  contacts?: Array<{ id?: string | null; accountId?: string | null }>;
}) {
  if (params.previousAccountId === params.nextAccountId) {
    return { selectedContactId: params.selectedContactId || '' };
  }

  const nextContacts = ensureArray(params.contacts).filter(
    (contact: any) => contact?.accountId === params.nextAccountId,
  );
  const isSelectedContactValid = nextContacts.some(
    (contact: any) => contact?.id === params.selectedContactId,
  );

  return {
    selectedContactId: isSelectedContactValid ? params.selectedContactId || '' : '',
  };
}
