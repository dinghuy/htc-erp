import { API_BASE } from './config';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { canEdit, canDelete, fetchWithAuth } from './auth';
import { OverlayModal } from './ui/OverlayModal';
import {
  EditIcon,
  ExportIcon,
  EyeIcon,
  ImportIcon,
  LoaderIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  SheetIcon,
  TrashIcon,
} from './ui/icons';

const API = API_BASE;
const FX_PAIR = 'USDVND';
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  thSortable: ui.table.thSortable as any,
  thStatic: ui.table.thStatic as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  kpiCard: ui.card.kpi as any,
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
    transition: 'all 0.2s ease'
  }) as any
};

const UNITS = ['Chiếc', 'Bộ', 'Cái', 'Cặp', 'Hộp', 'Thùng', 'Kg', 'Gói'];

type QbuWarning = {
  key: string;
  label: string;
  style: any;
};

function getVnCalendarParts(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  if (!year || !month || !day) return null;
  return { year, month, day };
}

function isOlderThanCalendarMonths(value: string | Date | null | undefined, months: number) {
  const current = getVnCalendarParts(new Date());
  const target = getVnCalendarParts(value);
  if (!current || !target) return false;

  const monthDiff = (current.year - target.year) * 12 + (current.month - target.month);
  if (monthDiff > months) return true;
  if (monthDiff < months) return false;
  return target.day <= current.day;
}

function hasQbuSnapshot(product: any) {
  const qbuData = product?.qbuData && typeof product.qbuData === 'object' && !Array.isArray(product.qbuData)
    ? product.qbuData
    : {};
  return Object.keys(qbuData).length > 0;
}

function getProductQbuWarnings(product: any, latestRate: number | null): QbuWarning[] {
  const warnings: QbuWarning[] = [];
  const qbuRateValue = Number(product?.qbuRateValue);
  const hasSnapshot = hasQbuSnapshot(product);

  if (latestRate != null && product?.qbuRateValue != null && qbuRateValue > 0 && latestRate >= qbuRateValue * 1.025) {
    warnings.push({ key: 'fx', label: 'FX +2.5%', style: ui.badge.warning });
  }

  if (isOlderThanCalendarMonths(product?.qbuUpdatedAt, 6)) {
    warnings.push({ key: 'stale', label: 'QBU 6M', style: ui.badge.warning });
  }

  if (hasSnapshot && (product?.qbuRateValue == null || product?.qbuRateDate == null)) {
    warnings.push({ key: 'snapshot', label: 'No FX', style: ui.badge.error });
  }

  return warnings;
}

