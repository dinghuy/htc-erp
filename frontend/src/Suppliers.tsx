import { API_BASE } from './config';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { canEdit, canDelete, fetchWithAuth } from './auth';
import { useI18n } from './i18n';
import { normalizeImportReport, buildImportSummary } from './shared/imports/importReport';
import { buildTabularFileUrl } from './shared/imports/tabularFiles';
import { FormatActionButton } from './ui/FormatActionButton';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { OverlayModal } from './ui/OverlayModal';
import { EditIcon, ExportIcon, EyeIcon, HandshakeIcon, ImportIcon, SearchIcon, TrashIcon } from './ui/icons';
import { SegmentedControl } from './ui/SegmentedControl';

const API = API_BASE;

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  thSortable: ui.table.thSortable as any,
  thStatic: ui.table.thStatic as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  label: { ...ui.form.label, display: 'block', marginBottom: '8px' } as any,
};

function parseProductTags(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,;\n|]+/g);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

function normalizeSupplier(supplier: any) {
  const productTags = parseProductTags(supplier?.productTags ?? supplier?.tag);
  return { ...supplier, productTags, tag: productTags.join(', ') };
}

function matchesQuery(value: unknown, needle: string) {
  if (!needle) return true;
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function TagChips({ tags, activeTag, onTagClick }: { tags: string[]; activeTag?: string; onTagClick?: (tag: string) => void }) {
  if (!tags?.length) {
    return <span style={{ color: tokens.colors.textMuted }}>N/A</span>;
  }
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {tags.map(tag => {
        const active = activeTag === tag;
        return onTagClick ? (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            style={{
              ...ui.badge.info,
              border: `1px solid ${active ? tokens.colors.primary : tokens.colors.border}`,
              background: active ? tokens.colors.primary : tokens.colors.surface,
              color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
              cursor: 'pointer'
            }}
          >
            {tag}
          </button>
        ) : (
          <span key={tag} style={{ ...ui.badge.info, border: `1px solid ${tokens.colors.border}` }}>{tag}</span>
        );
      })}
    </div>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <OverlayModal title={title} onClose={onClose} maxWidth="560px" contentPadding="28px">
      {children}
    </OverlayModal>
  );
}

function SupplierDetailsModal({ supplier, onClose, onEdit, onDelete, canEditSupplier, canDeleteSupplier }: any) {
  if (!supplier) return null;
  return (
    <Modal title="Chi tiết Nhà cung cấp" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>{supplier.companyName || supplier.company || '—'}</div>
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={ui.badge.info}>Mã: {supplier.code || '—'}</span>
            <span style={ui.badge.neutral}>Quốc gia: {supplier.country || '—'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div>
            <label style={S.label}>Mã nhà cung cấp</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{supplier.code || '—'}</div>
          </div>
          <div>
            <label style={S.label}>Quốc gia</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{supplier.country || '—'}</div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Tag sản phẩm</label>
            <TagChips tags={supplier.productTags} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}>
        <button onClick={onClose} style={S.btnOutline}>Đóng</button>
        {canEditSupplier && <button onClick={onEdit} style={S.btnPrimary}>Chỉnh sửa</button>}
        {canDeleteSupplier && <button onClick={onDelete} style={ui.btn.danger as any}>Xóa</button>}
      </div>
    </Modal>
  );
}

function QuoteDetailsModal({ quote, onClose, onDelete, canDeleteQuote }: any) {
  if (!quote) return null;
  return (
    <Modal title="Chi tiết báo giá" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: tokens.radius.lg, background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>{quote.supplierName || '—'}</div>
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={ui.badge.info}>{quote.category || '—'}</span>
            <span style={ui.badge.neutral}>{quote.status === 'active' ? 'Đang hiệu lực' : 'Hết hạn'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div>
            <label style={S.label}>Ngày nhận</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{quote.quoteDate ? new Date(quote.quoteDate).toLocaleDateString('vi-VN') : '—'}</div>
          </div>
          <div>
            <label style={S.label}>Hiệu lực đến</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('vi-VN') : '—'}</div>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Trạng thái</label>
            <div style={{ fontWeight: 700, color: tokens.colors.textPrimary }}>{quote.status === 'active' ? 'Đang hiệu lực' : 'Hết hạn'}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}>
        <button onClick={onClose} style={S.btnOutline}>Đóng</button>
        {canDeleteQuote && <button onClick={onDelete} style={ui.btn.danger as any}>Xóa</button>}
      </div>
    </Modal>
  );
}

