import { API_BASE } from './config';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { PageHeader } from './ui/PageHeader';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { OverlayModal } from './ui/OverlayModal';
import { canEdit, canDelete, fetchWithAuth } from './auth';
import { consumeNavContext } from './navContext';
import { useI18n } from './i18n';
import {
  CheckIcon,
  EyeIcon,
  ExportIcon,
  LoaderIcon,
  MoneyIcon,
  NoteIcon,
  PlusIcon,
  QuoteIcon,
  ReportIcon,
  TargetIcon,
  TrashIcon,
} from './ui/icons';

type ApprovalGateSummary = {
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

type QuotationActionAvailability = {
  canEdit?: boolean;
  canDelete?: boolean;
  canRevise?: boolean;
  canRequestCommercialApproval?: boolean;
  canCreateSalesOrder?: boolean;
  blockers?: string[];
  linkedSalesOrderId?: string | null;
  linkedSalesOrderStatus?: string | null;
};

type QuotationRow = {
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

const API = API_BASE;
const PREVIEW_PAGE_WIDTH = 595.28;
const PREVIEW_PAGE_HEIGHT = 841.89;
const PREVIEW_MARGIN_X = 14.17;
const PREVIEW_MARGIN_Y = 28.35;
const PREVIEW_CONTENT_WIDTH = PREVIEW_PAGE_WIDTH - PREVIEW_MARGIN_X * 2;
const PREVIEW_BASE_CONTENT_WIDTH = 495.28;
const PREVIEW_SCALE = PREVIEW_CONTENT_WIDTH / PREVIEW_BASE_CONTENT_WIDTH;
const PREVIEW_GRID_COL_LEFT = 255 * PREVIEW_SCALE;
const PREVIEW_GRID_COL_RIGHT = 230 * PREVIEW_SCALE;
const PREVIEW_GRID_GAP = 25 * PREVIEW_SCALE;
const PREVIEW_LABEL_LEFT = 95 * PREVIEW_SCALE;
const PREVIEW_LABEL_RIGHT = 80 * PREVIEW_SCALE;

const statusBadgeStyle = (status?: string) => {
  if (status === 'sent') return ui.badge.info;
  if (status === 'accepted') return ui.badge.success;
  if (status === 'rejected') return ui.badge.error;
  if (status === 'draft') return ui.badge.neutral;
  return ui.badge.neutral;
};

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  btnGhost: { ...ui.btn.ghost, fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary, transition: 'all 0.2s ease' } as any,
  thSortable: { ...ui.table.thSortable, letterSpacing: '0.06em' } as any,
  thStatic: { ...ui.table.thStatic, letterSpacing: '0.06em' } as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, boxSizing: 'border-box', transition: 'all 0.2s ease' } as any,
  select: { ...ui.input.base, boxSizing: 'border-box', transition: 'all 0.2s ease' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: tokens.spacing.sm } as any,
  sectionTitle: { fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' as any, letterSpacing: '0.1em', color: tokens.colors.primary, borderBottom: `2px solid ${tokens.colors.border}`, paddingBottom: '10px', marginBottom: '18px' } as any,
};

const PAYMENT_PRESETS = [
  '30% khi ký hợp đồng, 70% trước khi giao hàng',
  '30% khi ký hợp đồng, 40% khi hàng đến cảng, 30% trước khi giao hàng',
  '100% khi ký hợp đồng',
  '30% khi ký hợp đồng, 70% trước khi xuất xưởng',
  'Theo điều khoản LC (Letter of Credit)',
];
const DELIVERY_PRESETS = [
  '2-3 tháng kể từ ngày ký hợp đồng',
  '4-6 tháng kể từ ngày ký hợp đồng',
  '6-9 tháng kể từ ngày ký hợp đồng',
  'Trong vòng 30 ngày kể từ ngày xác nhận đơn hàng',
  '120-150 ngày kể từ ngày ký hợp đồng',
];
const VALIDITY_PRESETS = ['15 ngày kể từ ngày báo giá', '30 ngày kể từ ngày báo giá', '45 ngày kể từ ngày báo giá'];
const WARRANTY_PRESETS = [
  'Bảo hành theo tiêu chuẩn nhà sản xuất',
  '12 tháng kể từ ngày giao hàng',
  '24 tháng kể từ ngày giao hàng',
  '12 tháng cho Prime Mover & Trailer, 5 năm cho pin',
];
const UNITS = ['Chiếc', 'Bộ', 'Cái', 'Cặp', 'Hộp', 'Thùng', 'Kg', 'Gói'];
const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'CNY'];
const VALID_STATUSES = ['draft', 'sent', 'accepted', 'rejected'];
const isLegacyStatus = (status?: string) => !status || !VALID_STATUSES.includes(status);
const allowedTransitions = (status?: string) => {
  if (status === 'draft') return ['sent'];
  if (status === 'sent') return ['accepted', 'rejected'];
  return [];
};

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
const getVnDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIMEZONE }).format(d); // YYYY-MM-DD
const vnStartOfDay = (iso: string) => new Date(`${getVnDate(new Date(iso))}T00:00:00+07:00`);
const hasRateIncreaseWarning = (latestRate: number | null, qbuRateValue: any) => {
  const base = Number(qbuRateValue);
  return latestRate != null && Number.isFinite(base) && latestRate >= base * 1.025;
};
const hasQbuStaleWarning = (qbuUpdatedAt?: string | null) => {
  if (!qbuUpdatedAt) return false;
  const base = vnStartOfDay(qbuUpdatedAt);
  const due = new Date(base);
  due.setMonth(due.getMonth() + 6);
  const todayVn = new Date(`${getVnDate(new Date())}T00:00:00+07:00`);
  return todayVn >= due;
};
const hasSnapshotMissingWarning = (qbuUpdatedAt?: string | null, qbuRateValue?: any, qbuRateDate?: any) => {
  if (!qbuUpdatedAt) return false;
  return qbuRateValue == null || qbuRateDate == null;
};