function matchesQuery(value: unknown, needle: string) {
  if (!needle) return true;
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function QbuBadgeRow({ warnings }: { warnings: QbuWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
      {warnings.map((warning) => (
        <span
          key={warning.key}
          style={{
            ...warning.style,
            padding: '2px 8px',
            fontSize: '10px',
            lineHeight: 1.4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            border: `1px solid ${tokens.colors.border}`,
            whiteSpace: 'nowrap',
          }}
        >
          {warning.label}
        </span>
      ))}
    </div>
  );
}

function ProductDetailModal({ product, onClose, latestRate, latestRateWarnings }: any) {
  const [tab, setTab] = useState<'info'|'qbu'>('info');
  const qbu = product.qbuData || {};
  const totalQbu = (Number(qbu.exWorks)||0) + (Number(qbu.shipping)||0) + (Number(qbu.importTax)||0) + (Number(qbu.customFees)||0) + (Number(qbu.other)||0);
  const qbuWarnings = getProductQbuWarnings(product, latestRate);
  const showRateMissing = latestRateWarnings?.includes('RATE_MISSING');

  return (
    <OverlayModal title="Chi tiết Sản phẩm" onClose={onClose} maxWidth="480px">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '12px' }}>
        <button onClick={() => setTab('info')} style={S.tabBtn(tab === 'info')}>Thông tin chung</button>
        <button onClick={() => setTab('qbu')} style={S.tabBtn(tab === 'qbu')}>QBU (Giá vốn)</button>
      </div>

      {tab === 'info' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>SKU</label>
            <div style={{ fontSize: '16px', fontWeight: 800, color: tokens.colors.primary, marginTop: '4px' }}>{product.sku}</div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Tên Sản phẩm</label>
            <div style={{ fontSize: '16px', fontWeight: 700, color: tokens.colors.textPrimary, marginTop: '4px' }}>{product.name}</div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Danh mục</label>
            <div style={{ marginTop: '4px' }}><span style={{ background: tokens.colors.background, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted, border: `1px solid ${tokens.colors.border}` }}>{product.category || 'N/A'}</span></div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Đơn vị</label>
            <div style={{ fontSize: '14px', marginTop: '4px', fontWeight: 600, color: tokens.colors.textPrimary }}>{product.unit || 'Chiếc'}</div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Giá bán tham chiếu</label>
            <div style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.textPrimary, marginTop: '4px' }}>${product.basePrice?.toLocaleString()}</div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Thông số kỹ thuật</label>
            <pre style={{ marginTop: '8px', padding: '14px', background: tokens.colors.background, borderRadius: '10px', border: `1px solid ${tokens.colors.border}`, fontSize: '13px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
              {product.technicalSpecs || 'Chưa có thông số kỹ thuật.'}
            </pre>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(qbuWarnings.length > 0 || showRateMissing) && (
            <div style={{ padding: tokens.spacing.md, background: tokens.colors.badgeBgInfo, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.colors.border}` }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: qbuWarnings.length ? '8px' : 0 }}>
                {qbuWarnings.length > 0 && (
                  <span style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>Cảnh báo QBU</span>
                )}
                <QbuBadgeRow warnings={qbuWarnings} />
              </div>
              {showRateMissing && (
                <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.warning, marginTop: qbuWarnings.length ? '8px' : 0 }}>
                  Chưa có tỷ giá VCB
                </div>
              )}
            </div>
          )}
          <div style={{ background: tokens.colors.background, padding: '16px', borderRadius: '12px', border: `1px solid ${tokens.colors.border}` }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textMuted, marginBottom: '16px' }}>CẤU TRÚC GIÁ VỐN (QUOTE BUILD UP)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px' }}>Giá xuất xưởng (Ex-works):</span>
              <span style={{ fontWeight: 700 }}>${Number(qbu.exWorks || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px' }}>Phí vận tải (Shipping):</span>
              <span style={{ fontWeight: 700 }}>${Number(qbu.shipping || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px' }}>Thuế nhập khẩu:</span>
              <span style={{ fontWeight: 700 }}>${Number(qbu.importTax || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px' }}>Phí hải quan/bảo lãnh:</span>
              <span style={{ fontWeight: 700 }}>${Number(qbu.customFees || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '14px' }}>Chi phí khác:</span>
              <span style={{ fontWeight: 700 }}>${Number(qbu.other || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: `1px dashed ${tokens.colors.border}` }}>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>TỔNG GIÁ VỐN DỰ KIẾN:</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.primary }}>${totalQbu.toLocaleString()}</span>
            </div>
          </div>
          {product.qbuUpdatedAt && (
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted, textAlign: 'right' }}>
              Cập nhật lần cuối: {new Date(product.qbuUpdatedAt).toLocaleString('vi-VN')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        <button onClick={onClose} style={S.btnPrimary}>Đóng</button>
      </div>
    </OverlayModal>
  );
}

function AddProductModal({ onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ sku: '', name: '', category: '', unit: 'Chiếc', basePrice: '', technicalSpecs: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.sku || !form.name) return showNotify('Thiếu SKU hoặc Tên', 'error');
    setSaving(true);
    await fetchWithAuth(token, `${API}/products`, { method: 'POST', body: JSON.stringify(form) });
    onSaved(); onClose();
  };
  return (
    <OverlayModal title="Thêm Sản phẩm mới" onClose={onClose} maxWidth="480px">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        <div style={{ gridColumn: '1/-1', minWidth: 0 }}>
          <label style={S.label}>Mã SKU *</label>
          <input type="text" placeholder="Mã SKU (HT-xxx) *" style={S.input} value={form.sku} onInput={(e:any)=>setForm({...form, sku: e.target.value})} />
        </div>
        <div style={{ gridColumn: '1/-1', minWidth: 0 }}>
          <label style={S.label}>Tên Sản phẩm *</label>
          <input type="text" placeholder="Tên Sản phẩm *" style={S.input} value={form.name} onInput={(e:any)=>setForm({...form, name: e.target.value})} />
        </div>
        <div style={{ gridColumn: 'span 1', minWidth: 0 }}>
          <label style={S.label}>Danh mục</label>
          <input type="text" placeholder="Danh mục" style={S.input} value={form.category} onInput={(e:any)=>setForm({...form, category: e.target.value})} />
        </div>
        <div style={{ gridColumn: 'span 1', minWidth: 0 }}>
          <label style={S.label}>Đơn vị</label>
          <select style={S.input} value={form.unit} onChange={(e:any)=>setForm({...form, unit: e.target.value})}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1/-1', minWidth: 0 }}>
          <label style={S.label}>Giá bán tham chiếu (USD)</label>
          <input type="number" placeholder="Giá bán tham chiếu (USD)" style={S.input} value={form.basePrice} onInput={(e:any)=>setForm({...form, basePrice: e.target.value})} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' as any, color: tokens.colors.textMuted, display: 'block', marginBottom: '6px' }}>
             Thông số kỹ thuật (Tự động điền vào Báo giá)
          </label>
          <textarea rows={7} placeholder={"- Nhãn hiệu: SOCMA\n- Model: HNRS4531\n- Xuất xứ: Trung Quốc\n- Tình trạng: Mới 100%\n- Năm SX: 2025 trở về sau\n- Tải trọng: 45T, 31T, 16T\n- Chiều cao nâng: 15100mm"} 
            style={{ ...S.input, fontFamily: 'monospace', fontSize: '12.5px', resize: 'vertical' }}
            value={form.technicalSpecs} onInput={(e:any)=>setForm({...form, technicalSpecs: e.target.value})} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        <button onClick={onClose} style={S.btnOutline}>Đóng</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Sản phẩm'}</button>
      </div>
    </OverlayModal>
  );
}

function EditProductModal({ product, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ ...product, qbuData: product.qbuData || {} });
  const [tab, setTab] = useState<'info'|'qbu'>('info');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.sku || !form.name) return showNotify('Thiếu SKU hoặc Tên', 'error');
    setSaving(true);
    await fetchWithAuth(token, `${API}/products/${product.id}`, { method: 'PUT', body: JSON.stringify(form) });
    onSaved(); onClose();
  };

  const handleQbuChange = (field: string, val: string) => {
    setForm({ ...form, qbuData: { ...form.qbuData, [field]: Number(val) || 0 } });
  };

  const qbu = form.qbuData;
  const totalQbu = (Number(qbu.exWorks)||0) + (Number(qbu.shipping)||0) + (Number(qbu.importTax)||0) + (Number(qbu.customFees)||0) + (Number(qbu.other)||0);

  return (
    <OverlayModal title="Chỉnh sửa Sản phẩm" onClose={onClose} maxWidth="480px">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '12px' }}>
        <button onClick={() => setTab('info')} style={S.tabBtn(tab === 'info')}>Thông tin chung</button>
        <button onClick={() => setTab('qbu')} style={S.tabBtn(tab === 'qbu')}>Cấu hình QBU (Giá vốn)</button>
      </div>

      {tab === 'info' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
          <div style={{ gridColumn: '1/-1', minWidth: 0 }}>
            <label style={S.label}>Mã SKU *</label>
            <input type="text" style={S.input} value={form.sku} onInput={(e:any)=>setForm({...form, sku: e.target.value})} />
          </div>
          <div style={{ gridColumn: '1/-1', minWidth: 0 }}>
            <label style={S.label}>Tên Sản phẩm *</label>
            <input type="text" style={S.input} value={form.name} onInput={(e:any)=>setForm({...form, name: e.target.value})} />
          </div>
          <div style={{ gridColumn: 'span 1', minWidth: 0 }}>
            <label style={S.label}>Danh mục</label>
            <input type="text" style={S.input} value={form.category} onInput={(e:any)=>setForm({...form, category: e.target.value})} />
          </div>
          <div style={{ gridColumn: 'span 1', minWidth: 0 }}>
            <label style={S.label}>Đơn vị</label>
            <select style={S.input} value={form.unit} onChange={(e:any)=>setForm({...form, unit: e.target.value})}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1', minWidth: 0 }}>
            <label style={S.label}>Giá bán USD</label>
            <input type="number" style={S.input} value={form.basePrice} onInput={(e:any)=>setForm({...form, basePrice: e.target.value})} />
          </div>
          <div style={{ gridColumn: '1/-1', minWidth: 0 }}>
            <label style={S.label}>Thông số kỹ thuật</label>
            <textarea rows={7} style={{ ...S.input, fontFamily: 'monospace', fontSize: '12.5px', resize: 'vertical' }}
              value={form.technicalSpecs} onInput={(e:any)=>setForm({...form, technicalSpecs: e.target.value})} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
          <div style={{ gridColumn: '1/-1', padding: tokens.spacing.md, background: tokens.colors.badgeBgInfo, borderRadius: tokens.radius.md, color: tokens.colors.info, fontSize: '13px', fontWeight: 600, border: `1px solid ${tokens.colors.border}`, marginBottom: tokens.spacing.sm }}>
            ℹ️ QBU (Quote Build Up) là cơ sở dữ liệu để tính toán lợi nhuận khi tạo báo giá. Nhập các chi phí đầu vào dự kiến cho sản phẩm này (theo USD).
          </div>
          
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Giá xuất xưởng (Ex-works) USD</label>
            <input type="number" style={S.input} value={qbu.exWorks || ''} onInput={(e:any)=>handleQbuChange('exWorks', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Phí vận tải (Shipping) USD</label>
            <input type="number" style={S.input} value={qbu.shipping || ''} onInput={(e:any)=>handleQbuChange('shipping', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Thuế nhập khẩu USD</label>
            <input type="number" style={S.input} value={qbu.importTax || ''} onInput={(e:any)=>handleQbuChange('importTax', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Phí HQ / Bảo lãnh USD</label>
            <input type="number" style={S.input} value={qbu.customFees || ''} onInput={(e:any)=>handleQbuChange('customFees', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Chi phí khác USD</label>
            <input type="number" style={S.input} value={qbu.other || ''} onInput={(e:any)=>handleQbuChange('other', e.target.value)} />
          </div>

          <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: `1px dashed ${tokens.colors.border}`, background: tokens.colors.background, padding: '16px', borderRadius: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 800 }}>TỔNG CHÍ PHÍ (COGS):</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: tokens.colors.primary }}>${totalQbu.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '16px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Thay đổi'}</button>
      </div>
    </OverlayModal>
  );
}


function useSortableData(items: any[]) {
  const [sortConfig, setSortConfig] = useState<any>(null);
  const [filters, setFilters] = useState<any>({});
  const filteredItems = useMemo(() => {
    let result = [...items];
    Object.keys(filters).forEach(k => { if (filters[k]) result = result.filter(i => String(i[k]||'').toLowerCase().includes(filters[k].toLowerCase())); });
    if (sortConfig) result.sort((a,b) => {
      const vA = (a[sortConfig.key]||'').toString().toLowerCase();
      const vB = (b[sortConfig.key]||'').toString().toLowerCase();
      if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (vA > vB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [items, sortConfig, filters]);
  return { items: filteredItems, requestSort: (key: string) => {
    let dir = 'asc'; if (sortConfig?.key === key && sortConfig.direction === 'asc') dir = 'desc';
    setSortConfig({ key, direction: dir });
  }, sortConfig, filters, setFilters };
}

export function Products({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: any } = {}) {
  const token = currentUser?.token ?? '';
  const userCanEdit = currentUser ? canEdit(currentUser.roleCodes, currentUser.systemRole) : false;
  const userCanDelete = currentUser ? canDelete(currentUser.roleCodes, currentUser.systemRole) : false;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [latestRate, setLatestRate] = useState<number | null>(null);
  const [latestRateWarnings, setLatestRateWarnings] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(products.map((product) => String(product.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [products]);

  const primaryFilteredProducts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return products.filter((product: any) => {
      if (categoryFilter && String(product.category || '') !== categoryFilter) return false;
      if (!needle) return true;
      return (
        matchesQuery(product.sku, needle) ||
        matchesQuery(product.name, needle) ||
        matchesQuery(product.category, needle) ||
        matchesQuery(product.unit, needle) ||
        matchesQuery(product.basePrice, needle)
      );
    });
  }, [products, searchTerm, categoryFilter]);

  const data = useSortableData(primaryFilteredProducts);
  const hasFilters = !!(searchTerm.trim() || categoryFilter || Object.values(data.filters || {}).some(Boolean));

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API}/products`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (!Array.isArray(payload)) {
        setProducts([]);
        setLoadError('Không tải được catalog sản phẩm. Bạn vẫn có thể mở màn hình này, nhưng dữ liệu đang tạm thời rỗng.');
        return;
      }
      setProducts(payload);
    } catch {
      setProducts([]);
      setLoadError('Không tải được catalog sản phẩm. Vui lòng thử lại sau hoặc kiểm tra dữ liệu backend.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    let active = true;
    const loadLatestRate = async () => {
      try {
        const res = await fetch(`${API}/exchange-rates/latest?pair=${FX_PAIR}`);
        const payload = await res.json();
        if (!active) return;
        setLatestRate(payload?.rate ?? null);
        setLatestRateWarnings(Array.isArray(payload?.warnings) ? payload.warnings : []);
      } catch {
        if (!active) return;
        setLatestRate(null);
        setLatestRateWarnings([]);
      }
    };

    loadLatestRate();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = products.length;
    const categories = new Set(products.map(p => p.category)).size;
    const avgPrice = total > 0 ? products.reduce((acc, p) => acc + (p.basePrice || 0), 0) / total : 0;
    return { total, categories, avgPrice };
  }, [products]);

  const handleImport = async (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    setLoading(true);
    const res = await fetchWithAuth(token, `${API}/products/import`, { method: 'POST', body: formData });
    const result = await res.json();
    showNotify(`Đã nhập: ${result.inserted} sản phẩm mới.`, 'success'); loadData();
  };

  const exportCSV = () => window.open(`${API}/products/export`, '_blank');

  const deleteProduct = async (id: string) => {
    if (window.confirm('Xóa sản phẩm này?')) {
      await fetchWithAuth(token, `${API}/products/${id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter((p: any) => p.id !== id));
    }
  };

  const cols = [ { k: 'sku', l: 'SKU' }, { k: 'name', l: 'Sản phẩm' }, { k: 'category', l: 'Danh mục' }, { k: 'basePrice', l: 'Giá bán ($)' } ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {showAdd && <AddProductModal onClose={()=>setShowAdd(false)} onSaved={loadData} token={token} />}
      {editingProduct && <EditProductModal product={editingProduct} onClose={()=>setEditingProduct(null)} onSaved={loadData} token={token} />}
      {selectedProduct && <ProductDetailModal product={selectedProduct} latestRate={latestRate} latestRateWarnings={latestRateWarnings} onClose={()=>setSelectedProduct(null)} />}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} accept=".csv" />

      {/* Mini Dashboard */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={S.kpiCard}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Danh mục Sản phẩm</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.total}</span>
        </div>
        <div style={{...S.kpiCard, borderLeft: `4px solid ${tokens.colors.warningDark}`}}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.warningDark, textTransform: 'uppercase' }}>Số phân mục</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.categories}</span>
        </div>
        <div style={{...S.kpiCard, borderLeft: `4px solid ${tokens.colors.success}`}}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.success, textTransform: 'uppercase' }}>Giá tham chiếu trung bình</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>${Math.round(stats.avgPrice).toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary, margin: 0, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <PackageIcon size={22} />
            Danh mục Sản phẩm
          </h2>
          <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '6px 0 0' }}>Bảng giá tham chiếu và quản lý mã SKU</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', ...(isMobile ? { overflowX: 'auto', maxWidth: '100%', flexWrap: 'nowrap', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' } : {}) }}>
           <button style={S.btnOutline} onClick={() => window.open(`${API}/template/products`)}><SheetIcon size={14} /> Mẫu CSV</button>
           {userCanEdit && <button style={S.btnOutline} onClick={() => fileInputRef.current?.click()}><ImportIcon size={14} /> Nhập CSV</button>}
           <button style={S.btnOutline} onClick={exportCSV}><ExportIcon size={14} /> Xuất CSV</button>
           {userCanEdit && <button style={S.btnPrimary} onClick={()=>setShowAdd(true)}><PlusIcon size={14} /> Thêm mới Sản phẩm</button>}
         </div>
      </div>

      <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '12px', border: `1px solid ${tokens.colors.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '280px', flex: isMobile ? '1 1 100%' : '1 1 280px' }}>
              <SearchIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                type="text"
                placeholder="Tìm theo SKU, tên, danh mục..."
                value={searchTerm}
                onInput={(e: any) => setSearchTerm(e.target.value)}
                style={{ ...ui.input.base, padding: '9px 12px 9px 36px', fontSize: '13.5px', width: '100%', minWidth: 0 }}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e: any) => setCategoryFilter(e.target.value)}
              style={{ ...ui.input.base, minWidth: isMobile ? '100%' : '220px' }}
            >
              <option value="">Tất cả danh mục</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowAdvancedFilters((prev) => !prev)} style={S.btnOutline}>
              {showAdvancedFilters ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao'}
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('');
                  data.setFilters({});
                }}
                style={S.btnOutline}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>
        {showAdvancedFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            {[
              { key: 'sku', label: 'SKU' },
              { key: 'unit', label: 'Đơn vị' },
              { key: 'basePrice', label: 'Giá bán ($)' },
            ].map((field) => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{field.label}</label>
                <input
                  type="text"
                  placeholder={`Lọc ${field.label.toLowerCase()}`}
                  value={data.filters[field.key] || ''}
                  onInput={(e: any) => data.setFilters({ ...data.filters, [field.key]: e.target.value })}
                  style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {loadError ? (
        <div style={{ ...S.card, border: `1px solid ${tokens.colors.warning}`, background: tokens.colors.badgeBgInfo, color: tokens.colors.textSecondary }}>
          {loadError}
        </div>
      ) : null}

      <div style={{ ...S.card, overflow: 'hidden', border: `1px solid ${tokens.colors.border}` }}>
        {loading ? <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><LoaderIcon size={16} /> Đang tải dữ liệu...</div> : (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                {data.items.map((p: any) => (
                  <div key={p.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{p.name}</div>
                      <span style={{ background: tokens.colors.background, padding: '2px 8px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, fontSize: '10px', fontWeight: 800, color: tokens.colors.textMuted }}>{p.sku}</span>
                    </div>
                    <QbuBadgeRow warnings={getProductQbuWarnings(p, latestRate)} />
                    <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Danh mục:</strong> {p.category || '-'}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Giá:</strong> ${p.basePrice?.toLocaleString() || '-'}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Đơn vị:</strong> {p.unit || '-'}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border}` }}>
                      <button onClick={() => setSelectedProduct(p)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EyeIcon size={14} /></button>
                      {userCanEdit && <button onClick={() => setEditingProduct(p)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EditIcon size={14} /></button>}
                      {userCanDelete && <button onClick={() => deleteProduct(p.id)} style={{ ...ui.btn.danger, padding: '6px 10px' }}><TrashIcon size={14} /></button>}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: tokens.colors.background }}>
                  {cols.map(c => (
                    <th key={c.k} style={S.thSortable} onClick={() => data.requestSort(c.k)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{c.l} {data.sortConfig?.key === c.k ? (data.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                  ))}
                  <th style={{ ...S.thStatic, cursor: 'default', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p: any) => (
                  <tr key={p.id} style={{ ...ui.table.row }} onMouseEnter={(e: any) => e.currentTarget.style.background = tokens.colors.background} onMouseLeave={(e: any) => e.currentTarget.style.background = ''}>
                    <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.primary, verticalAlign: 'top' }}>{p.sku}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: tokens.colors.textPrimary, verticalAlign: 'top' }}>
                      <div>{p.name}</div>
                      <QbuBadgeRow warnings={getProductQbuWarnings(p, latestRate)} />
                    </td>
                    <td style={S.td}><span style={{ background: tokens.colors.background, padding: '3px 10px', borderRadius: '6px', border: `1px solid ${tokens.colors.border}`, fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>{p.category}</span></td>
                    <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>${p.basePrice?.toLocaleString()}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button 
                          onClick={() => setSelectedProduct(p)}
                          style={{ color: tokens.colors.info, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                        >
                          <EyeIcon size={14} />
                        </button>
                        {userCanEdit && <button
                          onClick={() => setEditingProduct(p)}
                          style={{ color: tokens.colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                        >
                          <EditIcon size={14} />
                        </button>}
                        {userCanDelete && <button
                          onClick={() => deleteProduct(p.id)}
                          style={{ color: tokens.colors.error, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                        >
                          <TrashIcon size={14} />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