function AddSupplierQuoteModal({ suppliers, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ supplierId: '', category: 'Phụ tùng', quoteDate: new Date().toISOString().split('T')[0], validUntil: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.supplierId) return showNotify('Chọn nhà cung cấp', 'error');
    setSaving(true);
    await fetchWithAuth(token, `${API}/supplier-quotes`, { method: 'POST', body: JSON.stringify(form) });
    onSaved(); onClose();
  };
  return (
    <Modal title="Thêm Báo giá từ Nhà cung cấp" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={S.label}>NHÀ CUNG CẤP *</label>
          <select style={S.input} value={form.supplierId} onChange={(e:any)=>setForm({...form, supplierId: e.target.value})}>
            <option value="">-- Chọn Nhà cung cấp --</option>
            {suppliers.map((s:any) => <option key={s.id} value={s.id}>{s.companyName || s.company}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={S.label}>DANH MỤC</label>
            <select style={S.input} value={form.category} onChange={(e:any)=>setForm({...form, category: e.target.value})}>
              <option value="Phụ tùng">Phụ tùng</option>
              <option value="Máy nguyên chiếc">Máy nguyên chiếc</option>
              <option value="Dịch vụ">Dịch vụ</option>
            </select>
          </div>
          <div>
            <label style={S.label}>TRẠNG THÁI</label>
            <select style={S.input} value={form.status} onChange={(e:any)=>setForm({...form, status: e.target.value})}>
              <option value="active">Đang hiệu lực</option>
              <option value="expired">Hết hạn</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={S.label}>NGÀY NHẬN</label>
            <input type="date" style={S.input} value={form.quoteDate} onInput={(e:any)=>setForm({...form, quoteDate: e.target.value})} />
          </div>
          <div>
            <label style={S.label}>HIỆU LỰC ĐẾN</label>
            <input type="date" style={S.input} value={form.validUntil} onInput={(e:any)=>setForm({...form, validUntil: e.target.value})} />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '32px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '24px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Báo giá'}</button>
      </div>
    </Modal>
  );
}

function AddSupplierModal({ onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ code: '', company: '', tag: '', country: '' });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.company) return showNotify('Thiếu tên nhà cung cấp', 'error');
    setSaving(true);
    await fetchWithAuth(token, `${API}/suppliers`, { method: 'POST', body: JSON.stringify(form) });
    onSaved(); onClose();
  };
  return (
    <Modal title="Thêm Nhà cung cấp / Vendor" onClose={onClose}>
      <input type="text" placeholder="Mã Nhà CC (HT-SUP...)" style={{ ...S.input, marginBottom: '12px' }} value={form.code} onInput={(e:any)=>setForm({...form, code: e.target.value})} />
      <input type="text" placeholder="Tên Công ty Vendor *" style={{ ...S.input, marginBottom: '12px' }} value={form.company} onInput={(e:any)=>setForm({...form, company: e.target.value})} />
      <textarea placeholder="Tag sản phẩm, cách nhau bằng dấu phẩy. Ví dụ: Crane, Spare Parts, PLC" rows={3} style={{ ...S.input, marginBottom: '12px', resize: 'vertical', minHeight: '88px' }} value={form.tag} onInput={(e:any)=>setForm({...form, tag: e.target.value})} />
      <input type="text" placeholder="Quốc gia" style={S.input} value={form.country} onInput={(e:any)=>setForm({...form, country: e.target.value})} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Đang lưu...' : 'Lưu Nhà CC'}</button>
      </div>
    </Modal>
  );
}

