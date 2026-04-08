import { API_BASE } from './config';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { canEdit, canDelete, fetchWithAuth, loadSession } from './auth';
import { useI18n } from './i18n';
import { ConfirmDialog } from './ui/ConfirmDialog';
import {
  buildProductImportPreviewSummary,
  buildProductImportSummary,
  normalizeProductImportPreview,
  normalizeProductImportReport,
  type ProductImportPreviewReport,
  type ProductImportReport,
} from './products/importReport';
import { buildTabularFileUrl } from './shared/imports/tabularFiles';
import { FormatActionButton } from './ui/FormatActionButton';
import { PageHeader } from './ui/PageHeader';
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
import { resolveAssetUrl } from './products/productAssetUi';
import { getPrimaryImage } from './products/productAssetData';
import { ProductImportReportModal, ProductImportWizardModal } from './products/productImportModals';
import { ProductDetailModal, getProductQbuWarnings, QbuBadgeRow } from './products/ProductDetailModal';
import {
  AddProductModal,
  EditProductModal,
  createEmptyProductForm,
  createProductFormFromProduct,
} from './products/ProductFormModal';
export type { ProductFormState } from './products/ProductFormModal';
export { createEmptyProductForm, createProductFormFromProduct };

export type UploadFeedback = {
  tone: 'info' | 'success' | 'error';
  message: string;
  stage?: 'reading-metadata' | 'loading-engine' | 'transcoding' | 'uploading' | 'fallback' | 'completed' | 'deleting';
  progress?: number;
};

// Re-export components used by other modules
export {
  ProductAssetGallery,
  ProductVideoGallery,
  ProductDocumentList,
  VideoPosterPreview,
  ManagedVideoPlayer,
} from './products/productAssetUi';
export { AssetListEditor } from './products/productAssetEditor';

const API = API_BASE;
const API_ORIGIN = API.replace(/\/api\/?$/, '');
const FX_PAIR = 'USDVND';

const S = {
  card: ui.card.base as any,
  btnPrimary: { ...ui.btn.primary, justifyContent: 'center', transition: 'all 0.2s ease' } as any,
  btnOutline: { ...ui.btn.outline, transition: 'all 0.2s ease' } as any,
  thSortable: ui.table.thSortable as any,
  thStatic: ui.table.thStatic as any,
  td: ui.table.td as any,
  input: { ...ui.input.base, transition: 'all 0.2s ease' } as any,
  kpiCard: ui.card.kpi as any,
};

