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
  if (status === 'sent') return ui.badge.info;
  if (status === 'accepted') return ui.badge.success;
  if (status === 'rejected') return ui.badge.error;
  if (status === 'draft') return ui.badge.neutral;
  return ui.badge.neutral;
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
export const VALID_STATUSES = ['draft', 'sent', 'accepted', 'rejected'];

export const isLegacyStatus = (status?: string) => !status || !VALID_STATUSES.includes(status);

export const allowedTransitions = (status?: string) => {
  if (status === 'draft') return ['sent'];
  if (status === 'sent') return ['accepted', 'rejected'];
  return [];
};

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

export function normalizeQuotationLineItems(value: unknown) {
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
  }));
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
