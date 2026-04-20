import { useEffect, useRef, useState } from 'preact/hooks';
import { API_BASE } from '../config';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { OverlayModal } from '../ui/OverlayModal';
import { showNotify } from '../Notification';
import { fetchWithAuth } from '../auth';
import { AssetListEditor } from './productAssetEditor';
import { normalizeImageAssets, normalizeVideoAssets, normalizeDocumentAssets } from './productAssetData';
import { DetailSection } from './productDetailSections';
import { ProductQbuWorkbookModal } from './ProductQbuWorkbookModal';
import {
  ProductModalTabRail,
  PRODUCT_MODAL_FLOATING_TAB_BREAKPOINT,
} from './ProductModalTabRail';
import {
  PRODUCT_FORM_FIELD_IDS,
  formatProductPricePreview,
  getProductFormDismissLabel,
  getProductFormSubmitLabel,
} from './productFormPresentation';
import { getProductMediaCollections } from './productMedia';
import { normalizeProductQbuWorkbook } from './productQbuWorkbook';

const API = API_BASE;
const API_ORIGIN = API.replace(/\/api\/?$/, '');

const UNITS = ['Chiếc', 'Bộ', 'Cái', 'Cặp', 'Hộp', 'Thùng', 'Kg', 'Gói'];
const CURRENCIES = ['USD', 'VND', 'EUR', 'JPY', 'CNY'];

const S = {
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnPrimaryDisabled: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease', opacity: 0.65, cursor: 'not-allowed' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  btnOutlineDisabled: { ...ui.btn.outline, transition: 'all 0.2s ease', opacity: 0.65, cursor: 'not-allowed' } as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '6px' } as any,
  requiredMarker: { color: tokens.colors.error, fontWeight: 800 } as any,
  tabBtn: (active: boolean) => ({
    padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? tokens.colors.primary : 'transparent',
    color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
    border: active ? 'none' : `1px solid ${tokens.colors.border}`,
    borderRadius: tokens.radius.lg,
    transition: 'all 0.2s ease',
  }) as any,
};

export type ProductFormTab = 'info' | 'assets' | 'qbu';

export type ProductFormState = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  basePrice: string | number;
  currency: string;
  technicalSpecs: string;
  qbuData?: Record<string, any>;
  productImages: any[];
  productVideos: any[];
  productDocuments: any[];
  [key: string]: any;
};

export function createEmptyProductForm(): ProductFormState {
  return {
    sku: '',
    name: '',
    category: '',
    unit: 'Chiếc',
    basePrice: '',
    currency: 'USD',
    technicalSpecs: '',
    productImages: [],
    productVideos: [],
    productDocuments: [],
  };
}

export function createProductFormFromProduct(product: any): ProductFormState {
  const mediaCollections = getProductMediaCollections(product);
  return {
    ...product,
    qbuData: product?.qbuData || {},
    productImages: normalizeImageAssets(mediaCollections.images),
    productVideos: normalizeVideoAssets(mediaCollections.videos),
    productDocuments: normalizeDocumentAssets(mediaCollections.documents),
  };
}

