import { API_BASE } from './config';
import type { JSX } from 'preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { showNotify } from './Notification';
import { tokens } from './ui/tokens';
import { ui } from './ui/styles';
import { canEdit, canDelete, fetchWithAuth, loadSession, type CurrentUser } from './auth';
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
  ExportIcon,
  ImportIcon,
  LoaderIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  SheetIcon,
} from './ui/icons';
import { getPrimaryImage } from './products/productAssetData';
import { ProductIdentity } from './products/productsCardSections';
import {
  ProductCardsSection,
  ProductInsightsAside,
  ProductTableSection,
} from './products/productsWorkspaceSections';
import { ProductImportReportModal, ProductImportWizardModal } from './products/productImportModals';
import { ProductDetailModal, type ProductDetailEditContext } from './products/ProductDetailModal';
import {
  AddProductModal,
  EditProductModal,
  createEmptyProductForm,
  createProductFormFromProduct,
} from './products/ProductFormModal';
import type { ProductFormTab } from './products/ProductFormModal';
import {
  computeProductHealth,
  matchesQuery,
  persistWorkspaceState,
  readPersistedWorkspaceState,
  type ProductListItem,
  type ProductListItemWithHealth,
  type ProductWorkspaceViewMode,
  type ProductWorkspaceSortKey,
  useSortableData,
} from './products/productsWorkspaceData';
import {
  ADVANCED_FILTER_FIELDS,
  PRODUCT_COLUMNS,
  getModeButtonLabel,
  getSortLabel as getSortLabelUtil,
  getSortIcon as getSortIconUtil,
  getColumnAriaSort,
  getCompletenessSummary,
  getTopProblemProducts,
  extractDuplicateSkusFromPreview,
} from './products/productsWorkspaceUtils';
import { workspaceStyles, createWorkspaceSurfaceStyles } from './products/productsWorkspaceStyles';
export type { ProductFormState, ProductFormTab } from './products/ProductFormModal';
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

const S = workspaceStyles;

type ProductDetailModalProduct = ProductListItemWithHealth;

type ProductsProps = {
  isMobile?: boolean;
  currentUser?: CurrentUser;
};

