import { useState, useEffect } from 'preact/hooks';
import { API_BASE } from '../config';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { OverlayModal } from '../ui/OverlayModal';
import { showNotify } from '../Notification';
import { fetchWithAuth } from '../auth';
import { AssetListEditor } from './productAssetEditor';
import { normalizeImageAssets, normalizeVideoAssets, normalizeDocumentAssets } from './productAssetData';
import { DetailSection } from './productDetailSections';
import {
  PRODUCT_FORM_FIELD_IDS,
  formatProductPricePreview,
  getProductFormDismissLabel,
  getProductFormSubmitLabel,
} from './productFormPresentation';
import { getProductMediaCollections } from './productMedia';

const API = API_BASE;
const API_ORIGIN = API.replace(/\/api\/?$/, '');

const UNITS = ['Chiếc', 'Bộ', 'Cái', 'Cặp', 'Hộp', 'Thùng', 'Kg', 'Gói'];

const S = {
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '6px' } as any,
  tabBtn: (active: boolean) => ({
    padding: `${tokens.spacing.md} ${tokens.spacing.xl}`,
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    background: active ? tokens.colors.primary : 'transparent',
    color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
    border: 'none',
    borderRadius: tokens.radius.lg,
    transition: 'all 0.2s ease',
  }) as any,
};