export function ProductFormModal({
  mode,
  product,
  initialTab,
  onClose,
  onSaved,
  token,
}: {
  mode: 'create' | 'edit';
  product?: any;
  initialTab?: ProductFormTab;
  onClose: () => void;
  onSaved: () => void;
  token: string;
}) {
  const [form, setForm] = useState<ProductFormState>(mode === 'edit' && product ? createProductFormFromProduct(product) : createEmptyProductForm());
  const [tab, setTab] = useState<ProductFormTab>(initialTab || 'info');
  const [saving, setSaving] = useState(false);
  const [showWorkbook, setShowWorkbook] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any>(mode === 'edit' ? product || null : null);
  const persistedProductId = activeProduct?.id || (mode === 'edit' ? product?.id : '');
  const hasPersistedProduct = Boolean(persistedProductId);
  const canConfigureQbu = mode === 'edit' || hasPersistedProduct;
  const modalTitle = mode === 'edit' || hasPersistedProduct ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm mới';

  useEffect(() => {
    setForm(mode === 'edit' && product ? createProductFormFromProduct(product) : createEmptyProductForm());
    setActiveProduct(mode === 'edit' ? product || null : null);
    setTab(initialTab || 'info');
    setShowWorkbook(false);
  }, [mode, product?.id, initialTab]);

  useEffect(() => {
    if (initialTab === 'qbu' && canConfigureQbu) {
      setShowWorkbook(true);
    }
  }, [initialTab, canConfigureQbu]);

  const submit = async () => {
    if (!form.sku || !form.name) return showNotify('Thiếu SKU hoặc Tên', 'error');
    setSaving(true);
    try {
      const payload = {
        ...form,
        productImages: normalizeImageAssets(form.productImages),
        productVideos: normalizeVideoAssets(form.productVideos),
        productDocuments: normalizeDocumentAssets(form.productDocuments),
      };
      const shouldUpdate = Boolean(persistedProductId);
      const res = await fetchWithAuth(token, shouldUpdate ? `${API}/products/${persistedProductId}` : `${API}/products`, {
        method: shouldUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Không thể lưu sản phẩm');
      setActiveProduct(result);
      setForm(createProductFormFromProduct(result));
      onSaved();
      if (!shouldUpdate) {
        setTab('assets');
        showNotify('Đã tạo sản phẩm. Có thể tiếp tục upload asset ngay trong cửa sổ này.', 'success');
        return;
      }
      showNotify(mode === 'edit' ? 'Đã cập nhật sản phẩm' : 'Đã lưu thay đổi sản phẩm', 'success');
      onClose();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể lưu sản phẩm', 'error');
    } finally {
      setSaving(false);
    }
  };

  const qbu = normalizeProductQbuWorkbook(form.qbuData || {});
  const totalQbu = qbu.totalAmount;
  const [isCompactForm, setIsCompactForm] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= PRODUCT_MODAL_FLOATING_TAB_BREAKPOINT : false));
  const [isStickyRailEnabled, setIsStickyRailEnabled] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > PRODUCT_MODAL_FLOATING_TAB_BREAKPOINT : true));
  const modalContentRef = useRef<HTMLDivElement | null>(null);
  const activePanelRef = useRef<HTMLDivElement | null>(null);
  const hasMountedTabRef = useRef(false);
  const modalContentPadding = isCompactForm ? '20px' : '24px';
  const pricePreview = formatProductPricePreview(form.basePrice);
  const hasSku = typeof form.sku === 'string' && form.sku.trim().length > 0;
  const hasName = typeof form.name === 'string' && form.name.trim().length > 0;
  const hasRequiredFields = hasSku && hasName;
  const activeStepIndex = tab === 'info' ? 1 : tab === 'assets' ? 2 : 3;
  const submitLabel = getProductFormSubmitLabel({ saving, hasPersistedProduct });
  const footerHint = tab === 'info'
    ? 'Kiểm tra lại SKU, tên và giá trước khi lưu.'
    : tab === 'assets'
      ? 'Asset đã upload trực tiếp sẽ được giữ trong cùng phiên chỉnh sửa.'
      : 'QBU dùng để tính chi phí đầu vào tham chiếu cho báo giá.';
  const shouldShowCreateFirstHint = !hasPersistedProduct && tab !== 'info';
  const shouldDisableQbuTab = !canConfigureQbu;
  const tabIdPrefix = mode === 'edit' && product?.id ? `product-form-${product.id}` : 'product-form-new';
  const infoTabId = `${tabIdPrefix}-tab-info`;
  const assetsTabId = `${tabIdPrefix}-tab-assets`;
  const qbuTabId = `${tabIdPrefix}-tab-qbu`;
  const infoPanelId = `${tabIdPrefix}-panel-info`;
  const assetsPanelId = `${tabIdPrefix}-panel-assets`;
  const qbuPanelId = `${tabIdPrefix}-panel-qbu`;
  const qbuLockReasonId = `${tabIdPrefix}-qbu-lock-reason`;
  const enabledTabs: Array<'info' | 'assets' | 'qbu'> = canConfigureQbu ? ['info', 'assets', 'qbu'] : ['info', 'assets'];
  const tabIdsByKey: Record<'info' | 'assets' | 'qbu', string> = {
    info: infoTabId,
    assets: assetsTabId,
    qbu: qbuTabId,
  };

  const moveToTab = (nextTab: 'info' | 'assets' | 'qbu') => {
    setTab(nextTab);
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(tabIdsByKey[nextTab]);
      if (target instanceof HTMLElement) target.focus();
    });
  };

  const handleTabKeyDown = (event: any, currentTab: 'info' | 'assets' | 'qbu') => {
    const key = event.key;
    if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
    event.preventDefault();
    const currentIndex = enabledTabs.indexOf(currentTab);
    if (currentIndex === -1) return;

    if (key === 'Home') return moveToTab(enabledTabs[0]);
    if (key === 'End') return moveToTab(enabledTabs[enabledTabs.length - 1]);

    if (key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % enabledTabs.length;
      return moveToTab(enabledTabs[nextIndex]);
    }

    const prevIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    return moveToTab(enabledTabs[prevIndex]);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsCompactForm(window.innerWidth <= PRODUCT_MODAL_FLOATING_TAB_BREAKPOINT);
      setIsStickyRailEnabled(window.innerWidth > PRODUCT_MODAL_FLOATING_TAB_BREAKPOINT);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!hasMountedTabRef.current) {
      hasMountedTabRef.current = true;
      return;
    }
    const scrollHost = modalContentRef.current?.parentElement;
    if (scrollHost instanceof HTMLElement) {
      scrollHost.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    activePanelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [tab]);

  return (
    <OverlayModal
      title={modalTitle}
      subtitle={mode === 'edit' ? 'Cập nhật hồ sơ sản phẩm theo cấu trúc gọn, rõ và sẵn sàng cho vận hành.' : 'Tạo hồ sơ sản phẩm mới với cấu trúc thông tin chuẩn cho sales và pricing.'}
      onClose={onClose}
      maxWidth="1040px"
      contentPadding={modalContentPadding}
    >
      <div ref={modalContentRef} style={{ display: 'grid', gap: '20px' }}>
        {showWorkbook ? (
          <ProductQbuWorkbookModal
            token={token}
            productName={form.name}
            basePrice={form.basePrice}
            currency={form.currency || 'USD'}
            initialQbuData={form.qbuData || {}}
            onClose={() => setShowWorkbook(false)}
            onSave={(nextQbuData) => {
              setForm((current) => ({ ...current, qbuData: nextQbuData }));
              setShowWorkbook(false);
              showNotify('Đã áp dụng workbook QBU vào form sản phẩm. Bấm lưu để persist xuống backend.', 'success');
            }}
          />
        ) : null}
        <ProductModalTabRail
          ariaLabel="Các bước cấu hình sản phẩm"
          tabs={[
            {
              key: 'info',
              label: '1. Thông tin chung',
              tabId: infoTabId,
              panelId: infoPanelId,
            },
            {
              key: 'assets',
              label: '2. Ảnh, Video & Tài liệu',
              tabId: assetsTabId,
              panelId: assetsPanelId,
            },
            canConfigureQbu
              ? {
                  key: 'qbu',
                  label: '3. Cấu hình QBU',
                  tabId: qbuTabId,
                  panelId: qbuPanelId,
                }
              : {
                  key: 'qbu',
                  label: '3. Cấu hình QBU',
                  tabId: qbuTabId,
                  panelId: qbuPanelId,
                  disabled: true,
                  describedBy: qbuLockReasonId,
                },
          ]}
          activeKey={tab}
          isStickyEnabled={isStickyRailEnabled}
          onSelect={(key) => setTab(key as ProductFormTab)}
          onKeyDown={(event, key) => handleTabKeyDown(event, key as ProductFormTab)}
        />

        <div
          style={{
            display: 'grid',
            gap: '10px',
          }}
        >
          {shouldDisableQbuTab ? (
            <div id={qbuLockReasonId} style={{ ...ui.form.help, color: tokens.colors.textMuted }}>
              Bước 3 bị khoá cho đến khi bạn lưu sản phẩm lần đầu.
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center', paddingBottom: '12px', borderBottom: `1px solid ${tokens.colors.border}` }}>
            <span style={ui.badge.info}>Bước {activeStepIndex}/3</span>
            <span style={{ ...ui.form.help, color: tokens.colors.textMuted }}>
              Trường bắt buộc: <span style={S.requiredMarker}>*</span> SKU, Tên sản phẩm
            </span>
          </div>
        </div>

        {shouldShowCreateFirstHint ? (
          <div style={{ ...ui.card.base, boxShadow: 'none', border: `1px dashed ${tokens.colors.warningBorder}`, background: tokens.colors.warningSurfaceBgSoft, padding: '12px 14px', display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.warningSurfaceText }}>
              Cần tạo sản phẩm trước khi tiếp tục bước này
            </div>
            <div style={{ ...ui.form.help, color: tokens.colors.textSecondary, lineHeight: 1.55 }}>
              Điền đủ <strong>SKU</strong> và <strong>Tên sản phẩm</strong>, sau đó bấm <strong>Tạo sản phẩm</strong>. Modal sẽ tự chuyển sang tab Asset để bạn upload ngay.
            </div>
          </div>
        ) : null}

        {!hasRequiredFields && tab === 'info' ? (
          <div style={{ ...ui.card.base, boxShadow: 'none', border: `1px dashed ${tokens.colors.warningBorder}`, background: tokens.colors.warningSurfaceBgSoft, padding: '12px 14px', display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.warningSurfaceText }}>
              Cần điền đủ trường bắt buộc trước khi lưu
            </div>
            <div style={{ ...ui.form.help, color: tokens.colors.textSecondary, lineHeight: 1.55 }}>
              SKU và Tên sản phẩm là bắt buộc để tạo hồ sơ và bật upload asset trực tiếp.
            </div>
          </div>
        ) : null}

        {tab === 'info' ? (
          <div ref={activePanelRef} role="tabpanel" id={infoPanelId} aria-labelledby={infoTabId} style={{ display: 'grid', gap: '16px' }}>
            <section style={{ ...ui.card.base, boxShadow: 'none', padding: isCompactForm ? '16px' : '18px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Thông tin nhận diện</div>
                <div style={{ ...ui.form.help, lineHeight: 1.6 }}>Nhập các trường cốt lõi để đội sales, pricing và master data tra cứu nhất quán.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px 20px' }}>
                <div style={{ gridColumn: '1/-1', minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.sku} style={S.label}>Mã SKU <span style={S.requiredMarker}>*</span></label>
                  <input id={PRODUCT_FORM_FIELD_IDS.sku} type="text" placeholder="Mã SKU (HT-xxx) *" style={{ ...S.input, borderColor: !hasSku ? tokens.colors.warningBorder : S.input.border }} value={form.sku} onInput={(e: any) => setForm({ ...form, sku: e.target.value })} />
                  <div style={ui.form.help}>Dùng mã duy nhất, ổn định theo quy ước nội bộ để tránh trùng khi import hoặc báo giá.</div>
                </div>
                <div style={{ gridColumn: '1/-1', minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.name} style={S.label}>Tên Sản phẩm <span style={S.requiredMarker}>*</span></label>
                  <input id={PRODUCT_FORM_FIELD_IDS.name} type="text" placeholder="Tên Sản phẩm *" style={{ ...S.input, borderColor: !hasName ? tokens.colors.warningBorder : S.input.border }} value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.category} style={S.label}>Danh mục</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.category} type="text" placeholder="Danh mục" style={S.input} value={form.category} onInput={(e: any) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.unit} style={S.label}>Đơn vị</label>
                  <select id={PRODUCT_FORM_FIELD_IDS.unit} style={S.input} value={form.unit} onChange={(e: any) => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </section>
            <section style={{ ...ui.card.base, boxShadow: 'none', padding: isCompactForm ? '16px' : '18px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Thông tin thương mại</div>
                <div style={{ ...ui.form.help, lineHeight: 1.6 }}>Giá tham chiếu dùng cho trao đổi ban đầu. Giá chính thức vẫn được xác nhận trong báo giá hoặc QBU.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px 20px' }}>
                <div style={{ minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.basePrice} style={S.label}>Giá bán tham chiếu</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.basePrice} type="number" placeholder="Giá bán tham chiếu" style={S.input} value={form.basePrice} onInput={(e: any) => setForm({ ...form, basePrice: e.target.value })} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={ui.form.help}>Nhập giá không gồm phân cách, hệ thống sẽ chuẩn hoá khi hiển thị.</span>
                    {pricePreview ? <span style={{ ...ui.badge.info, background: tokens.colors.surfaceSuccessSoft }}>Preview: {pricePreview}</span> : null}
                  </div>
                </div>
                <div style={{ minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label style={S.label}>Đơn vị tiền tệ</label>
                  <select style={S.input} value={form.currency || 'USD'} onChange={(e: any) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </section>
            <section style={{ ...ui.card.base, boxShadow: 'none', padding: isCompactForm ? '16px' : '18px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label htmlFor={PRODUCT_FORM_FIELD_IDS.technicalSpecs} style={{ ...S.label, marginBottom: 0 }}>Thông số kỹ thuật</label>
                <div style={{ ...ui.form.help, lineHeight: 1.6 }}>Nội dung này được dùng lại trong báo giá. Nên giữ cấu trúc theo từng dòng để sales có thể copy và đối chiếu nhanh.</div>
              </div>
              <textarea
                id={PRODUCT_FORM_FIELD_IDS.technicalSpecs}
                rows={isCompactForm ? 8 : 7}
                placeholder={"- Nhãn hiệu: SOCMA\n- Model: HNRS4531\n- Xuất xứ: Trung Quốc\n- Tình trạng: Mới 100%\n- Năm SX: 2025 trở về sau\n- Tải trọng: 45T, 31T, 16T\n- Chiều cao nâng: 15100mm"}
                style={{ ...S.input, fontFamily: 'var(--font-family-sans)', fontSize: '12.5px', resize: 'vertical', lineHeight: 1.7 }}
                value={form.technicalSpecs}
                onInput={(e: any) => setForm({ ...form, technicalSpecs: e.target.value })}
              />
              <div style={{ ...ui.form.help, display: 'grid', gap: '4px' }}>
                <span>Nên ưu tiên các dòng: nhãn hiệu, model, xuất xứ, tình trạng, năm sản xuất, tải trọng và kích thước chính.</span>
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'assets' ? (
          <div ref={activePanelRef} role="tabpanel" id={assetsPanelId} aria-labelledby={assetsTabId} style={{ display: 'grid', gap: '18px' }}>
            <section style={{ ...ui.card.base, background: tokens.surface.heroGradient, boxShadow: 'none', padding: '18px 18px 16px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <span style={{ ...ui.badge.info, background: tokens.colors.successTint }}>{form.productImages.length} ảnh</span>
                <span style={{ ...ui.badge.info, background: tokens.colors.infoAccentBg }}>{form.productVideos.length} video</span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>{form.productDocuments.length} tài liệu</span>
                <span style={{ ...ui.badge.neutral, background: tokens.colors.surfaceSubtle }}>
                  {hasPersistedProduct ? 'Upload trực tiếp khả dụng' : 'Tạo sản phẩm để bật upload trực tiếp'}
                </span>
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary, maxWidth: '72ch' }}>
                Dùng khu này để quản lý toàn bộ asset phục vụ bán hàng. Ảnh đại diện luôn được ghim ở vị trí đầu, gallery giữ thứ tự bạn sắp xếp, video được chuẩn hoá MP4 để share, còn tài liệu sẽ hiển thị theo danh sách hành động.
              </div>
              {!hasPersistedProduct ? (
                <div style={{ fontSize: '12px', lineHeight: 1.6, color: tokens.colors.textMuted }}>
                  Bước 1: lưu SKU và tên sản phẩm để tạo record. Sau đó modal sẽ giữ nguyên và mở tab asset để bạn tiếp tục upload trong cùng phiên.
                </div>
              ) : null}
            </section>
            <DetailSection title="Hình ảnh sản phẩm" subtitle="Thêm ảnh bằng URL hoặc upload trực tiếp để hiển thị trong hồ sơ chi tiết.">
              <AssetListEditor
                title="Kho ảnh"
                subtitle="Ảnh đầu tiên sẽ được dùng làm hero image ở phần chi tiết sản phẩm."
                items={form.productImages}
                kind="image"
                onItemsChange={(items) => setForm((current) => ({ ...current, productImages: normalizeImageAssets(items) }))}
                productId={persistedProductId}
                token={token}
                showNotify={showNotify}
                apiBase={API}
                apiOrigin={API_ORIGIN}
                outlineButtonStyle={S.btnOutline}
                primaryButtonStyle={S.btnPrimary}
                inputStyle={S.input}
                labelStyle={S.label}
              />
            </DetailSection>

            <DetailSection title="Video sản phẩm" subtitle="Upload video demo hoặc gắn URL để hồ sơ sản phẩm luôn có clip share-ready cho đối tác.">
              <AssetListEditor
                title="Kho video"
                subtitle="Video upload trực tiếp sẽ được trình duyệt chuẩn hoá về MP4 H.264/AAC trước khi gửi lên, ưu tiên clip share-ready tối đa 1080p."
                items={form.productVideos}
                kind="video"
                onItemsChange={(items) => setForm((current) => ({ ...current, productVideos: normalizeVideoAssets(items) }))}
                productId={persistedProductId}
                token={token}
                showNotify={showNotify}
                apiBase={API}
                apiOrigin={API_ORIGIN}
                outlineButtonStyle={S.btnOutline}
                primaryButtonStyle={S.btnPrimary}
                inputStyle={S.input}
                labelStyle={S.label}
              />
            </DetailSection>

            <DetailSection title="Tài liệu liên quan" subtitle="Quản lý brochure, catalogue, datasheet và file kỹ thuật liên quan đến sản phẩm.">
              <AssetListEditor
                title="Kho tài liệu"
                subtitle="Tài liệu sẽ xuất hiện theo dạng danh sách trong màn hình chi tiết sản phẩm."
                items={form.productDocuments}
                kind="document"
                onItemsChange={(items) => setForm((current) => ({ ...current, productDocuments: normalizeDocumentAssets(items) }))}
                productId={persistedProductId}
                token={token}
                showNotify={showNotify}
                apiBase={API}
                apiOrigin={API_ORIGIN}
                outlineButtonStyle={S.btnOutline}
                primaryButtonStyle={S.btnPrimary}
                inputStyle={S.input}
                labelStyle={S.label}
              />
            </DetailSection>
          </div>
        ) : null}

        {tab === 'qbu' && canConfigureQbu ? (
          <div ref={activePanelRef} role="tabpanel" id={qbuPanelId} aria-labelledby={qbuTabId} style={{ display: 'grid', gap: '16px' }}>
            <section style={{ ...ui.card.base, boxShadow: 'none', padding: isCompactForm ? '16px' : '18px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>QBU workbook summary</div>
                <div style={{ ...ui.form.help, lineHeight: 1.6 }}>
                  QBU đã được chuyển sang workbook riêng để hỗ trợ cost lines editable, incoterm suggestions và financial defaults. Tab này chỉ còn vai trò summary và entrypoint.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Incoterm</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>{qbu.incoterm}</div>
                </div>
                <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Basis currency</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>{qbu.basisCurrency}</div>
                </div>
                <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Số dòng cost</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>{qbu.lines.length}</div>
                </div>
                <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Tổng cost snapshot</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.primary, marginTop: '4px' }}>
                    {`${qbu.basisCurrency} ${totalQbu.toLocaleString()}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>VAT rate</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>{qbu.financialDefaults.vatRate}</div>
                </div>
                <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Loan days</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>{qbu.financialDefaults.loanInterestDays}</div>
                </div>
                <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>Loan rate</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>{qbu.financialDefaults.loanInterestRate}</div>
                </div>
                <div style={{ border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.md, padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>CIT rate</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: tokens.colors.textPrimary, marginTop: '4px' }}>{qbu.financialDefaults.citRate}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...ui.form.help, color: tokens.colors.textMuted }}>
                  Dùng workbook để chỉnh cost lines, incoterm và financial defaults. Các thay đổi sẽ được áp vào form hiện tại và persist khi anh bấm lưu sản phẩm.
                </span>
                <button type="button" onClick={() => setShowWorkbook(true)} style={S.btnPrimary}>
                  Mở workbook QBU
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <div
          style={{
            position: 'sticky',
            bottom: isCompactForm ? '-20px' : '-24px',
            zIndex: 1,
            borderTop: `1px solid ${tokens.colors.border}`,
            padding: isCompactForm ? '14px 20px 0' : '16px 24px 0',
            marginLeft: isCompactForm ? '-20px' : '-24px',
            marginRight: isCompactForm ? '-20px' : '-24px',
            marginBottom: isCompactForm ? '-20px' : '-24px',
            background: tokens.colors.surface,
            backdropFilter: `blur(${tokens.overlay.toastBlur})`,
            WebkitBackdropFilter: `blur(${tokens.overlay.toastBlur})`,
            display: 'grid',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted, lineHeight: 1.5 }}>
              {footerHint}
            </div>
            {saving ? <span style={ui.badge.info}>Đang lưu dữ liệu...</span> : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={onClose} disabled={saving} style={saving ? S.btnOutlineDisabled : S.btnOutline}>{getProductFormDismissLabel(mode)}</button>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {tab !== 'info' ? (
                <button type="button" onClick={() => setTab('info')} disabled={saving} style={saving ? S.btnOutlineDisabled : S.btnOutline}>
                  Quay lại Thông tin chung
                </button>
              ) : null}
              <button type="button" onClick={submit} disabled={saving} style={saving ? S.btnPrimaryDisabled : S.btnPrimary}>
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </OverlayModal>
  );
}

export function AddProductModal({ onClose, onSaved, token }: { onClose: () => void; onSaved: () => void; token: string }) {
  return <ProductFormModal mode="create" onClose={onClose} onSaved={onSaved} token={token} />;
}

export function EditProductModal({ product, initialTab, onClose, onSaved, token }: { product: any; initialTab?: ProductFormTab; onClose: () => void; onSaved: () => void; token: string }) {
  return <ProductFormModal mode="edit" product={product} onClose={onClose} onSaved={onSaved} token={token} initialTab={initialTab} />;
}