function matchesQuery(value: unknown, needle: string) {
  if (!needle) return true;
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function useSortableData(items: any[]) {
  const [sortConfig, setSortConfig] = useState<any>(null);
  const [filters, setFilters] = useState<any>({});
  const filteredItems = useMemo(() => {
    let result = [...items];
    Object.keys(filters).forEach((k) => { if (filters[k]) result = result.filter((i) => String(i[k] || '').toLowerCase().includes(filters[k].toLowerCase())); });
    if (sortConfig) result.sort((a, b) => { const vA = (a[sortConfig.key] || '').toString().toLowerCase(); const vB = (b[sortConfig.key] || '').toString().toLowerCase(); return vA < vB ? (sortConfig.direction === 'asc' ? -1 : 1) : vA > vB ? (sortConfig.direction === 'asc' ? 1 : -1) : 0; });
    return result;
  }, [items, sortConfig, filters]);
  return { items: filteredItems, requestSort: (key: string) => { const dir = sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'; setSortConfig({ key, direction: dir }); }, sortConfig, filters, setFilters };
}

export function Products({ isMobile, currentUser }: { isMobile?: boolean; currentUser?: any } = {}) {
  const sessionUser = currentUser ?? loadSession();
  const token = sessionUser?.token ?? '';
  const { t } = useI18n();
  const userCanEdit = sessionUser ? canEdit(sessionUser.roleCodes, sessionUser.systemRole) : false;
  const userCanDelete = sessionUser ? canDelete(sessionUser.roleCodes, sessionUser.systemRole) : false;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [importReport, setImportReport] = useState<ProductImportReport | null>(null);
  const [importPreview, setImportPreview] = useState<ProductImportPreviewReport | null>(null);
  const [selectedDuplicateSkus, setSelectedDuplicateSkus] = useState<string[]>([]);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [latestRate, setLatestRate] = useState<number | null>(null);
  const [latestRateWarnings, setLatestRateWarnings] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(products.map((p) => String(p.category || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'vi'),
    );
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
      const res = await fetchWithAuth(token, `${API}/products`);
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

  useEffect(() => {
    loadData();
  }, []);

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
    const categories = new Set(products.map((p) => p.category)).size;
    const avgPrice = total > 0 ? products.reduce((acc, p) => acc + (p.basePrice || 0), 0) / total : 0;
    return { total, categories, avgPrice };
  }, [products]);

  const resetImportWizard = () => {
    setPendingImportFile(null);
    setImportPreview(null);
    setSelectedDuplicateSkus([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportFileSelection = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImportFile(file);
    setImportPreview(null);
    setSelectedDuplicateSkus([]);
  };

  const handlePreviewImport = async () => {
    if (!pendingImportFile) {
      showNotify('Bạn chưa chọn file import', 'info');
      return;
    }
    const formData = new FormData();
    formData.append('file', pendingImportFile);
    setImporting(true);
    try {
      const res = await fetchWithAuth(token, `${API}/products/import/preview`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Không thể phân tích file import');
      const report = normalizeProductImportPreview(result);
      setImportPreview(report);
      setSelectedDuplicateSkus(
        report.rows.filter((row) => row.action === 'duplicate' && row.sku).map((row) => row.sku as string),
      );
      showNotify(buildProductImportPreviewSummary(report), report.errorRows > 0 ? 'info' : 'success');
    } catch (error: any) {
      showNotify(error?.message || 'Không thể phân tích file import', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async (duplicateStrategy: 'skip' | 'replace') => {
    if (!pendingImportFile) {
      showNotify('Bạn chưa chọn file import', 'info');
      return;
    }
    const formData = new FormData();
    formData.append('file', pendingImportFile);
    formData.append('duplicateStrategy', duplicateStrategy);
    if (duplicateStrategy === 'replace' && selectedDuplicateSkus.length > 0) {
      formData.append('replaceSkus', selectedDuplicateSkus.join('|'));
    }
    setImporting(true);
    try {
      const res = await fetchWithAuth(token, `${API}/products/import`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || 'Không thể import sản phẩm');
      const report = normalizeProductImportReport(result);
      setImportReport(report);
      setShowImportWizard(false);
      showNotify(buildProductImportSummary(report), report.errors > 0 ? 'info' : 'success');
      loadData();
    } catch (error: any) {
      showNotify(error?.message || 'Không thể import sản phẩm', 'error');
    } finally {
      setImporting(false);
      resetImportWizard();
    }
  };

  const openProductFile = (kind: 'template' | 'export', format: 'csv' | 'xlsx') => {
    const path = kind === 'template' ? `${API}/template/products` : `${API}/products/export`;
    window.open(buildTabularFileUrl(path, format), '_blank');
  };

  const deleteProduct = (id: string) => {
    setConfirmState({
      message: 'Xóa sản phẩm này?',
      onConfirm: async () => {
        setConfirmState(null);
        await fetchWithAuth(token, `${API}/products/${id}`, { method: 'DELETE' });
        setProducts((prev) => prev.filter((p: any) => p.id !== id));
      },
    });
  };

  const cols = [
    { k: 'sku', l: 'SKU' },
    { k: 'name', l: 'Sản phẩm' },
    { k: 'category', l: 'Danh mục' },
    { k: 'basePrice', l: 'Giá bán ($)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} onSaved={loadData} token={token} />}
      {editingProduct && <EditProductModal product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={loadData} token={token} />}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          latestRate={latestRate}
          latestRateWarnings={latestRateWarnings}
          onClose={() => setSelectedProduct(null)}
          onEdit={
            userCanEdit
              ? (product: any) => {
                  setSelectedProduct(null);
                  setEditingProduct(product);
                }
              : undefined
          }
        />
      )}
      {showImportWizard && (
        <ProductImportWizardModal
          selectedFileName={pendingImportFile?.name || ''}
          preview={importPreview}
          importing={importing}
          selectedDuplicateSkus={selectedDuplicateSkus}
          onClose={() => {
            setShowImportWizard(false);
            resetImportWizard();
          }}
          onPickFile={() => fileInputRef.current?.click()}
          onAnalyze={handlePreviewImport}
          onImportNewOnly={() => handleImport('skip')}
          onReplaceDuplicates={() => handleImport('replace')}
          onToggleDuplicate={(sku) =>
            setSelectedDuplicateSkus((current) =>
              current.includes(sku) ? current.filter((item) => item !== sku) : [...current, sku],
            )
          }
          onSelectAllDuplicates={() =>
            setSelectedDuplicateSkus(
              (importPreview?.rows || []).filter((row) => row.action === 'duplicate' && row.sku).map((row) => row.sku as string),
            )
          }
          onClearAllDuplicates={() => setSelectedDuplicateSkus([])}
          outlineButtonStyle={S.btnOutline}
          primaryButtonStyle={S.btnPrimary}
        />
      )}
      {importReport && (
        <ProductImportReportModal
          report={importReport}
          onClose={() => setImportReport(null)}
          primaryButtonStyle={S.btnPrimary}
        />
      )}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportFileSelection} accept=".csv,.xlsx" />

      {/* Mini Dashboard */}
      <div style={ui.page.kpiRow}>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Danh mục Sản phẩm</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.total}</span>
        </div>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard, borderLeft: `4px solid ${tokens.colors.warningDark}` }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.warningDark, textTransform: 'uppercase' }}>Số phân mục</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.categories}</span>
        </div>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard, flex: '2 1 200px', borderLeft: `4px solid ${tokens.colors.success}` }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.success, textTransform: 'uppercase' }}>Giá tham chiếu trung bình</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>${Math.round(stats.avgPrice).toLocaleString()}</span>
        </div>
      </div>

      <PageHeader
        icon={<PackageIcon size={22} />}
        title="Danh mục Sản phẩm"
        subtitle="Bảng giá tham chiếu và quản lý mã SKU"
        actions={
          <>
            <FormatActionButton label={t('common.import_template')} icon={SheetIcon} buttonStyle={S.btnOutline} onSelect={(format) => openProductFile('template', format)} />
            {userCanEdit && (
              <button style={S.btnOutline} title="Mở luồng import sản phẩm hàng loạt" onClick={() => setShowImportWizard(true)}>
                <ImportIcon size={14} /> {t('common.import_file')}
              </button>
            )}
            <FormatActionButton label={t('common.export_data')} icon={ExportIcon} buttonStyle={S.btnOutline} onSelect={(format) => openProductFile('export', format)} />
            {userCanEdit && (
              <button style={S.btnPrimary} onClick={() => setShowAdd(true)}>
                <PlusIcon size={14} /> Thêm mới Sản phẩm
              </button>
            )}
          </>
        }
      />

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
                <option key={category} value={category}>{category}</option>
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
        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <LoaderIcon size={16} /> Đang tải dữ liệu...
          </div>
        ) : isMobile ? (
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
                  <button aria-label={`Xem chi tiết ${p.name || p.sku || 'sản phẩm'}`} title="Xem chi tiết" onClick={() => setSelectedProduct(p)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EyeIcon size={14} /></button>
                  {userCanEdit && <button aria-label={`Chỉnh sửa ${p.name || p.sku || 'sản phẩm'}`} title="Chỉnh sửa" onClick={() => setEditingProduct(p)} style={{ ...ui.btn.outline, padding: '6px 10px' }}><EditIcon size={14} /></button>}
                  {userCanDelete && <button aria-label={`Xóa ${p.name || p.sku || 'sản phẩm'}`} title="Xóa" onClick={() => deleteProduct(p.id)} style={{ ...ui.btn.danger, padding: '6px 10px' }}><TrashIcon size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.colors.background }}>
                {cols.map((c) => (
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
                  <td style={{ ...S.td, fontWeight: 700, color: tokens.colors.textPrimary, verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {(() => {
                        const img = getPrimaryImage(p.productImages || []);
                        return img ? (
                          <img
                            src={resolveAssetUrl(API_ORIGIN, img.url)}
                            alt={img.alt || p.name}
                            style={{ width: 36, height: 36, borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: `1px solid ${tokens.colors.border}` }}
                          />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: '8px', background: tokens.colors.background, border: `1px solid ${tokens.colors.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: tokens.colors.textMuted }}>
                            {(p.name || p.sku || '?')[0].toUpperCase()}
                          </div>
                        );
                      })()}
                      <div>
                        <div>{p.name}</div>
                        <QbuBadgeRow warnings={getProductQbuWarnings(p, latestRate)} />
                      </div>
                    </div>
                  </td>
                  <td style={S.td}>
                    <span style={{ background: tokens.colors.background, padding: '3px 10px', borderRadius: '6px', border: `1px solid ${tokens.colors.border}`, fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>{p.category}</span>
                  </td>
                  <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>${p.basePrice?.toLocaleString()}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        aria-label={`Xem chi tiết ${p.name || p.sku || 'sản phẩm'}`}
                        title="Xem chi tiết"
                        onClick={() => setSelectedProduct(p)}
                        style={{ color: tokens.colors.info, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                      >
                        <EyeIcon size={14} />
                      </button>
                      {userCanEdit && (
                        <button
                          aria-label={`Chỉnh sửa ${p.name || p.sku || 'sản phẩm'}`}
                          title="Chỉnh sửa"
                          onClick={() => setEditingProduct(p)}
                          style={{ color: tokens.colors.primary, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                        >
                          <EditIcon size={14} />
                        </button>
                      )}
                      {userCanDelete && (
                        <button
                          aria-label={`Xóa ${p.name || p.sku || 'sản phẩm'}`}
                          title="Xóa"
                          onClick={() => deleteProduct(p.id)}
                          style={{ color: tokens.colors.error, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
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