export type ProductFormState = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  basePrice: string | number;
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
  onClose,
  onSaved,
  token,
}: {
  mode: 'create' | 'edit';
  product?: any;
  onClose: () => void;
  onSaved: () => void;
  token: string;
}) {
  const [form, setForm] = useState<ProductFormState>(mode === 'edit' && product ? createProductFormFromProduct(product) : createEmptyProductForm());
  const [tab, setTab] = useState<'info' | 'assets' | 'qbu'>('info');
  const [saving, setSaving] = useState(false);
  const [activeProduct, setActiveProduct] = useState<any>(mode === 'edit' ? product || null : null);
  const persistedProductId = activeProduct?.id || (mode === 'edit' ? product?.id : '');
  const hasPersistedProduct = Boolean(persistedProductId);
  const canConfigureQbu = mode === 'edit' || hasPersistedProduct;
  const modalTitle = mode === 'edit' || hasPersistedProduct ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm mới';

  useEffect(() => {
    setForm(mode === 'edit' && product ? createProductFormFromProduct(product) : createEmptyProductForm());
    setActiveProduct(mode === 'edit' ? product || null : null);
    setTab('info');
  }, [mode, product?.id]);

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

  const handleQbuChange = (field: string, val: string) => {
    setForm((current) => ({ ...current, qbuData: { ...(current.qbuData || {}), [field]: Number(val) || 0 } }));
  };

  const qbu = form.qbuData || {};
  const totalQbu = (Number(qbu.exWorks) || 0) + (Number(qbu.shipping) || 0) + (Number(qbu.importTax) || 0) + (Number(qbu.customFees) || 0) + (Number(qbu.other) || 0);
  const [isCompactForm, setIsCompactForm] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 720 : false));
  const modalContentPadding = isCompactForm ? '20px' : '24px';
  const pricePreview = formatProductPricePreview(form.basePrice);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsCompactForm(window.innerWidth <= 720);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <OverlayModal
      title={modalTitle}
      subtitle={mode === 'edit' ? 'Cập nhật hồ sơ sản phẩm theo cấu trúc gọn, rõ và sẵn sàng cho vận hành.' : 'Tạo hồ sơ sản phẩm mới với cấu trúc thông tin chuẩn cho sales và pricing.'}
      onClose={onClose}
      maxWidth="1040px"
      contentPadding={modalContentPadding}
    >
      <div style={{ display: 'grid', gap: '20px' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: `1px solid ${tokens.colors.border}`,
            paddingBottom: '12px',
            overflowX: isCompactForm ? 'auto' : 'visible',
            flexWrap: isCompactForm ? 'nowrap' : 'wrap',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          <button onClick={() => setTab('info')} style={{ ...S.tabBtn(tab === 'info'), whiteSpace: 'nowrap', padding: isCompactForm ? '10px 14px' : S.tabBtn(tab === 'info').padding }}>Thông tin chung</button>
          <button onClick={() => setTab('assets')} style={{ ...S.tabBtn(tab === 'assets'), whiteSpace: 'nowrap', padding: isCompactForm ? '10px 14px' : S.tabBtn(tab === 'assets').padding }}>Ảnh, Video & Tài liệu</button>
          {canConfigureQbu ? <button onClick={() => setTab('qbu')} style={{ ...S.tabBtn(tab === 'qbu'), whiteSpace: 'nowrap', padding: isCompactForm ? '10px 14px' : S.tabBtn(tab === 'qbu').padding }}>Cấu hình QBU</button> : null}
        </div>

        {tab === 'info' ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            <section style={{ ...ui.card.base, boxShadow: 'none', padding: isCompactForm ? '16px' : '18px', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Thông tin nhận diện</div>
                <div style={{ ...ui.form.help, lineHeight: 1.6 }}>Nhập các trường cốt lõi để đội sales, pricing và master data tra cứu nhất quán.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px 20px' }}>
                <div style={{ gridColumn: '1/-1', minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.sku} style={S.label}>Mã SKU *</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.sku} type="text" placeholder="Mã SKU (HT-xxx) *" style={S.input} value={form.sku} onInput={(e: any) => setForm({ ...form, sku: e.target.value })} />
                  <div style={ui.form.help}>Dùng mã duy nhất, ổn định theo quy ước nội bộ để tránh trùng khi import hoặc báo giá.</div>
                </div>
                <div style={{ gridColumn: '1/-1', minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.name} style={S.label}>Tên Sản phẩm *</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.name} type="text" placeholder="Tên Sản phẩm *" style={S.input} value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} />
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
                <div style={{ gridColumn: '1/-1', minWidth: 0, display: 'grid', gap: '6px' }}>
                  <label htmlFor={PRODUCT_FORM_FIELD_IDS.basePrice} style={S.label}>Giá bán tham chiếu (USD)</label>
                  <input id={PRODUCT_FORM_FIELD_IDS.basePrice} type="number" placeholder="Giá bán tham chiếu (USD)" style={S.input} value={form.basePrice} onInput={(e: any) => setForm({ ...form, basePrice: e.target.value })} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={ui.form.help}>Nhập giá không gồm phân cách, hệ thống sẽ chuẩn hoá khi hiển thị.</span>
                    {pricePreview ? <span style={{ ...ui.badge.info, background: tokens.colors.surfaceSuccessSoft }}>Preview: {pricePreview}</span> : null}
                  </div>
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
          <div style={{ display: 'grid', gap: '18px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div style={{ gridColumn: '1/-1', padding: tokens.spacing.md, background: tokens.colors.badgeBgInfo, borderRadius: tokens.radius.md, color: tokens.colors.info, fontSize: '13px', fontWeight: 600, border: `1px solid ${tokens.colors.border}`, marginBottom: tokens.spacing.sm }}>
              QBU (Quote Build Up) là cơ sở dữ liệu để tính toán lợi nhuận khi tạo báo giá. Nhập các chi phí đầu vào dự kiến cho sản phẩm này (USD).
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={S.label}>Giá xuất xưởng (Ex-works) USD</label>
              <input type="number" style={S.input} value={qbu.exWorks || ''} onInput={(e: any) => handleQbuChange('exWorks', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Phí vận tải (Shipping) USD</label>
              <input type="number" style={S.input} value={qbu.shipping || ''} onInput={(e: any) => handleQbuChange('shipping', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Thuế nhập khẩu USD</label>
              <input type="number" style={S.input} value={qbu.importTax || ''} onInput={(e: any) => handleQbuChange('importTax', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Phí HQ / Bảo lãnh USD</label>
              <input type="number" style={S.input} value={qbu.customFees || ''} onInput={(e: any) => handleQbuChange('customFees', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Chi phí khác USD</label>
              <input type="number" style={S.input} value={qbu.other || ''} onInput={(e: any) => handleQbuChange('other', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: `1px dashed ${tokens.colors.border}`, background: tokens.colors.background, padding: '16px', borderRadius: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>TỔNG CHÍ PHÍ (COGS):</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.primary }}>${totalQbu.toLocaleString()}</span>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginTop: '4px',
            justifyContent: 'flex-end',
            alignItems: 'center',
            borderTop: `1px solid ${tokens.colors.border}`,
            padding: isCompactForm ? '14px 20px 0' : '16px 24px 0',
            marginLeft: isCompactForm ? '-20px' : '-24px',
            marginRight: isCompactForm ? '-20px' : '-24px',
            marginBottom: isCompactForm ? '-20px' : '-24px',
            position: 'sticky',
            bottom: isCompactForm ? '-20px' : '-24px',
            background: `${tokens.colors.surface}`,
            backdropFilter: `blur(${tokens.overlay.toastBlur})`,
            WebkitBackdropFilter: `blur(${tokens.overlay.toastBlur})`,
            flexWrap: isCompactForm ? 'wrap-reverse' : 'nowrap',
          }}
        >
          <div style={{ marginRight: 'auto', fontSize: '12px', color: tokens.colors.textMuted, lineHeight: 1.5 }}>
            {tab === 'info' ? 'Kiểm tra lại SKU, tên và giá trước khi lưu.' : tab === 'assets' ? 'Asset đã upload trực tiếp sẽ được giữ trong cùng phiên chỉnh sửa.' : 'QBU dùng để tính chi phí đầu vào tham chiếu cho báo giá.'}
          </div>
          <button onClick={onClose} style={S.btnOutline}>{getProductFormDismissLabel(mode)}</button>
          <button onClick={submit} style={S.btnPrimary}>
            {getProductFormSubmitLabel({ saving, hasPersistedProduct })}
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}

export function AddProductModal({ onClose, onSaved, token }: { onClose: () => void; onSaved: () => void; token: string }) {
  return <ProductFormModal mode="create" onClose={onClose} onSaved={onSaved} token={token} />;
}

export function EditProductModal({ product, onClose, onSaved, token }: { product: any; onClose: () => void; onSaved: () => void; token: string }) {
  return <ProductFormModal mode="edit" product={product} onClose={onClose} onSaved={onSaved} token={token} />;
}