function EditSupplierModal({ supplier, onClose, onSaved, token }: any) {
  const [form, setForm] = useState({ ...supplier, company: supplier.companyName || supplier.company, tag: parseProductTags(supplier.productTags ?? supplier.tag).join(', ') });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.company) return showNotify('Thiếu tên nhà cung cấp', 'error');
    setSaving(true);
    await fetchWithAuth(token, `${API}/suppliers/${supplier.id}`, { method: 'PUT', body: JSON.stringify(form) });
    onSaved(); onClose();
  };
  return (
    <Modal title="Chỉnh sửa Nhà CC" onClose={onClose}>
      <input type="text" placeholder="Mã Nhà CC" style={{ ...S.input, marginBottom: '12px' }} value={form.code} onInput={(e:any)=>setForm({...form, code: e.target.value})} />
      <input type="text" placeholder="Tên Công ty Vendor *" style={{ ...S.input, marginBottom: '12px' }} value={form.company} onInput={(e:any)=>setForm({...form, company: e.target.value})} />
      <textarea placeholder="Tag sản phẩm, cách nhau bằng dấu phẩy. Ví dụ: Crane, Spare Parts, PLC" rows={3} style={{ ...S.input, marginBottom: '12px', resize: 'vertical', minHeight: '88px' }} value={form.tag} onInput={(e:any)=>setForm({...form, tag: e.target.value})} />
      <input type="text" placeholder="Quốc gia" style={S.input} value={form.country} onInput={(e:any)=>setForm({...form, country: e.target.value})} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: `1px solid ${tokens.colors.border}`, paddingTop: '20px' }}>
        <button onClick={onClose} style={S.btnOutline}>Bỏ qua</button>
        <button onClick={submit} style={S.btnPrimary}>{saving ? 'Lưu...' : 'Lưu Thay đổi'}</button>
      </div>
    </Modal>
  );
}