function KpiCard({ icon, label, value, sub, color }: any) {
  return (
    <div style={{ ...S.card, padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`, display: 'flex', alignItems: 'center', gap: tokens.spacing.lg, flex: 1, minWidth: '180px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadow.sm }}>
      <div style={{ width: '48px', height: '48px', borderRadius: tokens.radius.lg, background: tokens.colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0, border: `1px solid ${tokens.colors.border}` }}>{icon}</div>
      <div>
        <div style={{ fontSize: '11px', color: tokens.colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: '24px', fontWeight: 800, color: color, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  );
}

function ProductModal({ productsDB, onSelect, onClose, latestRate, rateMissing, catalogError }: any) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('');
  const safeProducts = ensureArray(productsDB);
  const filtered = safeProducts.filter((p: any) => p.name?.toLowerCase().includes(filter.toLowerCase()) || p.sku?.toLowerCase().includes(filter.toLowerCase()));
  return (
    <OverlayModal
      title={t('sales.quotations.modal.select_product')}
      onClose={onClose}
      maxWidth="520px"
      contentPadding="0"
    >
      <div style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px' }}>
          <input type="text" placeholder={t('sales.quotations.modal.search_product')} style={S.input} value={filter} onInput={(e:any)=>setFilter(e.target.value)} />
          {rateMissing && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: tokens.colors.textMuted }}>
              {t('sales.quotations.modal.rate_missing')}
            </div>
          )}
          {catalogError && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: tokens.colors.warning, fontWeight: 700 }}>
              {catalogError}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          {filtered.map((p: any) => (
            <div key={p.id} onClick={() => onSelect(p)} style={{ padding: '14px 12px', borderBottom: `1px solid ${tokens.colors.border}`, cursor: 'pointer', borderRadius: tokens.radius.md, transition: '0.15s' }} onMouseEnter={e=>(e.currentTarget as any).style.background=tokens.colors.background} onMouseLeave={e=>(e.currentTarget as any).style.background=''}> 
              <div style={{ fontWeight: 800, color: tokens.colors.textPrimary }}><span style={{ color: tokens.colors.primary, marginRight: '8px' }}>{p.sku}</span>{p.name}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textMuted, marginTop: '4px' }}>{p.category} {p.unit ? `· ${p.unit}` : ''} {p.basePrice ? `· $${p.basePrice?.toLocaleString()}` : ''}</div>
              {(hasRateIncreaseWarning(latestRate ?? null, p.qbuRateValue) || hasQbuStaleWarning(p.qbuUpdatedAt) || hasSnapshotMissingWarning(p.qbuUpdatedAt, p.qbuRateValue, p.qbuRateDate)) && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {hasRateIncreaseWarning(latestRate ?? null, p.qbuRateValue) && (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.error, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '2px 8px', borderRadius: '999px' }}>
                      FX +2.5%
                    </span>
                  )}
                  {hasQbuStaleWarning(p.qbuUpdatedAt) && (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.warning, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '2px 8px', borderRadius: '999px' }}>
                      QBU 6M
                    </span>
                  )}
                  {hasSnapshotMissingWarning(p.qbuUpdatedAt, p.qbuRateValue, p.qbuRateDate) && (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '2px 8px', borderRadius: '999px' }}>
                      No FX
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: catalogError ? tokens.colors.warning : tokens.colors.textMuted }}>
              {catalogError || t('sales.quotations.modal.product_not_found')}
            </div>
          )}
        </div>
      </div>
    </OverlayModal>
  );
}

function FormField({ label, children, span }: any) {
  return (
    <div style={{ gridColumn: span === 2 ? '1/-1' : undefined }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function ensureArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}



export function Quotations({ autoOpenForm, onFormOpened, isMobile, currentUser }: { autoOpenForm?: boolean; onFormOpened?: () => void; isMobile?: boolean; currentUser?: any } = {}) {
  const { t } = useI18n();
  const token = currentUser?.token || '';
  const userCanEdit = canEdit(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');
  const userCanDelete = canDelete(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');
  const OPEN_QUOTE_KEY = 'crm_open_quotation_id'; // backward-compat: older deep links

  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [salespersons, setSalespersons] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [productsDB, setProductsDB] = useState<any[]>([]);
  const [productCatalogError, setProductCatalogError] = useState('');
  const [userDirectoryError, setUserDirectoryError] = useState('');
  const [latestUsdVndRate, setLatestUsdVndRate] = useState<number | null>(null);
  const [latestUsdVndWarnings, setLatestUsdVndWarnings] = useState<string[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [savingQuote, setSavingQuote] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showProdModal, setShowProdModal] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [filterProjectId, setFilterProjectId] = useState('');
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const previewA4Ref = useRef<HTMLDivElement | null>(null);

  // Auto open form when triggered from New Deal button
  useEffect(() => {
    if (autoOpenForm) {
      setShowForm(true);
      setEditingQuoteId(null);
      setMobileTab('form');
      if (onFormOpened) onFormOpened();
    }
  }, [autoOpenForm]);

  // Form State
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteStatus, setQuoteStatus] = useState('draft');
  const [currentEditingQuote, setCurrentEditingQuote] = useState<any | null>(null);
  const [subject, setSubject] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAccId, setSelectedAccId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [salespersonPhone, setSalespersonPhone] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [revisionNo, setRevisionNo] = useState(1);
  const [revisionLabel, setRevisionLabel] = useState('R1');
  const [changeReason, setChangeReason] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const BASE_PREVIEW_SCALE = 0.66;
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewContentHeight, setPreviewContentHeight] = useState(PREVIEW_PAGE_HEIGHT);
  const [fin] = useState({ interestRate: 8.5, exchangeRate: 25400, loanTermMonths: 36, markup: 15, vatRate: 8 });
  const [terms, setTerms] = useState<any>({ 
    remarks: 'Giá trên đã bao gồm thuế VAT 8%. Giá trị VAT được tính theo thuế suất áp dụng tại thời điểm phát hành hóa đơn.\nDo biến động của thị trường toàn cầu, đơn giá có thể thay đổi khi có thông báo cập nhật từ nhà máy, phụ thuộc vào giá nguyên vật liệu, cước vận tải, tỷ giá ngoại tệ hoặc các yếu tố đầu vào khác trước thời điểm xác nhận đơn hàng.',
    remarksEn: 'The above price includes VAT 8%. VAT applicable tax rate is calculated at the time of invoice issuance.\nDue to global market fluctuations, unit prices are subject to change upon updated notification from the factory, depending on raw material costs, freight rates, exchange rates, or other input factors prior to order confirmation.',
    termItems: [
      { labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: VALIDITY_PRESETS[1], textEn: '30 days from the date here of' },
      { labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: PAYMENT_PRESETS[0], textEn: '30% upon order, 70% balance before delivery' },
      { labelViPrint: 'Giao hàng', labelEn: 'Delivery', textVi: DELIVERY_PRESETS[1], textEn: '4-6 months from the date of signing the contract' },
      { labelViPrint: 'Bảo hành', labelEn: 'Warranty', textVi: WARRANTY_PRESETS[0], textEn: 'According to manufacturer standards' }
    ]
  });
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    setTranslating(true);
    try {
      const itemsToTranslate = terms.termItems || [];
      const textsToTranslate = [terms.remarks, ...itemsToTranslate.map((i:any) => i.textVi)];
      const translations = await Promise.all(textsToTranslate.map(async (text) => {
        if (!text) return '';
        const res = await fetch(`${API}/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        return data.translation || '';
      }));
      setTerms({
         ...terms, 
         remarksEn: translations[0], 
         termItems: itemsToTranslate.map((item:any, idx:number) => ({ ...item, textEn: translations[idx + 1] })) 
      });
    } catch (e: any) {
      showNotify('Lỗi dịch thuật API: ' + e.message, 'error');
    }
    setTranslating(false);
  };

  const selectedAcc = useMemo(() => accounts.find(a => a.id === selectedAccId), [accounts, selectedAccId]);
  const selectedProject = useMemo(() => projects.find((p: any) => p.id === selectedProjectId), [projects, selectedProjectId]);
  const accContacts = useMemo(() => contacts.filter(c => c.accountId === selectedAccId), [contacts, selectedAccId]);
  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedContactId), [contacts, selectedContactId]);
  const visibleQuotations = useMemo(() => {
    if (!filterProjectId) return quotations;
    return quotations.filter((q: any) => q.projectId === filterProjectId);
  }, [quotations, filterProjectId]);
  const previewScale = (previewZoom / 100) * BASE_PREVIEW_SCALE;
  const previewPageCount = Math.max(1, Math.ceil(previewContentHeight / PREVIEW_PAGE_HEIGHT));
  const getContactDisplayName = (contact: any) => {
    if (!contact) return '—';
    if (contact.fullName) return contact.fullName;
    const composed = [contact.lastName, contact.firstName].filter(Boolean).join(' ').trim();
    return composed || '—';
  };

  const loadData = async () => {
    try {
      const [qRes, sRes, aRes, pRes, prRes, cRes, spRes, uRes] = await Promise.all([
        fetchWithAuth(token, `${API}/quotations`), fetchWithAuth(token, `${API}/stats`), fetch(`${API}/accounts`),
        fetch(`${API}/products`), fetch(`${API}/projects`), fetch(`${API}/contacts`), fetchWithAuth(token, `${API}/salespersons`),
        fetchWithAuth(token, `${API}/users`)
      ]);
      const [quotationsPayload, statsPayload, accountsPayload, productsPayload, projectsPayload, contactsPayload, salespersonsPayload, usersPayload] = await Promise.all([
        qRes.json(),
        sRes.json(),
        aRes.json(),
        pRes.json(),
        prRes.json(),
        cRes.json(),
        spRes.json(),
        uRes.json(),
      ]);
      setQuotations(ensureArray<QuotationRow>(quotationsPayload));
      setStats(statsPayload && typeof statsPayload === 'object' && !Array.isArray(statsPayload) ? statsPayload : {});
      setAccounts(ensureArray(accountsPayload));
      setProjects(ensureArray(projectsPayload));
      setContacts(ensureArray(contactsPayload));
      setSalespersons(ensureArray(salespersonsPayload));

      if (pRes.ok && Array.isArray(productsPayload)) {
        setProductsDB(productsPayload);
        setProductCatalogError('');
      } else {
        setProductsDB([]);
        setProductCatalogError('Catalog sản phẩm đang tạm thời không tải được. Bạn vẫn có thể mở báo giá, nhưng chưa thể chọn sản phẩm từ database cho tới khi dữ liệu được nạp lại.');
      }

      if (uRes.ok && Array.isArray(usersPayload)) {
        setUsers(usersPayload);
        setUserDirectoryError('');
      } else {
        setUsers([]);
        setUserDirectoryError('Không tải được danh sách nhân sự. Bạn vẫn có thể nhập tay tên/số điện thoại sale hoặc dùng danh sách cũ bên dưới.');
      }

      try {
        const fxRes = await fetch(`${API}/exchange-rates/latest?pair=USDVND`);
        const fx = await fxRes.json();
        setLatestUsdVndRate(fx?.rate ?? null);
        setLatestUsdVndWarnings(Array.isArray(fx?.warnings) ? fx.warnings : []);
      } catch {
        setLatestUsdVndRate(null);
        setLatestUsdVndWarnings([]);
      }
    } catch {
      setQuotations([]);
      setAccounts([]);
      setProjects([]);
      setContacts([]);
      setSalespersons([]);
      setProductsDB([]);
      setUsers([]);
      setProductCatalogError('Không tải được catalog sản phẩm. Bạn vẫn có thể mở báo giá, nhưng chưa thể chọn sản phẩm từ database cho tới khi dữ liệu được nạp lại.');
      setUserDirectoryError('Không tải được danh sách nhân sự. Bạn vẫn có thể nhập tay tên/số điện thoại sale hoặc dùng danh sách cũ bên dưới.');
      console.error('Load failed');
    }
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const warnIfAspectMismatch = () => {
      const el = previewA4Ref.current;
      if (!el) return;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!width || !height) return;
      const targetWidth = PREVIEW_PAGE_WIDTH;
      const targetHeight = PREVIEW_PAGE_HEIGHT;
      const ratio = width / targetHeight;
      const targetRatio = targetWidth / targetHeight;
      const tolerance = 0.02;
      const diff = Math.abs(ratio - targetRatio) / targetRatio;
      if (diff > tolerance) {
        console.warn(
          `[Quotation Preview] A4 ratio mismatch: width=${width}px height=${height}px ratio=${ratio.toFixed(4)} target=${targetRatio.toFixed(4)} diff=${(diff * 100).toFixed(2)}%`
        );
      }
    };
    warnIfAspectMismatch();
    window.addEventListener('resize', warnIfAspectMismatch);
    return () => window.removeEventListener('resize', warnIfAspectMismatch);
  }, []);

  useEffect(() => {
    const measure = () => {
      const el = previewA4Ref.current;
      if (!el) return;
      const nextHeight = Math.max(PREVIEW_PAGE_HEIGHT, el.scrollHeight || 0);
      setPreviewContentHeight((prev) => (Math.abs(prev - nextHeight) > 0.5 ? nextHeight : prev));
    };
    measure();
    const rafId = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    items,
    terms,
    subject,
    selectedAccId,
    selectedContactId,
    salesperson,
    salespersonPhone,
    currency,
    quoteNumber,
    quoteDate,
  ]);

  const addItem = (p: any) => {
    setItems([...items, { ...p, quantity: 1, unitPrice: Math.round(p.basePrice * fin.exchangeRate * (1 + fin.markup / 100)), technicalSpecs: p.technicalSpecs || '', remarks: '', unit: p.unit || 'Chiếc' }]);
    setShowProdModal(false);
  };

  const updateItem = (idx: number, field: string, val: any) => {
    const next = [...items]; next[idx] = { ...next[idx], [field]: val }; setItems(next);
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.unitPrice || 0) * parseInt(i.quantity || 1)), 0);
    const taxTotal = subtotal * ((fin?.vatRate || 8) / 100);
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
  }, [items, fin]);

  const handleSalespersonSelect = (id: string) => {
    // Tìm trong Users trước (nhân viên công ty), fall back sang SalesPersons cũ
    const user = users.find(u => u.id === id);
    if (user) { 
      setSalesperson(user.fullName); 
      setSalespersonPhone(user.phone || ''); 
      return; 
    }
    const sp = salespersons.find(s => s.id === id);
    if (sp) { setSalesperson(sp.name); setSalespersonPhone(sp.phone || ''); }
  };

  const downloadQuotationPdf = async (quotationId: string, fallbackQuoteNumber?: string) => {
    setDownloadingPdfId(quotationId);
    try {
      const res = await fetch(`${API}/quotations/${quotationId}/pdf`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tải PDF');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const matched = disposition.match(/filename="?([^"]+)"?/i);
      const safeFallback = (fallbackQuoteNumber || 'quotation').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = matched?.[1] || `Quotation_${safeFallback}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showNotify(`Xuất PDF thất bại: ${e.message}`, 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const saveQuotation = async (status = 'draft') => {
    if (!selectedAccId) return showNotify('Vui lòng chọn Khách hàng', 'error');
    if (items.length === 0) return showNotify('Vui lòng thêm ít nhất 1 sản phẩm', 'error');
    setSavingQuote(true);
    const body = {
      quoteNumber: quoteNumber || `QT-${Date.now().toString().slice(-6)}`,
      quoteDate,
      projectId: selectedProjectId || null,
      subject, accountId: selectedAccId, contactId: selectedContactId,
      salesperson, salespersonPhone, currency,
      revisionNo,
      revisionLabel,
      changeReason,
      items: items.map(i => ({ sku: i.sku, name: i.name, quantity: i.quantity, unitPrice: parseFloat(i.unitPrice), unit: i.unit, technicalSpecs: i.technicalSpecs, remarks: i.remarks })),
      financialParams: fin, terms,
      subtotal: totals.subtotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal, status,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    try {
      let savedQuote;
      if (editingQuoteId) {
        const res = await fetchWithAuth(token, `${API}/quotations/${editingQuoteId}`, { method: 'PUT', body: JSON.stringify(body) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Cập nhật báo giá thất bại');
        }
        savedQuote = await res.json();
      } else {
        const res = await fetchWithAuth(token, `${API}/quotations`, { method: 'POST', body: JSON.stringify(body) });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Tạo báo giá thất bại');
        }
        savedQuote = await res.json();
      }

      setShowForm(false);
      setEditingQuoteId(null);
      loadData();
      showNotify('Đã lưu báo giá thành công', 'success');

      if (status === 'sent' && savedQuote?.id) {
        await downloadQuotationPdf(savedQuote.id, savedQuote.quoteNumber || body.quoteNumber);
      }
    } catch (e: any) {
      showNotify(e.message || 'Không thể lưu báo giá', 'error');
    } finally {
      setSavingQuote(false);
    }
  };

  const updateStatus = async (id: string, currentStatus: string, nextStatus: string) => {
    setUpdatingStatusId(id);
    try {
      const res = await fetchWithAuth(token, `${API}/quotations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus, expectedStatus: currentStatus })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Không thể cập nhật trạng thái');
      }
      showNotify('Cập nhật trạng thái thành công', 'success');
      await loadData();
      if (editingQuoteId === id) {
        setQuoteStatus(nextStatus);
        setCurrentEditingQuote((prev: any) => (prev ? { ...prev, status: nextStatus } : prev));
      }
    } catch (e: any) {
      showNotify(e.message || 'Không thể cập nhật trạng thái', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const deleteQuote = (id: string) => {
    setConfirmState({
      message: 'Xóa báo giá này?',
      onConfirm: async () => {
        setConfirmState(null);
        setQuotations(prev => prev.filter((q: any) => q.id !== id));
        await fetchWithAuth(token, `${API}/quotations/${id}`, { method: 'DELETE' });
      },
    });
  };

  const handleCreateRevision = async (q: any) => {
    try {
      const res = await fetchWithAuth(token, `${API}/quotations/${q.id}/revise`, {
        method: 'POST',
        body: JSON.stringify({
          quoteNumber: `${q.quoteNumber || 'QT'}-R${Number(q.revisionNo || 1) + 1}`,
          changeReason: 'Tạo revision mới từ quotation hiện tại',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tạo revision');
      }
      const revised = await res.json();
      await loadData();
      setFilterProjectId(revised.projectId || filterProjectId);
      await handleEditQuote(revised);
      showNotify('Đã tạo quotation revision mới', 'success');
    } catch (e: any) {
      showNotify(e.message || 'Không thể tạo revision', 'error');
    }
  };

  const handleEditQuote = async (q: any) => {
    try {
      const res = await fetchWithAuth(token, `${API}/quotations/${q.id}`);
      const fullQ = await res.json();
      setEditingQuoteId(fullQ.id);
      setQuoteStatus(fullQ.status || 'draft');
      setCurrentEditingQuote(fullQ);
      setQuoteNumber(fullQ.quoteNumber || '');
      setQuoteDate(fullQ.quoteDate ? new Date(fullQ.quoteDate).toISOString().slice(0, 10) : (fullQ.createdAt ? new Date(fullQ.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)));
      setSubject(fullQ.subject || '');
      setSelectedProjectId(fullQ.projectId || '');
      setSelectedAccId(fullQ.accountId || '');
      setSelectedContactId(fullQ.contactId || '');
      setSalesperson(fullQ.salesperson || '');
      setSalespersonPhone(fullQ.salespersonPhone || '');
      setCurrency(fullQ.currency || 'VND');
      setRevisionNo(Number(fullQ.revisionNo || 1));
      setRevisionLabel(fullQ.revisionLabel || `R${fullQ.revisionNo || 1}`);
      setChangeReason(fullQ.changeReason || '');
      setItems(JSON.parse(fullQ.items || '[]'));
      const parsedTerms = JSON.parse(fullQ.terms || '{}');
      if (Object.keys(parsedTerms).length > 0) {
        if (!parsedTerms.termItems) {
            parsedTerms.termItems = [
               { labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: parsedTerms.validity || '', textEn: parsedTerms.validityEn || '' },
               { labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: parsedTerms.payment || '', textEn: parsedTerms.paymentEn || '' },
               { labelViPrint: 'Giao hàng', labelEn: 'Delivery', textVi: parsedTerms.delivery || '', textEn: parsedTerms.deliveryEn || '' },
               { labelViPrint: 'Bảo hành', labelEn: 'Warranty', textVi: parsedTerms.warranty || '', textEn: parsedTerms.warrantyEn || '' },
            ].filter((t:any) => t.textVi); 
        }
        setTerms(parsedTerms);
      }
      setMobileTab('form');
      setShowForm(true);
    } catch {
      showNotify('Không thể tải chi tiết báo giá', 'error');
    }
  };

  const requestCommercialApproval = async (quotation: QuotationRow) => {
    if (!quotation.projectId) {
      showNotify('Quotation cần gắn project trước khi submit approval', 'error');
      return;
    }
    try {
      const res = await fetchWithAuth(token, `${API}/projects/${quotation.projectId}/approvals`, {
        method: 'POST',
        body: JSON.stringify({
          quotationId: quotation.id,
          requestType: 'quotation_commercial',
          title: `Quotation approval - ${quotation.quoteNumber || quotation.id}`,
          department: 'Commercial',
          approverRole: 'director',
          note: 'Submitted from quotations list',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tạo approval request');
      }
      showNotify('Đã tạo approval request cho quotation', 'success');
      await loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tạo approval request', 'error');
    }
  };

  const createSalesOrderFromQuotation = async (quotation: QuotationRow) => {
    try {
      const res = await fetchWithAuth(token, `${API}/sales-orders/from-quotation/${quotation.id}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tạo sales order');
      }
      showNotify('Đã tạo sales order', 'success');
      await loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể tạo sales order', 'error');
    }
  };

  // Deep link support: open a quotation by id when navigated from Tasks/Notifications.
  useEffect(() => {
    const ctx = consumeNavContext();
    if (ctx?.filters?.projectId) {
      setFilterProjectId(ctx.filters.projectId);
      setSelectedProjectId(ctx.filters.projectId);
    }
    if (ctx?.entityType === 'Quotation' && ctx.entityId) {
      void handleEditQuote({ id: ctx.entityId });
      return;
    }

    const quotationId = localStorage.getItem(OPEN_QUOTE_KEY);
    if (!quotationId) return;
    localStorage.removeItem(OPEN_QUOTE_KEY);
    void handleEditQuote({ id: quotationId });
  }, []);

  const handleCreateNew = () => {
    setEditingQuoteId(null);
    setQuoteStatus('draft');
    setCurrentEditingQuote(null);
    setQuoteNumber('');
    setQuoteDate(new Date().toISOString().slice(0, 10));
    setSubject('');
    setSelectedProjectId(filterProjectId || '');
    setSelectedAccId('');
    setSelectedContactId('');
    setSalesperson('');
    setSalespersonPhone('');
    setCurrency('VND');
    setRevisionNo(1);
    setRevisionLabel('R1');
    setChangeReason('');
    setItems([]);
    setTerms({
      remarks: '',
      remarksEn: '',
      termItems: [
        { labelViPrint: 'Hiệu lực', labelEn: 'Validity', textVi: VALIDITY_PRESETS[1], textEn: '30 days from the date here of' },
        { labelViPrint: 'Thanh toán', labelEn: 'Payment', textVi: PAYMENT_PRESETS[0], textEn: '30% upon order, 70% balance before delivery' },
        { labelViPrint: 'Giao hàng', labelEn: 'Delivery', textVi: DELIVERY_PRESETS[1], textEn: '4-6 months from the date of signing the contract' },
        { labelViPrint: 'Bảo hành', labelEn: 'Warranty', textVi: WARRANTY_PRESETS[0], textEn: 'According to manufacturer standards' }
      ]
    });
    setMobileTab('form');
    setShowForm(true);
  };

  if (showForm) {
    const isReadOnly = quoteStatus === 'accepted' || quoteStatus === 'rejected' || isLegacyStatus(quoteStatus);
    const showRemind = quoteStatus === 'sent' && currentEditingQuote?.isRemind;
    const mobileTabStyle = (active: boolean) => ({
      flex: 1,
      padding: '8px 12px',
      fontSize: '12px',
      fontWeight: 800,
      borderRadius: tokens.radius.md,
      border: `1px solid ${tokens.colors.border}`,
      background: active ? tokens.colors.primary : tokens.colors.surface,
      color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
      cursor: 'pointer'
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {showProdModal && (
          <ProductModal
            productsDB={productsDB}
            onClose={() => setShowProdModal(false)}
            onSelect={addItem}
            latestRate={latestUsdVndRate}
            rateMissing={latestUsdVndWarnings.includes('RATE_MISSING')}
            catalogError={productCatalogError}
          />
        )}

        <PageHeader
          icon={<QuoteIcon size={22} />}
          title="Trình tạo Báo giá"
          subtitle="Sales Kit — nhập đầy đủ để đồng bộ với template PDF"
          actions={<button onClick={() => { setShowForm(false); setEditingQuoteId(null); }} style={S.btnOutline}>&larr; Quay lại</button>}
        />

        {isMobile && (
          <div style={{ display: 'flex', gap: '8px', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '8px' }}>
            <button onClick={() => setMobileTab('form')} style={mobileTabStyle(mobileTab === 'form')}><NoteIcon size={14} /> Form</button>
            <button onClick={() => setMobileTab('preview')} style={mobileTabStyle(mobileTab === 'preview')}><EyeIcon size={14} /> Preview</button>
          </div>
        )}

        {(() => {
          const formPanel = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
            {/* SECTION 0 — Thông tin Báo giá */}
            <div style={{ ...S.card, padding: '24px' }}>
              <div style={S.sectionTitle}>0. Tiêu đề & Ngày Báo giá</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Số báo giá (Nhập thủ công)">
                  <input type="text" placeholder="VD: 059-26/BG/LD-PEQ-CHP" style={S.input} value={quoteNumber} onInput={(e:any)=>setQuoteNumber(e.target.value)} />
                </FormField>
                <FormField label="Ngày báo giá">
                  <input type="date" style={S.input} value={quoteDate} onInput={(e:any)=>setQuoteDate(e.target.value)} />
                </FormField>
                <FormField label="Project / Deal Workspace" span={2}>
                  <select style={S.select} value={selectedProjectId} onChange={(e:any)=>setSelectedProjectId(e.target.value)}>
                    <option value="">-- Chưa chọn project (hệ thống sẽ tự tạo nếu lưu mới) --</option>
                    {projects.map((p:any) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Revision" span={2}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 160px 1fr', gap: '12px' }}>
                    <input type="number" min={1} style={S.input} value={revisionNo} onInput={(e:any)=>setRevisionNo(Number(e.target.value || 1))} />
                    <input type="text" style={S.input} value={revisionLabel} onInput={(e:any)=>setRevisionLabel(e.target.value)} />
                    <input type="text" placeholder="Lý do thay đổi / ghi chú revision" style={S.input} value={changeReason} onInput={(e:any)=>setChangeReason(e.target.value)} />
                  </div>
                </FormField>
                <FormField label="Subject / Nội dung báo giá" span={2}>
                  <input type="text" placeholder="VD: Báo giá xe nâng Reach Stacker cho Cảng Hải Phòng" style={S.input} value={subject} onInput={(e:any)=>setSubject(e.target.value)} />
                </FormField>
                {selectedProject && (
                  <div style={{ gridColumn: '1/-1', background: tokens.colors.background, padding: '12px', borderRadius: '8px', fontSize: '12px', color: tokens.colors.textSecondary, border: `1px solid ${tokens.colors.border}` }}>
                    Workspace hiện tại: <strong>{selectedProject.name}</strong> {selectedProject.projectStage ? `· stage ${selectedProject.projectStage}` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 1 — Khách hàng */}
            <div style={{ ...S.card, padding: '24px' }}>
              <div style={S.sectionTitle}>1. Thông tin Khách hàng</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Chọn Account (Công ty / Cảng)" span={2}>
                  <select style={S.select} value={selectedAccId} onChange={(e:any)=>{setSelectedAccId(e.target.value); setSelectedContactId('');}}>
                    <option value="">-- Chọn Khách hàng --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.companyName}</option>)}
                  </select>
                </FormField>
                {selectedAcc && (
                  <div style={{ gridColumn: '1/-1', background: tokens.colors.background, padding: '12px', borderRadius: '8px', fontSize: '12px', color: tokens.colors.textSecondary, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', border: `1px solid ${tokens.colors.border}` }}>
                    <span>{selectedAcc.address || 'Chưa có địa chỉ'}</span>
                    <span>MST: {selectedAcc.taxCode || '—'}</span>
                  </div>
                )}
                <FormField label="Người liên hệ (Contact)" span={2}>
                  <select style={S.select} value={selectedContactId} onChange={(e:any)=>setSelectedContactId(e.target.value)} disabled={!selectedAccId}>
                    <option value="">-- Chọn người liên hệ --</option>
                    {accContacts.map(c => {
                      return <option key={c.id} value={c.id}>{c.firstName || c.fullName} {c.department ? `(${c.department})` : ''}</option>;
                    })}
                  </select>
                </FormField>
              </div>
            </div>

            {/* SECTION 2 — Sales Person */}
            <div style={{ ...S.card, padding: '24px' }}>
              <div style={S.sectionTitle}>2. Thông tin Sales / NV Phụ trách</div>
              {userDirectoryError && (
                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', border: `1px solid ${tokens.colors.warning}`, background: tokens.colors.badgeBgInfo, fontSize: '12px', color: tokens.colors.textSecondary }}>
                  {userDirectoryError}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Chọn từ danh sách Nhân viên" span={2}>
                  <select style={S.select} onChange={(e:any)=>handleSalespersonSelect(e.target.value)}>
                    <option value="">-- Chọn Nhân viên phụ trách --</option>
                    {users.length > 0 && (
                      <optgroup label="Nhân viên công ty">
                        {users.filter(u => u.status === 'Active').map(u =>
                          <option key={u.id} value={u.id}>{u.fullName} {u.role ? `— ${u.role}` : ''}</option>
                        )}
                      </optgroup>
                    )}
                    {salespersons.length > 0 && (
                      <optgroup label="Danh sách cũ">
                        {salespersons.map(s => <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>)}
                      </optgroup>
                    )}
                  </select>
                </FormField>
                <FormField label="Tên NV Sale (hoặc nhập tay)">
                  <input type="text" placeholder="VD: Huy" style={S.input} value={salesperson} onInput={(e:any)=>setSalesperson(e.target.value)} />
                </FormField>
                <FormField label="SĐT NV Sale (Phone/ĐT trên PDF)">
                  <input type="text" placeholder="VD: 0345 216497" style={S.input} value={salespersonPhone} onInput={(e:any)=>setSalespersonPhone(e.target.value)} />
                </FormField>
                <FormField label="Đơn vị tiền tệ (Crcy)">
                  <select style={S.select} value={currency} onChange={(e:any)=>setCurrency(e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
              </div>
            </div>

            {/* SECTION 3 — Sản phẩm */}
            <div style={{ ...S.card, padding: '24px' }}>
              <div style={S.sectionTitle}>3. Sản phẩm & Cấu trúc giá</div>
              {productCatalogError && (
                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', border: `1px solid ${tokens.colors.warning}`, background: tokens.colors.badgeBgInfo, fontSize: '12px', color: tokens.colors.textSecondary }}>
                  {productCatalogError}
                </div>
              )}
              {items.length === 0 ? (
                <div style={{ minHeight: '90px', border: `2px dashed ${tokens.colors.border}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.colors.textMuted, fontSize: '13px', marginBottom: '16px' }}>
                  Chưa có sản phẩm. Nhấn nút bên dưới để chọn từ database.
                </div>
              ) : items.map((item, idx) => (
                <div key={idx} style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: '10px', padding: '16px', marginBottom: '14px', background: tokens.colors.background }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 800, color: tokens.colors.primary }}>#{idx+1} — {item.sku}: {item.name}</div>
                    <button style={{ ...S.btnGhost, color: tokens.colors.error, fontSize: '18px' }} onClick={() => setItems(items.filter((_,i)=>i!==idx))}>×</button>
                  </div>
                  {(hasRateIncreaseWarning(latestUsdVndRate, item.qbuRateValue) || hasQbuStaleWarning(item.qbuUpdatedAt) || hasSnapshotMissingWarning(item.qbuUpdatedAt, item.qbuRateValue, item.qbuRateDate) || latestUsdVndWarnings.includes('RATE_MISSING')) && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {hasRateIncreaseWarning(latestUsdVndRate, item.qbuRateValue) && (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.error, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '2px 8px', borderRadius: '999px' }}>
                          Tỷ giá +2.5% (cần tính lại)
                        </span>
                      )}
                      {hasQbuStaleWarning(item.qbuUpdatedAt) && (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.warning, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '2px 8px', borderRadius: '999px' }}>
                          QBU quá 6 tháng
                        </span>
                      )}
                      {hasSnapshotMissingWarning(item.qbuUpdatedAt, item.qbuRateValue, item.qbuRateDate) && (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '2px 8px', borderRadius: '999px' }}>
                          Snapshot missing
                        </span>
                      )}
                      {latestUsdVndWarnings.includes('RATE_MISSING') && (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, border: `1px solid ${tokens.colors.border}`, background: tokens.colors.surface, padding: '2px 8px', borderRadius: '999px' }}>
                          Chưa có tỷ giá VCB
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={S.label}>ĐVT (Unit)</label>
                      <select style={S.select} value={item.unit} onChange={(e:any)=>updateItem(idx,'unit',e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Số lượng (Q.ty)</label>
                      <input type="number" min="1" value={item.quantity} onInput={(e:any)=>updateItem(idx,'quantity',e.target.value)} style={S.input} />
                    </div>
                    <div>
                      <label style={S.label}>Đơn giá ({currency})</label>
                      <input type="number" value={item.unitPrice} onInput={(e:any)=>updateItem(idx,'unitPrice',e.target.value)} style={S.input} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={S.label}>Thông số kỹ thuật (Commodity)</label>
                    <textarea rows={5} value={item.technicalSpecs} onInput={(e:any)=>updateItem(idx,'technicalSpecs',e.target.value)} 
                  style={{ ...S.input, background: tokens.colors.surface, fontFamily: 'var(--font-family-sans)', fontSize: '12px', resize: 'vertical' }}
                      placeholder={"- Nhãn hiệu: SOCMA\n- Model: HNRS4531\n- Xuất xứ: Trung Quốc\n- Tình trạng: Mới 100%\n- Năm SX: 2025 trở về sau\n- Tải trọng: 45T, 31T, 16T\n- Chiều cao nâng: 15100mm"} />
                  </div>
                  <div>
                    <label style={S.label}>Ghi chú / Remarks</label>
                    <input type="text" value={item.remarks} onInput={(e:any)=>updateItem(idx,'remarks',e.target.value)} style={{ ...S.input, background: tokens.colors.surface }} placeholder="Ghi chú đặc biệt..." />
                  </div>
                  <div style={{ marginTop: '10px', textAlign: 'right', fontSize: '13px', fontWeight: 800, color: tokens.colors.primary }}>
                    Thành tiền: {(parseFloat(item.unitPrice||0) * parseInt(item.quantity||1)).toLocaleString()} {currency}
                  </div>
                </div>
              ))}
              <button onClick={()=>setShowProdModal(true)} style={{ ...S.btnOutline, width: '100%', color: tokens.colors.info, borderColor: tokens.colors.info, justifyContent: 'center', fontWeight: 700 }}>+ Thêm Sản phẩm từ Database</button>
            </div>

            {/* SECTION 4 — Điều khoản */}
            <div style={{ ...S.card, padding: '24px' }}>
              <div style={{...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                4. Điều khoản & Ghi chú (Terms)
                <button onClick={handleTranslate} style={{...S.btnOutline, color: tokens.colors.warning, borderColor: tokens.colors.warning, padding: '4px 12px', fontSize: '13px'}} disabled={translating}>
                  {translating ? 'Đang dịch...' : 'Dịch toàn bộ sang Tiếng Anh'}
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={S.label}>Ghi chú chung (Remarks)</label>
                <textarea rows={3} value={terms.remarks} onInput={(e:any)=>setTerms({...terms, remarks: e.target.value})} style={S.input} placeholder="Nhập ghi chú chung bằng Tiếng Việt (nếu có)..."></textarea>
                {terms.remarksEn && <div style={{marginTop: '4px', fontSize: '12px', color: tokens.colors.textSecondary, fontStyle: 'italic'}}>EN: {terms.remarksEn}</div>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
                {(terms.termItems || []).map((item: any, idx: number) => (
                  <div key={idx} style={{ position: 'relative', background: tokens.colors.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '12px' }}>
                      <FormField label="Tên điều khoản (Tiếng Việt)">
                         <input type="text" value={item.labelViPrint} onInput={e => {
                             const n = [...terms.termItems]; n[idx].labelViPrint = e.currentTarget.value; setTerms({...terms, termItems: n});
                         }} style={S.input} placeholder="VD: Hiệu lực" />
                      </FormField>
                      <FormField label="Tên điều khoản (Tiếng Anh)">
                         <div style={{ display: 'flex', gap: '8px', minWidth: 0 }}>
                           <input type="text" value={item.labelEn} onInput={e => {
                               const n = [...terms.termItems]; n[idx].labelEn = e.currentTarget.value; setTerms({...terms, termItems: n});
                           }} style={{ ...S.input, minWidth: 0 }} placeholder="VD: Validity" />
                           <button type="button" onClick={() => {
                               const n = terms.termItems.filter((_:any, i:number) => i !== idx); setTerms({...terms, termItems: n});
                           }} style={{ ...S.btnGhost, color: tokens.colors.error, padding: '0 12px' }}>Xóa</button>
                         </div>
                      </FormField>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <FormField label="Nội dung Tiếng Việt">
                         <textarea rows={2} value={item.textVi} onInput={e => {
                             const n = [...terms.termItems]; n[idx].textVi = e.currentTarget.value; setTerms({...terms, termItems: n});
                         }} style={{ ...S.input, resize: 'vertical' }} />
                      </FormField>
                      <FormField label="Nội dung Tiếng Anh">
                         <textarea rows={2} value={item.textEn} onInput={e => {
                             const n = [...terms.termItems]; n[idx].textEn = e.currentTarget.value; setTerms({...terms, termItems: n});
                         }} style={{ ...S.input, resize: 'vertical' }} />
                      </FormField>
                    </div>
                  </div>
                ))}
                
              <button type="button" onClick={() => setTerms({...terms, termItems: [...(terms.termItems||[]), { labelViPrint: 'Điều khoản mới', labelEn: 'New Term', textVi: '', textEn: '' }]})} style={{ ...S.btnOutline, width: '100%', borderColor: tokens.colors.success, color: tokens.colors.success, justifyContent: 'center' }}>+ Thêm Điều Khoản Mới</button>
            </div>
          </div>
          </fieldset>
          </div>
          );

          // ── PREVIEW RIGHT (LDA Redesign) ──
          /*
            Manual layout checklist (no automated tests):
            1. A4 container: 595.28px width, 841.89px min height, padding 28.35/14.17/28.35.
            2. Header: logo 90px wide (auto height, preserved ratio), company block right, blue rule.
            3. Title: centered QUOTATION/BÁO GIÁ with No/Số below.
            4. Info grid: column widths scaled from 255px / 230px, label widths scaled from 95px / 80px.
            5. Table: total width 566.94px, header fill #5B9BD5, grid 0.9px, column widths scaled from 22/68/140/28/25/85/75/52.28.
            6. Remarks/Terms/Signatures: spacing and alignment match PDF.
            7. Page breaks: dashed line + Page N label at each 841.89px boundary.
            8. Zoom: slider 50–150%, default 100% (maps to 66% base scale).
          */
          const previewPanel = (
            <div style={{ ...S.card, background: 'var(--bg-primary)', position: 'relative', zIndex: 0, overflow: 'hidden', border: '1px solid var(--border-color)', width: isMobile ? '100%' : undefined }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <ReportIcon size={14} />
              {t('sales.quotations.preview.title')}
            </div>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('sales.quotations.preview.zoom')}</div>
              <input
                type="range"
                min="50"
                max="150"
                value={previewZoom}
                onInput={(e: any) => setPreviewZoom(Number(e.currentTarget.value))}
                style={{ flex: 1, minWidth: 0 }}
              />
              <div style={{ fontSize: '12px', width: '48px', textAlign: 'right', color: 'var(--text-secondary)' }}>{previewZoom}%</div>
            </div>
            <div style={{ padding: '12px', maxHeight: '82vh', overflowY: 'auto', overflowX: 'auto' }}>
                <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', color: '#1A202C', width: `${(PREVIEW_PAGE_WIDTH * previewScale).toFixed(2)}px` }}>
                <style>
                  {`
                    @font-face {
        font-family: var(--font-family-sans);
                      src: url("/Times New Roman.ttf") format("truetype");
                      font-weight: 400;
                      font-style: normal;
                      font-display: swap;
                    }
                    @font-face {
        font-family: var(--font-family-sans);
                      src: url("/Times New Roman Bold.ttf") format("truetype");
                      font-weight: 700;
                      font-style: normal;
                      font-display: swap;
                    }
                    @font-face {
        font-family: var(--font-family-sans);
                      src: url("/Times New Roman Italic.ttf") format("truetype");
                      font-weight: 400;
                      font-style: italic;
                      font-display: swap;
                    }
                    @font-face {
        font-family: var(--font-family-sans);
                      src: url("/Times New Roman Bold Italic.ttf") format("truetype");
                      font-weight: 700;
                      font-style: italic;
                      font-display: swap;
                    }
                  `}
                </style>

                <div style={{ position: 'relative', width: `${(PREVIEW_PAGE_WIDTH * previewScale).toFixed(2)}px`, height: `${(previewContentHeight * previewScale).toFixed(2)}px` }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${previewScale})`, transformOrigin: 'top left', willChange: 'transform' }}>
                    <div style={{ position: 'relative', width: `${PREVIEW_PAGE_WIDTH}px`, height: `${previewContentHeight}px` }}>
      <div ref={previewA4Ref} style={{ width: `${PREVIEW_PAGE_WIDTH}px`, minHeight: `${PREVIEW_PAGE_HEIGHT}px`, padding: `${PREVIEW_MARGIN_Y}px ${PREVIEW_MARGIN_X}px`, fontFamily: 'var(--font-family-sans)', fontSize: '11px', lineHeight: 1.5, boxSizing: 'border-box' }}>
                        {/* Header (Logo + Info) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: '1.5px solid #003F85' }}>
                          <img src="/lda-logo.png" alt="LDA" style={{ width: '90px', height: 'auto', objectFit: 'contain' }} />
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#003F85', fontWeight: 700, fontSize: '11px' }}>L&D AUTO COMPANY LIMITED</div>
                            <div style={{ color: '#64748B', fontSize: '9px', lineHeight: '11px', marginTop: '2px' }}>HW 51, My Tan Quarter,</div>
                            <div style={{ color: '#64748B', fontSize: '9px', lineHeight: '11px' }}>Phu My Ward, Ho Chi Minh City, Vietnam</div>
                            <div style={{ color: '#64748B', fontSize: '9px', lineHeight: '11px' }}>Tel: +84 254 6263 118    Fax: +84 254 6263 119</div>
                            <div style={{ color: '#64748B', fontSize: '9px', lineHeight: '11px' }}>Web: www.ldauto.vn    Hotline: 1900 9696 64</div>
                          </div>
                        </div>

                  {/* Title */}
                  <div style={{ textAlign: 'center', marginTop: '30px', marginBottom: '35px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#003F85' }}>QUOTATION/BÁO GIÁ</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '6px' }}>No/Số: {quoteNumber || '___-__/BG/LD-___'}</div>
                  </div>

                  {/* Customer Info Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: `${PREVIEW_GRID_COL_LEFT.toFixed(2)}px ${PREVIEW_GRID_COL_RIGHT.toFixed(2)}px`, columnGap: `${PREVIEW_GRID_GAP.toFixed(2)}px`, rowGap: '6px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Customer / KH:</div>
                      <div>{selectedAcc?.companyName || '—'}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_RIGHT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Date / Ngày:</div>
                      <div>{quoteDate ? new Date(quoteDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')}</div>
                    </div>

                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Address / ĐC:</div>
                      <div>{selectedAcc?.address || '—'}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_RIGHT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Sales / NV:</div>
                      <div>{salesperson || '—'}</div>
                    </div>

                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Tax code / MST:</div>
                      <div>{selectedAcc?.taxCode || '—'}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_RIGHT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Sale Phone:</div>
                      <div>{salespersonPhone || '—'}</div>
                    </div>

                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Contact / LH:</div>
                      <div>{getContactDisplayName(selectedContact)}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_RIGHT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Crcy / Tiền:</div>
                      <div>{currency}</div>
                    </div>

                    <div style={{ display: 'flex' }}>
                      <div style={{ width: `${PREVIEW_LABEL_LEFT.toFixed(2)}px`, color: '#64748B', fontWeight: 700 }}>Phone / ĐT:</div>
                      <div>{selectedContact?.phone || '—'}</div>
                    </div>
                  </div>

                  {subject && (
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#003F85', marginBottom: '14px' }}>
                      Subject / V/v: {subject}
                    </div>
                  )}

                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Dear Sir/Madam, / Thưa Ông/Bà,</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
                    We are glad to offer you the quotation as following / Chúng tôi xin gửi đến quý công ty bảng chào giá như sau:
                  </div>

                  {/* Items table */}
                  <div style={{ width: `${PREVIEW_CONTENT_WIDTH.toFixed(2)}px`, marginBottom: '18px' }}>
                    <table style={{ width: `${PREVIEW_CONTENT_WIDTH.toFixed(2)}px`, borderCollapse: 'collapse', fontSize: '9px', border: '0.9px solid #1A202C' }}>
                      <colgroup>
                        <col style={{ width: `${(22 * PREVIEW_SCALE).toFixed(2)}px` }} />
                        <col style={{ width: `${(68 * PREVIEW_SCALE).toFixed(2)}px` }} />
                        <col style={{ width: `${(140 * PREVIEW_SCALE).toFixed(2)}px` }} />
                        <col style={{ width: `${(28 * PREVIEW_SCALE).toFixed(2)}px` }} />
                        <col style={{ width: `${(25 * PREVIEW_SCALE).toFixed(2)}px` }} />
                        <col style={{ width: `${(85 * PREVIEW_SCALE).toFixed(2)}px` }} />
                        <col style={{ width: `${(75 * PREVIEW_SCALE).toFixed(2)}px` }} />
                        <col style={{ width: `${(52.28 * PREVIEW_SCALE).toFixed(2)}px` }} />
                      </colgroup>
                      <thead>
                        <tr style={{ background: '#5B9BD5', color: '#fff' }}>
                          {[
                            { en: 'No.', vi: 'Stt', align: 'left' },
                            { en: 'Part name', vi: 'Mã hàng', align: 'left' },
                            { en: 'Commodity', vi: 'Tên hàng hóa', align: 'left' },
                            { en: 'Unit', vi: 'ĐV', align: 'left' },
                            { en: 'Q.ty', vi: 'S.lg', align: 'left' },
                            { en: 'Unit price', vi: 'Đơn giá', align: 'right' },
                            { en: 'Total', vi: 'Thành tiền', align: 'right' },
                            { en: 'Remarks', vi: 'Ghi chú', align: 'left' },
                          ].map((h) => (
                            <th key={h.en} style={{ padding: '4px 4px', textAlign: h.align as any, fontWeight: 700, border: '0.9px solid #1A202C' }}>
                              <div style={{ lineHeight: 1.05 }}>{h.en}</div>
                              <div style={{ lineHeight: 1.05 }}>{h.vi}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: '16px 6px', textAlign: 'center', color: '#CBD5E1', fontStyle: 'italic', border: '0.9px solid #1A202C' }}>
                              {t('sales.quotations.preview.no_products')}
                            </td>
                          </tr>
                        ) : items.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '4px 4px', border: '0.9px solid #1A202C' }}>{idx + 1}</td>
                            <td style={{ padding: '4px 4px', color: '#003F85', fontWeight: 700, fontSize: '10.5px', border: '0.9px solid #1A202C' }}>{item.sku}</td>
                            <td style={{ padding: '4px 4px', whiteSpace: 'pre-line', lineHeight: 1.3, border: '0.9px solid #1A202C' }}>
                              <strong>{item.name}</strong>{item.technicalSpecs ? '\n' + item.technicalSpecs : ''}
                            </td>
                            <td style={{ padding: '4px 4px', textAlign: 'left', border: '0.9px solid #1A202C' }}>{item.unit}</td>
                            <td style={{ padding: '4px 4px', textAlign: 'left', border: '0.9px solid #1A202C' }}>{item.quantity}</td>
                            <td style={{ padding: '4px 4px', textAlign: 'right', fontSize: '10.5px', border: '0.9px solid #1A202C' }}>{parseFloat(item.unitPrice || 0).toLocaleString()}</td>
                            <td style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 700, fontSize: '10.5px', border: '0.9px solid #1A202C' }}>{(parseFloat(item.unitPrice || 0) * parseInt(item.quantity || 1)).toLocaleString()}</td>
                            <td style={{ padding: '4px 4px', fontSize: '9px', color: '#1A202C', border: '0.9px solid #1A202C' }}>{item.remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div style={{ marginLeft: 'auto', width: '260px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{t('sales.quotations.preview.subtotal')}:</span>
                      <strong>{totals.subtotal.toLocaleString()} {currency}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{t('sales.quotations.preview.tax', { rate: 8 })}:</span>
                      <strong>{totals.taxTotal.toLocaleString()} {currency}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#003F85', color: '#fff', marginTop: '8px' }}>
                      <span style={{ fontWeight: 700 }}>{t('sales.quotations.preview.grand_total').toUpperCase()}:</span>
                      <strong>{totals.grandTotal.toLocaleString()} {currency}</strong>
                    </div>
                  </div>

                  {/* Remarks & Terms */}
                  <div style={{ marginTop: '24px' }}>
                    {(terms.remarksEn || terms.remarks) && (
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontStyle: 'italic', fontWeight: 700, marginBottom: '6px' }}>Remark:</div>
                        {terms.remarksEn && <div style={{ fontWeight: 700, marginBottom: '4px', whiteSpace: 'pre-line' }}>{terms.remarksEn}</div>}
                        {terms.remarks && <div style={{ color: '#64748B', whiteSpace: 'pre-line' }}>{terms.remarks}</div>}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '20px', alignItems: 'end', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 700, color: '#003F85' }}>Terms & Conditions</div>
                      <div style={{ fontWeight: 700, color: '#003F85' }}>Điều khoản</div>
                    </div>
                    <div style={{ borderBottom: '1px solid #003F85', marginBottom: '12px' }} />

                    {(terms.termItems || []).map((t: any, idx: number) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '20px', marginBottom: '10px' }}>
                        <div>{idx + 1}. {t.labelEn}: {t.textEn}</div>
                        <div>{idx + 1}. {t.labelViPrint}: {t.textVi}</div>
                      </div>
                    ))}

                    <div style={{ marginTop: '20px', color: '#64748B' }}>
                      Best regard/Trân trọng./.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '36px', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>L&D AUTO COMPANY LIMITED</div>
                        <div style={{ fontSize: '11px' }}>CÔNG TY TNHH L&D AUTO</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>CUSTOMER</div>
                        <div style={{ fontSize: '11px' }}>{t('sales.quotations.preview.customer')}</div>
                      </div>
                    </div>
                  </div>
                    </div>
                  </div>
                  </div>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {Array.from({ length: previewPageCount - 1 }).map((_, idx) => (
                      <div key={`page-break-${idx}`} style={{ position: 'absolute', top: `${((idx + 1) * PREVIEW_PAGE_HEIGHT - PREVIEW_MARGIN_Y) * previewScale}px`, left: 0, width: '100%', borderTop: '1px dashed #CBD5E1' }}>
                        <div style={{ position: 'absolute', right: '6px', top: '-10px', fontSize: '9px', color: '#64748B', background: '#fff', padding: '0 4px' }}>
                          Page {idx + 2}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          );

          const actionButtons = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', position: 'relative', zIndex: 1, background: 'var(--bg-primary)' }}>
              {isReadOnly && (
                <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{t('sales.quotations.read_only')}</div>
              )}
              {showRemind && (
                <div style={{ fontSize: '12px', color: tokens.colors.warning }}>{t('sales.quotations.reminder')}</div>
              )}
              {editingQuoteId && !isReadOnly && allowedTransitions(quoteStatus).length > 0 && (
                <select
                  style={{ ...S.select, padding: '6px 8px', fontSize: '12px' }}
                  onChange={(e: any) => {
                    const next = e.target.value;
                    if (next) updateStatus(editingQuoteId, quoteStatus, next);
                    e.target.value = '';
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>{t('sales.quotations.change_status')}</option>
                  {allowedTransitions(quoteStatus).map(s => (
                    <option value={s}>{s.toUpperCase()}</option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '12px' }}>
                <button onClick={() => saveQuotation('draft')} disabled={savingQuote || isReadOnly} style={{ ...S.btnPrimary, flex: '1 1 220px', background: `linear-gradient(135deg, ${tokens.colors.warning}, ${tokens.colors.warningDark})`, opacity: (savingQuote || isReadOnly) ? 0.7 : 1, cursor: (savingQuote || isReadOnly) ? 'not-allowed' : 'pointer' }}>
                  {savingQuote ? <><LoaderIcon size={14} /> {t('sales.quotations.saving')}</> : <><CheckIcon size={14} /> {t('sales.quotations.save_draft')}</>}
                </button>
                <button onClick={() => saveQuotation('sent')} disabled={savingQuote || isReadOnly} style={{ ...S.btnPrimary, flex: '1 1 220px', background: tokens.colors.primaryDark, opacity: (savingQuote || isReadOnly) ? 0.7 : 1, cursor: (savingQuote || isReadOnly) ? 'not-allowed' : 'pointer' }}>
                  {savingQuote ? <><LoaderIcon size={14} /> {t('sales.quotations.exporting')}</> : <><ExportIcon size={14} /> {t('sales.quotations.export_pdf')}</>}
                </button>
              </div>
            </div>
          );

          if (isMobile) {
            return (
              <>
                {mobileTab === 'form' ? formPanel : previewPanel}
                {actionButtons}
              </>
            );
          }

          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: '24px', alignItems: 'start' }}>
              {/* ── FORM LEFT ── */}
              {formPanel}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {actionButtons}
                {previewPanel}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      <PageHeader
        icon={<ReportIcon size={22} />}
        title={t('sales.quotations.title')}
        subtitle={t('sales.quotations.subtitle')}
        actions={userCanEdit ? <button style={S.btnPrimary} onClick={handleCreateNew}><PlusIcon size={14} /> {t('sales.quotations.action.create')}</button> : undefined}
      />

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <KpiCard icon={<QuoteIcon size={20} />} label="Tổng Báo giá" value={stats.quotations ?? '—'} color={tokens.colors.primary} />
        <KpiCard icon={<MoneyIcon size={20} />} label="Pipeline" value="~15.5 Tỷ" color={tokens.colors.info} />
        <KpiCard icon={<TargetIcon size={20} />} label="Tỷ lệ thắng" value="32%" color={tokens.colors.warning} />
        <KpiCard icon={<LoaderIcon size={20} />} label="Active" value={stats.activeQuotations ?? '—'} color={tokens.colors.info} />
      </div>

      <div style={{ ...S.card, padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
          <label style={{ ...S.label, marginBottom: '6px' }}>Lọc theo project</label>
          <select style={S.select} value={filterProjectId} onChange={(e:any) => setFilterProjectId(e.target.value)}>
            <option value="">-- Tất cả project --</option>
            {projects.map((p:any) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>)}
          </select>
        </div>
        {filterProjectId && <button style={S.btnGhost} onClick={() => setFilterProjectId('')}>Xóa lọc</button>}
      </div>

      <div style={{ ...S.card, overflowX: 'auto', border: `1px solid ${tokens.colors.border}` }}>
        {loading ? <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}><LoaderIcon size={16} /> Đang tải dữ liệu...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.colors.background }}>
                {['Số Báo giá', 'Revision', 'Project', 'Nội dung', 'Khách hàng', 'Ngày báo giá', 'Tổng GT', 'Trạng thái', ''].map(h => (
                  <th key={h} style={S.thStatic}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleQuotations.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted }}>Bắt đầu bằng cách nhấn "Tạo Báo giá Mới"</td></tr>
              ) : visibleQuotations.map((q) => (
                <tr key={q.id} style={{ ...ui.table.row }} onMouseEnter={(e: any) => e.currentTarget.style.background = tokens.colors.background} onMouseLeave={(e: any) => e.currentTarget.style.background = ''}>
                  <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.primary }}>{q.quoteNumber}</td>
                  <td style={S.td}>{q.revisionLabel || `R${q.revisionNo || 1}`}</td>
                  <td style={{ ...S.td, fontSize: '12px', color: tokens.colors.textSecondary }}>{q.projectName || q.projectId || 'Tự tạo khi lưu'}</td>
                  <td style={{ ...S.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: tokens.colors.textMuted, fontSize: '12px' }}>{q.subject || '—'}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{q.accountName || q.accountId}</td>
                  <td style={S.td}>{new Date(q.quoteDate || q.createdAt || Date.now()).toLocaleDateString('vi-VN')}</td>
                  <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>{q.grandTotal?.toLocaleString()} đ</td>
                  <td style={S.td}>
                    {(() => {
                      const legacy = isLegacyStatus(q.status || undefined);
                      const remind = q.isRemind === true;
                      const gateState = q.approvalGateState;
                      return (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ ...statusBadgeStyle(q.status || undefined), border: `1px solid ${tokens.colors.border}` }}>
                            {q.status?.toUpperCase()}
                          </span>
                          {gateState?.status && gateState.status !== 'not_requested' && (
                            <span style={gateState.status === 'pending' ? ui.badge.warning : gateState.status === 'approved' ? ui.badge.success : ui.badge.info}>
                              Approval: {String(gateState.status).toUpperCase()}
                            </span>
                          )}
                          {(gateState?.pendingApprovers || []).map((approver) => (
                            <span key={`${q.id}-${approver.approvalId || approver.approverRole || 'approver'}`} style={ui.badge.info}>
                              {approver.approverRole || approver.approverName || 'Pending approver'}
                            </span>
                          ))}
                          {legacy && (
                            <span title="Unsupported status; editing disabled." style={{ ...ui.badge.neutral, border: `1px dashed ${tokens.colors.border}` }}>LEGACY</span>
                          )}
                          {remind && (
                            <span style={{
                              ...ui.badge.warning,
                              color: tokens.colors.textPrimary,
                              border: `1px solid ${tokens.colors.warningDark}`
                            }}>REMIND</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ ...S.td, display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {(() => {
                      const legacy = isLegacyStatus(q.status || undefined);
                      const readOnly = legacy || q.status === 'accepted' || q.status === 'rejected';
                      const nextOptions = allowedTransitions(q.status || undefined);
                      const busy = updatingStatusId === q.id;
                      const actions = q.actionAvailability || {};
                      return (
                        <>
                          {actions.canRequestCommercialApproval && (
                            <button
                              onClick={() => requestCommercialApproval(q)}
                              style={{ ...S.btnGhost, color: tokens.colors.warningDark, fontWeight: 700 }}
                            >
                              Submit approval
                            </button>
                          )}
                          {actions.canCreateSalesOrder && (
                            <button
                              onClick={() => createSalesOrderFromQuotation(q)}
                              style={{ ...S.btnGhost, color: tokens.colors.success, fontWeight: 700 }}
                            >
                              Tạo SO
                            </button>
                          )}
                          {!readOnly && nextOptions.length > 0 && (
                            <select
                              style={{ ...S.select, padding: '6px 8px', fontSize: '11px' }}
                              onChange={(e: any) => {
                                const next = e.target.value;
                                if (next) updateStatus(q.id, q.status || 'draft', next);
                                e.target.value = '';
                              }}
                              disabled={busy}
                              defaultValue=""
                            >
                              <option value="" disabled>Đổi trạng thái</option>
                              {nextOptions.map(s => (
                                <option value={s}>{s.toUpperCase()}</option>
                              ))}
                            </select>
                          )}
                          <button onClick={() => handleEditQuote(q)} style={{ ...S.btnGhost, color: tokens.colors.info, fontWeight: 700 }}><EyeIcon size={14} /></button>
                          {userCanEdit && actions.canRevise !== false && (
                            <button onClick={() => handleCreateRevision(q)} style={{ ...S.btnGhost, color: tokens.colors.primary, fontWeight: 700 }}>R+</button>
                          )}
                          <button
                            onClick={() => downloadQuotationPdf(q.id, q.quoteNumber || undefined)}
                            disabled={downloadingPdfId === q.id}
                            style={{
                              border: `1px solid ${tokens.colors.primary}`,
                              color: tokens.colors.primary,
                              background: 'none',
                              padding: `5px ${tokens.spacing.md}`,
                              borderRadius: tokens.radius.md,
                              cursor: downloadingPdfId === q.id ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              fontWeight: 800,
                              opacity: downloadingPdfId === q.id ? 0.6 : 1
                            }}
                          >
                            {downloadingPdfId === q.id ? '...' : 'PDF'}
                          </button>
                          {userCanDelete && <button
                            onClick={() => { if (!readOnly && actions.canDelete !== false) deleteQuote(q.id); }}
                            disabled={readOnly || actions.canDelete === false}
                            style={{
                              ...S.btnGhost,
                              color: tokens.colors.error,
                              fontWeight: 700,
                              opacity: (readOnly || actions.canDelete === false) ? 0.5 : 1,
                              cursor: (readOnly || actions.canDelete === false) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <TrashIcon size={14} />
                          </button>}
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