export function Products({ isMobile, currentUser }: ProductsProps = {}) {
  const sessionUser: CurrentUser | null = currentUser ?? loadSession();
  const token = sessionUser?.token ?? '';
  const { t } = useI18n();
  const userCanEdit = sessionUser ? canEdit(sessionUser.roleCodes, sessionUser.systemRole) : false;
  const userCanDelete = sessionUser ? canDelete(sessionUser.roleCodes, sessionUser.systemRole) : false;
  const persistedWorkspace = useMemo(() => readPersistedWorkspaceState(), []);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null);
  const [editingProductInitialTab, setEditingProductInitialTab] = useState<ProductFormTab>('info');
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [importReport, setImportReport] = useState<ProductImportReport | null>(null);
  const [importPreview, setImportPreview] = useState<ProductImportPreviewReport | null>(null);
  const [selectedDuplicateSkus, setSelectedDuplicateSkus] = useState<string[]>([]);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [latestRate, setLatestRate] = useState<number | null>(null);
  const [latestRateWarnings, setLatestRateWarnings] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(persistedWorkspace.searchTerm || '');
  const [categoryFilter, setCategoryFilter] = useState(persistedWorkspace.categoryFilter || '');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(Boolean(persistedWorkspace.showAdvancedFilters));
  const [desktopViewMode, setDesktopViewMode] = useState<ProductWorkspaceViewMode>(persistedWorkspace.desktopViewMode === 'cards' ? 'cards' : 'table');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(products.map((p) => String(p.category || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'vi'),
    );
  }, [products]);

  const primaryFilteredProducts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
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

  const productsWithHealth = useMemo(
    () => primaryFilteredProducts.map((product) => computeProductHealth(product, latestRate)),
    [primaryFilteredProducts, latestRate],
  );

  const data = useSortableData(productsWithHealth);

  useEffect(() => {
    if (persistedWorkspace.advancedFilters && Object.keys(data.filters).length === 0) {
      data.setFilters(persistedWorkspace.advancedFilters);
    }
  }, [persistedWorkspace.advancedFilters]);

  useEffect(() => {
    persistWorkspaceState({
      searchTerm,
      categoryFilter,
      desktopViewMode,
      showAdvancedFilters,
      advancedFilters: data.filters,
    });
  }, [searchTerm, categoryFilter, desktopViewMode, showAdvancedFilters, data.filters]);
  const hasFilters = !!(searchTerm.trim() || categoryFilter || Object.values(data.filters || {}).some(Boolean));
  const visibleCount = data.items.length;
  const hasCatalogData = products.length > 0;
  const showCatalogLoading = loading;
  const showCatalogError = !loading && !!loadError;
  const showCatalogEmpty = !loading && !loadError && !hasCatalogData;
  const showFilteredEmpty = !loading && !loadError && hasCatalogData && visibleCount === 0;

  const clearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    data.setFilters({});
  };

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

  const quickCategoryPills = useMemo(() => categoryOptions.slice(0, isMobile ? 4 : 8), [categoryOptions, isMobile]);

  const selectedCategoryLabel = categoryFilter || 'Tất cả danh mục';
  const searchTermLabel = searchTerm.trim() || 'Tất cả từ khóa';

  const activeAdvancedFilterCount = useMemo(() => {
    return ADVANCED_FILTER_FIELDS.filter((field) => String(data.filters?.[field.key] || '').trim().length > 0).length;
  }, [data.filters]);

  const completenessSummary = useMemo(() => getCompletenessSummary(data.items), [data.items]);

  const topProblemProducts = useMemo(() => getTopProblemProducts(data.items), [data.items]);


  const showDesktopCards = !isMobile && desktopViewMode === 'cards';
  const showDesktopTable = !isMobile && desktopViewMode === 'table';
  const showMobileCards = !!isMobile;
  const showCatalogResults = !showCatalogLoading && !showCatalogError && !showCatalogEmpty && !showFilteredEmpty;

  const surfaceStyles = useMemo(
    () => createWorkspaceSurfaceStyles({ isMobile: !!isMobile, showDesktopTable, desktopViewMode }),
    [isMobile, showDesktopTable, desktopViewMode],
  );

  const showQuickInsights = !isMobile;

  const resultHint = showCatalogLoading
    ? 'Đang tải catalog sản phẩm...'
    : `Hiển thị ${visibleCount}/${products.length} sản phẩm • ${selectedCategoryLabel} • ${searchTermLabel}`;

  const resultModeLabel = isMobile ? 'Danh sách di động' : desktopViewMode === 'cards' ? 'Chế độ thẻ' : 'Chế độ bảng';

  const openEditProduct = (product: ProductListItem) => {
    setEditingProduct(product);
    setEditingProductInitialTab('info');
  };

  const openDetailProduct = (product: ProductListItem) => setSelectedProduct(product);

  const renderProductIdentity = (product: ProductListItem) => (
    <ProductIdentity
      name={product.name}
      sku={product.sku}
      unit={product.unit}
      category={product.category}
      primaryImage={getPrimaryImage(product.productImages || [])}
      summaryChipStyle={surfaceStyles.summaryChipStyle}
      apiOrigin={API_ORIGIN}
    />
  );

  const columnAriaSort = (key: ProductWorkspaceSortKey) => getColumnAriaSort(data.sortConfig, key);
  const getSortLabel = (key: ProductWorkspaceSortKey) => getSortLabelUtil(data.sortConfig, key);
  const getSortIcon = (key: ProductWorkspaceSortKey) => getSortIconUtil(data.sortConfig, key);
  const cols = PRODUCT_COLUMNS;

  const topIssueProduct = topProblemProducts[0] || null;

  const resetImportWizard = () => {
    setPendingImportFile(null);
    setImportPreview(null);
    setSelectedDuplicateSkus([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportFileSelection = (e: Event) => {
    if (!(e.currentTarget instanceof HTMLInputElement)) return;
    const file = e.currentTarget.files?.[0];
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
      const duplicateSkus = extractDuplicateSkusFromPreview(report);
      setSelectedDuplicateSkus(duplicateSkus);
      showNotify(buildProductImportPreviewSummary(report), report.errorRows > 0 ? 'info' : 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể phân tích file import';
      showNotify(message, 'error');
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể import sản phẩm';
      showNotify(message, 'error');
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
        setProducts((prev) => prev.filter((p) => p.id !== id));
      },
    });
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {confirmState && <ConfirmDialog message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} onSaved={loadData} token={token} />}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          initialTab={editingProductInitialTab}
          onClose={() => {
            setEditingProduct(null);
            setEditingProductInitialTab('info');
          }}
          onSaved={loadData}
          token={token}
        />
      )}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          latestRate={latestRate}
          latestRateWarnings={latestRateWarnings}
          onClose={() => setSelectedProduct(null)}
          onEdit={
            userCanEdit
              ? (product: ProductDetailModalProduct, context?: ProductDetailEditContext) => {
                  setSelectedProduct(null);
                  setEditingProduct(product);
                  setEditingProductInitialTab(context?.tab || 'info');
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
          onSelectAllDuplicates={() => {
            const allDuplicates = extractDuplicateSkusFromPreview(importPreview);
            setSelectedDuplicateSkus(allDuplicates);
          }}
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

      <div style={ui.page.kpiRow}>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Tổng SKU</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.total}</span>
        </div>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Số danh mục</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>{stats.categories}</span>
        </div>
        <div style={{ ...S.kpiCard, ...ui.page.kpiCard, flex: '2 1 220px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Giá tham chiếu trung bình</span>
          <span style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary }}>${Math.round(stats.avgPrice).toLocaleString()}</span>
        </div>
      </div>

      <div
        style={{
          ...S.card,
          display: 'grid',
          gap: '12px',
          border: `1px solid ${tokens.colors.border}`,
          background: tokens.surface.panelGradient,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '320px', flex: isMobile ? '1 1 100%' : '1 1 320px' }}>
              <SearchIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                type="text"
                placeholder="Tìm theo SKU, tên, danh mục..."
                value={searchTerm}
                onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => setSearchTerm(e.currentTarget.value)}
                style={{ ...ui.input.base, padding: '9px 12px 9px 36px', fontSize: '13.5px', width: '100%', minWidth: 0 }}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e: JSX.TargetedEvent<HTMLSelectElement, Event>) => setCategoryFilter(e.currentTarget.value)}
              style={{ ...ui.input.base, minWidth: isMobile ? '100%' : '220px' }}
            >
              <option value="">Tất cả danh mục</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isMobile ? (
              <div
                style={{ display: 'inline-flex', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.lg, overflow: 'hidden', background: tokens.colors.surface }}
                role="group"
                aria-label="Chuyển đổi chế độ hiển thị desktop"
              >
                <button
                  type="button"
                  style={desktopViewMode === 'table' ? surfaceStyles.desktopViewActiveStyle : surfaceStyles.desktopViewToggleStyle}
                  onClick={() => setDesktopViewMode('table')}
                  aria-pressed={desktopViewMode === 'table'}
                  aria-label={`${getModeButtonLabel('table')}${desktopViewMode === 'table' ? ' (đang chọn)' : ''}`}
                >
                  {getModeButtonLabel('table')}
                </button>
                <button
                  type="button"
                  style={desktopViewMode === 'cards' ? surfaceStyles.desktopViewActiveStyle : surfaceStyles.desktopViewToggleStyle}
                  onClick={() => setDesktopViewMode('cards')}
                  aria-pressed={desktopViewMode === 'cards'}
                  aria-label={`${getModeButtonLabel('cards')}${desktopViewMode === 'cards' ? ' (đang chọn)' : ''}`}
                >
                  {getModeButtonLabel('cards')}
                </button>
              </div>
            ) : null}
            <button type="button" onClick={() => setShowAdvancedFilters((prev) => !prev)} style={S.btnOutline}>
              {showAdvancedFilters ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao'}
              {activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ''}
            </button>
            {hasFilters ? (
              <button type="button" onClick={clearAllFilters} style={S.btnOutline}>
                Xóa bộ lọc
              </button>
            ) : null}
          </div>
        </div>

        {quickCategoryPills.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              style={!categoryFilter ? surfaceStyles.quickFilterPillActiveStyle : surfaceStyles.quickFilterPillStyle}
              onClick={() => setCategoryFilter('')}
            >
              Tất cả danh mục
            </button>
            {quickCategoryPills.map((category) => (
              <button
                key={category}
                type="button"
                style={categoryFilter === category ? surfaceStyles.quickFilterPillActiveStyle : surfaceStyles.quickFilterPillStyle}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{resultHint}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <div style={surfaceStyles.summaryChipStyle}>{resultModeLabel}</div>
            {data.sortConfig ? (
              <div style={surfaceStyles.summaryChipStyle}>
                Sắp xếp: {cols.find((col) => col.k === data.sortConfig?.key)?.l || data.sortConfig?.key} {data.sortConfig.direction === 'asc' ? '↑' : '↓'}
              </div>
            ) : null}
          </div>
        </div>

        {showAdvancedFilters ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            {ADVANCED_FILTER_FIELDS.map((field) => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>{field.label}</label>
                <input
                  type="text"
                  placeholder={`Lọc ${field.label.toLowerCase()}`}
                  value={data.filters[field.key] || ''}
                  onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => data.setFilters({ ...data.filters, [field.key]: e.currentTarget.value })}
                  style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {showFilteredEmpty && hasFilters ? (
        <div style={{ ...S.card, border: `1px solid ${tokens.colors.border}`, background: tokens.surface.empty, display: 'grid', gap: '10px', justifyItems: 'center', textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>Không có sản phẩm nào khớp bộ lọc hiện tại</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Thử nới điều kiện tìm kiếm hoặc xóa bộ lọc để xem toàn bộ catalog.</div>
          <button type="button" style={S.btnOutline} onClick={clearAllFilters}>Xóa bộ lọc</button>
        </div>
      ) : null}

      {showCatalogEmpty ? (
        <div style={{ ...S.card, border: `1px solid ${tokens.colors.border}`, background: tokens.surface.empty, display: 'grid', gap: '10px', justifyItems: 'center', textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>Catalog sản phẩm đang trống</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Bạn có thể import file mẫu hoặc thêm sản phẩm mới để bắt đầu quản lý SKU.</div>
          {userCanEdit ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              <button type="button" style={S.btnOutline} onClick={() => setShowImportWizard(true)}>
                <ImportIcon size={14} /> {t('common.import_file')}
              </button>
              <button type="button" style={S.btnPrimary} onClick={() => setShowAdd(true)}>
                <PlusIcon size={14} /> Thêm mới Sản phẩm
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showCatalogError ? (
        <div style={{ ...S.card, border: `1px solid ${tokens.colors.warningBorder}`, background: tokens.colors.warningSurfaceBgSoft, color: tokens.colors.warningSurfaceText, display: 'grid', gap: '10px' }}>
          <div style={{ fontWeight: 700 }}>{loadError}</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Dữ liệu có thể chưa đồng bộ từ backend hoặc mạng đang gián đoạn tạm thời.</div>
          <div>
            <button type="button" style={S.btnOutline} onClick={loadData}>Thử tải lại</button>
          </div>
        </div>
      ) : null}

      {showCatalogLoading ? (
        <div style={{ ...S.card, border: `1px solid ${tokens.colors.border}`, padding: '64px 24px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <LoaderIcon size={16} /> Đang tải dữ liệu...
        </div>
      ) : null}

      {showCatalogResults ? (
        <div style={surfaceStyles.contentGridStyle}>
          {showDesktopCards || showMobileCards ? (
            <div style={surfaceStyles.cardsSurfaceStyle}>
              <ProductCardsSection
                isMobile={showMobileCards}
                items={data.items}
                latestRate={latestRate}
                userCanEdit={userCanEdit}
                userCanDelete={userCanDelete}
                handlers={{ onView: openDetailProduct, onEdit: openEditProduct, onDelete: deleteProduct }}
                renderProductIdentity={renderProductIdentity}
                viewButtonStyle={surfaceStyles.productCardButtonStyle}
                deleteButtonStyle={{ ...ui.btn.danger, padding: '6px 10px' }}
                summaryChipStyle={surfaceStyles.summaryChipStyle}
                apiOrigin={API_ORIGIN}
              />
            </div>
          ) : null}

          {showDesktopTable ? (
            <ProductTableSection
              items={data.items}
              columns={cols}
              requestSort={data.requestSort}
              getSortLabel={getSortLabel}
              getSortIcon={getSortIcon}
              columnAriaSort={columnAriaSort}
              handlers={{ onView: openDetailProduct, onEdit: openEditProduct, onDelete: deleteProduct }}
              userCanEdit={userCanEdit}
              userCanDelete={userCanDelete}
              tableSurfaceStyle={surfaceStyles.tableSurfaceStyle}
              tableHeaderButtonStyle={surfaceStyles.tableHeaderButtonStyle}
              tableInfoButtonStyle={surfaceStyles.tableInfoButtonStyle}
              tableEditButtonStyle={surfaceStyles.tableEditButtonStyle}
              tableDeleteButtonStyle={surfaceStyles.tableDeleteButtonStyle}
              renderProductIdentity={renderProductIdentity}
              visibleCount={visibleCount}
              S={{ thSortable: S.thSortable, thStatic: S.thStatic, td: S.td }}
            />
          ) : null}

          {showQuickInsights ? (
            <ProductInsightsAside
              sidePanelStyle={surfaceStyles.sidePanelStyle}
              summaryChipStyle={surfaceStyles.summaryChipStyle}
              selectedCategoryLabel={selectedCategoryLabel}
              completenessSummary={completenessSummary}
              topIssueProduct={topIssueProduct}
              topProblemProducts={topProblemProducts}
              openDetailProduct={openDetailProduct}
              btnOutlineStyle={S.btnOutline}
            />
          ) : null}

        </div>
      ) : null}
    </div>
  );
}