function useSortableData(items: any[]) {
  const [sortConfig, setSortConfig] = useState<any>(null);
  const [filters, setFilters] = useState<any>({});
  const filteredItems = useMemo(() => {
    let result = [...items];
    Object.keys(filters).forEach(k => { if (filters[k]) result = result.filter(i => String(i[k]||'').toLowerCase().includes(filters[k].toLowerCase())); });
    if (sortConfig) result.sort((a:any,b:any) => {
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

export function Suppliers({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: any } = {}) {
  const token = currentUser?.token || '';
  const { t } = useI18n();
  const userCanEdit = canEdit(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');
  const userCanDelete = canDelete(currentUser?.roleCodes, currentUser?.systemRole || 'viewer');

  const [activeTab, setActiveTab] = useState<'Vendors' | 'Quotes'>('Vendors');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingSup, setEditingSup] = useState<any>(null);
  const [viewingSup, setViewingSup] = useState<any>(null);
  const [viewingQuote, setViewingQuote] = useState<any>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    suppliers.forEach((supplier: any) => {
      (supplier.productTags || []).forEach((tag: string) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
      .map(([tag, count]) => ({ tag, count }));
  }, [suppliers]);

  const suppliersBySelectedTag = useMemo(() => {
    if (!selectedTag) return suppliers;
    return suppliers.filter((supplier: any) => (supplier.productTags || []).includes(selectedTag));
  }, [suppliers, selectedTag]);

  const vendorFiltered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return suppliersBySelectedTag.filter((supplier: any) => (
      !needle ||
      matchesQuery(supplier.code, needle) ||
      matchesQuery(supplier.companyName || supplier.company, needle) ||
      matchesQuery((supplier.productTags || []).join(' '), needle) ||
      matchesQuery(supplier.country, needle)
    ));
  }, [suppliersBySelectedTag, searchTerm]);

  const quoteFiltered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return quotes.filter((quote: any) => (
      !needle ||
      matchesQuery(quote.supplierName, needle) ||
      matchesQuery(quote.category, needle) ||
      matchesQuery(quote.status, needle) ||
      matchesQuery(quote.quoteDate, needle) ||
      matchesQuery(quote.validUntil, needle)
    ));
  }, [quotes, searchTerm]);

  const vendorData = useSortableData(vendorFiltered);
  const quoteData = useSortableData(quoteFiltered);
  const activeData = activeTab === 'Vendors' ? vendorData : quoteData;
  const hasFilters = !!(searchTerm.trim() || selectedTag || Object.values(activeData.filters || {}).some(Boolean));

  const loadData = async () => {
    setLoading(true);
    try { 
      const [sRes, qRes] = await Promise.all([
        fetch(`${API}/suppliers`),
        fetch(`${API}/supplier-quotes`)
      ]);
      setSuppliers((await sRes.json()).map(normalizeSupplier)); 
      setQuotes(await qRes.json());
    } catch {}
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const handleImport = async (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    setLoading(true);
    try {
      const res = await fetchWithAuth(token, `${API}/suppliers/import`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Không thể import dữ liệu');
      const report = normalizeImportReport(result);
      showNotify(buildImportSummary(report), report.errors > 0 ? 'info' : 'success');
      loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể import dữ liệu', 'error');
    } finally {
      setLoading(false);
      if (e?.target) e.target.value = '';
    }
  };

  const openSupplierFile = (kind: 'template' | 'export', format: 'csv' | 'xlsx') => {
    const path = kind === 'template' ? `${API}/template/suppliers` : `${API}/suppliers/export`;
    window.open(buildTabularFileUrl(path, format), '_blank');
  };

  const deleteSup = (id: string) => {
    setConfirmState({
      message: 'Xóa Nhà cung cấp này?',
      onConfirm: async () => {
        setConfirmState(null);
        setSuppliers(prev => prev.filter((s: any) => s.id !== id));
        await fetchWithAuth(token, `${API}/suppliers/${id}`, { method: 'DELETE' });
      },
    });
  };

  const deleteQuote = (id: string) => {
    setConfirmState({
      message: 'Xóa Báo giá này?',
      onConfirm: async () => {
        setConfirmState(null);
        setQuotes(prev => prev.filter((q: any) => q.id !== id));
        await fetchWithAuth(token, `${API}/supplier-quotes/${id}`, { method: 'DELETE' });
      },
    });
  };

  const toggleSelectedTag = (tag: string) => setSelectedTag(prev => prev === tag ? '' : tag);

  const vendorCols = [{ k: 'code', l: 'Mã' }, { k: 'companyName', l: 'Nhà cung cấp' }, { k: 'tag', l: 'Tag sản phẩm' }];
  const quoteCols = [{ k: 'supplierName', l: 'Nhà cung cấp' }, { k: 'category', l: 'Danh mục' }, { k: 'status', l: 'Trạng thái' }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      {showAdd && <AddSupplierModal onClose={()=>setShowAdd(false)} onSaved={loadData} token={token} />}
      {showAddQuote && <AddSupplierQuoteModal suppliers={suppliers} onClose={()=>setShowAddQuote(false)} onSaved={loadData} token={token} />}
      {editingSup && <EditSupplierModal supplier={editingSup} onClose={()=>setEditingSup(null)} onSaved={loadData} token={token} />}
      {viewingSup && <SupplierDetailsModal supplier={viewingSup} canEditSupplier={userCanEdit} canDeleteSupplier={userCanDelete} onEdit={() => setEditingSup(viewingSup)} onDelete={() => deleteSup(viewingSup.id)} onClose={() => setViewingSup(null)} />}
      {viewingQuote && <QuoteDetailsModal quote={viewingQuote} canDeleteQuote={userCanDelete} onDelete={() => deleteQuote(viewingQuote.id)} onClose={() => setViewingQuote(null)} />}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} accept=".csv,.xlsx" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: tokens.colors.textPrimary,
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <HandshakeIcon size={22} /> Mua hàng & Nhà cung cấp
          </h2>
          <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '6px 0 0' }}>Bảng quản lý đối tác và báo giá cung ứng</p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            ...(isMobile ? { overflowX: 'auto', maxWidth: '100%', flexWrap: 'nowrap', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' } : {}),
          }}
        >
          {activeTab === 'Vendors' ? (
            <>
              <FormatActionButton
                label={t('common.import_template')}
                icon={ExportIcon}
                buttonStyle={S.btnOutline}
                onSelect={(format) => openSupplierFile('template', format)}
              />
              {userCanEdit ? (
                <button style={S.btnOutline} onClick={() => fileInputRef.current?.click()}>
                  <ImportIcon size={14} /> {t('common.import_file')}
                </button>
              ) : null}
              <FormatActionButton
                label={t('common.export_data')}
                icon={ExportIcon}
                buttonStyle={S.btnOutline}
                onSelect={(format) => openSupplierFile('export', format)}
              />
              {userCanEdit ? (
                <button style={S.btnPrimary} onClick={() => setShowAdd(true)}>
                  + Thêm Nhà CC
                </button>
              ) : null}
            </>
          ) : userCanEdit ? (
            <button style={S.btnPrimary} onClick={() => setShowAddQuote(true)}>
              + Thêm Báo giá Mới
            </button>
          ) : null}
        </div>
      </div>

      <SegmentedControl
        ariaLabel="Điều hướng mua hàng và nhà cung cấp"
        options={[
          { value: 'Vendors', label: 'Danh sách Nhà cung cấp' },
          { value: 'Quotes', label: 'Báo giá từ Nhà cung cấp' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '12px', border: `1px solid ${tokens.colors.border}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '280px', flex: isMobile ? '1 1 100%' : '1 1 280px' }}>
              <SearchIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                type="text"
                placeholder={activeTab === 'Vendors' ? 'Tìm theo mã, tên, tag, quốc gia...' : 'Tìm theo nhà cung cấp, danh mục, trạng thái...'}
                value={searchTerm}
                onInput={(e: any) => setSearchTerm(e.target.value)}
                style={{ ...ui.input.base, padding: '9px 12px 9px 36px', fontSize: '13.5px', width: '100%', minWidth: 0 }}
              />
            </div>
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
                  setSelectedTag('');
                  activeData.setFilters({});
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
            {(activeTab === 'Vendors'
              ? [
                  { key: 'code', label: 'Mã nhà cung cấp' },
                  { key: 'country', label: 'Quốc gia' },
                  { key: 'tag', label: 'Tag sản phẩm' },
                ]
              : [
                  { key: 'supplierName', label: 'Nhà cung cấp' },
                  { key: 'quoteDate', label: 'Ngày nhận' },
                  { key: 'validUntil', label: 'Hiệu lực đến' },
                ]
            ).map((field) => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{field.label}</label>
                <input
                  type="text"
                  placeholder={`Lọc ${field.label.toLowerCase()}`}
                  value={activeData.filters[field.key] || ''}
                  onInput={(e: any) => activeData.setFilters({ ...activeData.filters, [field.key]: e.target.value })}
                  style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'Vendors' && availableTags.length > 0 && (
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '12px', border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>Lọc theo tag sản phẩm</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, marginTop: '4px' }}>
                Click vào tag để xem supplier đang cung cấp nhóm sản phẩm đó.
              </div>
            </div>
            {selectedTag && (
              <button style={S.btnOutline} onClick={() => setSelectedTag('')}>
                Bỏ lọc tag
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {availableTags.map(({ tag, count }) => {
              const active = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(active ? '' : tag)}
                  style={{
                    border: `1px solid ${active ? tokens.colors.primary : tokens.colors.border}`,
                    background: active ? tokens.colors.primary : tokens.colors.surface,
                    color: active ? tokens.colors.textOnPrimary : tokens.colors.textPrimary,
                    borderRadius: '999px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{tag}</span>
                  <span style={{
                    minWidth: '22px',
                    height: '22px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? 'rgba(255,255,255,0.18)' : tokens.colors.background,
                    color: active ? tokens.colors.textOnPrimary : tokens.colors.textSecondary,
                    fontSize: '11px'
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ ...S.card, overflowX: 'auto', border: `1px solid ${tokens.colors.border}` }}>
        {loading ? <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px' }}>⏳ Đang tải dữ liệu...</div> : (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                {activeTab === 'Vendors' ? vendorData.items.map((s: any) => (
                  <div key={s.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{s.companyName || s.company}</div>
                    <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Mã:</strong> {s.code || '—'}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                        <strong>Tag:</strong>
                        <div style={{ marginTop: '6px' }}><TagChips tags={s.productTags} activeTag={selectedTag} onTagClick={toggleSelectedTag} /></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border}` }}>
                    <button onClick={()=>setViewingSup(s)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EyeIcon size={14} /></button>
                    {userCanEdit && <button onClick={()=>setEditingSup(s)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EditIcon size={14} /></button>}
                    {userCanDelete && <button onClick={()=>deleteSup(s.id)} style={{ ...ui.btn.danger, padding: '6px 10px' }}><TrashIcon size={14} /></button>}
                    </div>
                  </div>
                )) : quoteData.items.map((q: any) => (
                  <div key={q.id} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: tokens.colors.textPrimary }}>{q.supplierName || '—'}</div>
                    <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Danh mục:</strong> {q.category || '-'}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Trạng thái:</strong> {q.status === 'active' ? 'Đang hiệu lực' : 'Hết hạn'}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border}` }}>
                    <button onClick={()=>setViewingQuote(q)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EyeIcon size={14} /></button>
                    {userCanDelete && <button onClick={()=>deleteQuote(q.id)} style={{ ...ui.btn.danger, padding: '6px 10px' }}><TrashIcon size={14} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: tokens.colors.background }}>
                  {(activeTab === 'Vendors' ? vendorCols : quoteCols).map(c => (
                    <th key={c.k} style={S.thSortable} onClick={() => (activeTab === 'Vendors' ? vendorData : quoteData).requestSort(c.k)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{c.l} {(activeTab === 'Vendors' ? vendorData : quoteData).sortConfig?.key === c.k ? ((activeTab === 'Vendors' ? vendorData : quoteData).sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                  ))}
                  <th style={{ ...S.thStatic, cursor: 'default', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'Vendors' ? vendorData.items.map((s: any) => (
                  <tr key={s.id} style={{ ...ui.table.row }} onMouseEnter={(e: any) => e.currentTarget.style.background = tokens.colors.background} onMouseLeave={(e: any) => e.currentTarget.style.background = ''}>
                    <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.primary }}>{s.code || '—'}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{s.companyName || s.company}</td>
                    <td style={S.td}><TagChips tags={s.productTags} activeTag={selectedTag} onTagClick={toggleSelectedTag} /></td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button onClick={()=>setViewingSup(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: tokens.colors.info, fontWeight: 700 }}><EyeIcon size={14} /></button>
                      {userCanEdit && <button onClick={()=>setEditingSup(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: tokens.colors.info, fontWeight: 700 }}><EditIcon size={14} /></button>}
                      {userCanDelete && <button onClick={()=>deleteSup(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: tokens.colors.error, fontWeight: 700 }}><TrashIcon size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                )) : quoteData.items.map((q: any) => (
                  <tr key={q.id} style={{ ...ui.table.row }} onMouseEnter={(e: any) => e.currentTarget.style.background = tokens.colors.background} onMouseLeave={(e: any) => e.currentTarget.style.background = ''}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{q.supplierName || '—'}</td>
                    <td style={S.td}><span style={{ ...ui.badge.success, border: `1px solid ${tokens.colors.border}` }}>{q.category}</span></td>
                    <td style={S.td}>
                      <span style={{ color: q.status === 'active' ? tokens.colors.success : tokens.colors.textMuted, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                        ● {q.status === 'active' ? 'Đang hiệu lực' : 'Hết hạn'}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button onClick={()=>setViewingQuote(q)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: tokens.colors.info, fontWeight: 700 }}><EyeIcon size={14} /></button>
                      {userCanDelete && <button onClick={()=>deleteQuote(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: tokens.colors.error, fontWeight: 700 }}><TrashIcon size={14} /></button>}
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
