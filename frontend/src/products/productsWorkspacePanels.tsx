import type { JSX } from 'preact';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { SearchIcon } from '../ui/icons';
import type { ProductWorkspaceViewMode, ProductWorkspaceFilterKey } from './productsWorkspaceData';
import { ADVANCED_FILTER_FIELDS, getModeButtonLabel } from './productsWorkspaceUtils';

type FilterPanelProps = {
  isMobile: boolean;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  categoryFilter: string;
  categoryOptions: string[];
  onCategoryFilterChange: (value: string) => void;
  quickCategoryPills: string[];
  quickFilterPillStyle: JSX.CSSProperties;
  quickFilterPillActiveStyle: JSX.CSSProperties;
  desktopViewMode: ProductWorkspaceViewMode;
  onDesktopViewModeChange: (mode: ProductWorkspaceViewMode) => void;
  desktopViewToggleStyle: JSX.CSSProperties;
  desktopViewActiveStyle: JSX.CSSProperties;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  activeAdvancedFilterCount: number;
  hasFilters: boolean;
  onClearAllFilters: () => void;
  resultHint: string;
  resultModeLabel: string;
  summaryChipStyle: JSX.CSSProperties;
  sortLabel: string;
  sortDirection: 'asc' | 'desc' | null;
  advancedFilters: Partial<Record<ProductWorkspaceFilterKey, string>>;
  onAdvancedFilterChange: (key: ProductWorkspaceFilterKey, value: string) => void;
  cardStyle: JSX.CSSProperties;
  btnOutlineStyle: JSX.CSSProperties;
};

export function ProductWorkspaceFilterPanel({
  isMobile,
  searchTerm,
  onSearchTermChange,
  categoryFilter,
  categoryOptions,
  onCategoryFilterChange,
  quickCategoryPills,
  quickFilterPillStyle,
  quickFilterPillActiveStyle,
  desktopViewMode,
  onDesktopViewModeChange,
  desktopViewToggleStyle,
  desktopViewActiveStyle,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  activeAdvancedFilterCount,
  hasFilters,
  onClearAllFilters,
  resultHint,
  resultModeLabel,
  summaryChipStyle,
  sortLabel,
  sortDirection,
  advancedFilters,
  onAdvancedFilterChange,
  cardStyle,
  btnOutlineStyle,
}: FilterPanelProps) {
  return (
    <div
      style={{
        ...cardStyle,
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
              onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => onSearchTermChange(e.currentTarget.value)}
              style={{ ...ui.input.base, padding: '9px 12px 9px 36px', fontSize: '13.5px', width: '100%', minWidth: 0 }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e: JSX.TargetedEvent<HTMLSelectElement, Event>) => onCategoryFilterChange(e.currentTarget.value)}
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
                style={desktopViewMode === 'table' ? desktopViewActiveStyle : desktopViewToggleStyle}
                onClick={() => onDesktopViewModeChange('table')}
                aria-pressed={desktopViewMode === 'table'}
                aria-label={`${getModeButtonLabel('table')}${desktopViewMode === 'table' ? ' (đang chọn)' : ''}`}
              >
                {getModeButtonLabel('table')}
              </button>
              <button
                type="button"
                style={desktopViewMode === 'cards' ? desktopViewActiveStyle : desktopViewToggleStyle}
                onClick={() => onDesktopViewModeChange('cards')}
                aria-pressed={desktopViewMode === 'cards'}
                aria-label={`${getModeButtonLabel('cards')}${desktopViewMode === 'cards' ? ' (đang chọn)' : ''}`}
              >
                {getModeButtonLabel('cards')}
              </button>
            </div>
          ) : null}
          <button type="button" onClick={onToggleAdvancedFilters} style={btnOutlineStyle}>
            {showAdvancedFilters ? 'Ẩn bộ lọc nâng cao' : 'Bộ lọc nâng cao'}
            {activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ''}
          </button>
          {hasFilters ? (
            <button type="button" onClick={onClearAllFilters} style={btnOutlineStyle}>
              Xóa bộ lọc
            </button>
          ) : null}
        </div>
      </div>

      {quickCategoryPills.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            style={!categoryFilter ? quickFilterPillActiveStyle : quickFilterPillStyle}
            onClick={() => onCategoryFilterChange('')}
          >
            Tất cả danh mục
          </button>
          {quickCategoryPills.map((category) => (
            <button
              key={category}
              type="button"
              style={categoryFilter === category ? quickFilterPillActiveStyle : quickFilterPillStyle}
              onClick={() => onCategoryFilterChange(category)}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>{resultHint}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <div style={summaryChipStyle}>{resultModeLabel}</div>
          {sortDirection ? (
            <div style={summaryChipStyle}>
              Sắp xếp: {sortLabel} {sortDirection === 'asc' ? '↑' : '↓'}
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
                value={advancedFilters[field.key] || ''}
                onInput={(e: JSX.TargetedEvent<HTMLInputElement, Event>) => onAdvancedFilterChange(field.key, e.currentTarget.value)}
                style={{ ...ui.input.base, width: '100%', padding: '8px 10px', fontSize: '12px', fontWeight: 400 }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type WorkspaceEmptyStatesProps = {
  showFilteredEmpty: boolean;
  hasFilters: boolean;
  showCatalogEmpty: boolean;
  showCatalogError: boolean;
  showCatalogLoading: boolean;
  loadError: string;
  userCanEdit: boolean;
  onClearAllFilters: () => void;
  onOpenImportWizard: () => void;
  onOpenAddModal: () => void;
  onReload: () => void;
  cardStyle: JSX.CSSProperties;
  btnOutlineStyle: JSX.CSSProperties;
  btnPrimaryStyle: JSX.CSSProperties;
  importButtonIcon: JSX.Element;
  addButtonIcon: JSX.Element;
  loaderIcon: JSX.Element;
  importButtonLabel: string;
};

export function ProductWorkspaceEmptyStates({
  showFilteredEmpty,
  hasFilters,
  showCatalogEmpty,
  showCatalogError,
  showCatalogLoading,
  loadError,
  userCanEdit,
  onClearAllFilters,
  onOpenImportWizard,
  onOpenAddModal,
  onReload,
  cardStyle,
  btnOutlineStyle,
  btnPrimaryStyle,
  importButtonIcon,
  addButtonIcon,
  loaderIcon,
  importButtonLabel,
}: WorkspaceEmptyStatesProps) {
  return (
    <>
      {showFilteredEmpty && hasFilters ? (
        <div style={{ ...cardStyle, border: `1px solid ${tokens.colors.border}`, background: tokens.surface.empty, display: 'grid', gap: '10px', justifyItems: 'center', textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>Không có sản phẩm nào khớp bộ lọc hiện tại</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Thử nới điều kiện tìm kiếm hoặc xóa bộ lọc để xem toàn bộ catalog.</div>
          <button type="button" style={btnOutlineStyle} onClick={onClearAllFilters}>Xóa bộ lọc</button>
        </div>
      ) : null}

      {showCatalogEmpty ? (
        <div style={{ ...cardStyle, border: `1px solid ${tokens.colors.border}`, background: tokens.surface.empty, display: 'grid', gap: '10px', justifyItems: 'center', textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>Catalog sản phẩm đang trống</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Bạn có thể import file mẫu hoặc thêm sản phẩm mới để bắt đầu quản lý SKU.</div>
          {userCanEdit ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              <button type="button" style={btnOutlineStyle} onClick={onOpenImportWizard}>
                {importButtonIcon} {importButtonLabel}
              </button>
              <button type="button" style={btnPrimaryStyle} onClick={onOpenAddModal}>
                {addButtonIcon} Thêm mới Sản phẩm
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showCatalogError ? (
        <div style={{ ...cardStyle, border: `1px solid ${tokens.colors.warningBorder}`, background: tokens.colors.warningSurfaceBgSoft, color: tokens.colors.warningSurfaceText, display: 'grid', gap: '10px' }}>
          <div style={{ fontWeight: 700 }}>{loadError}</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>Dữ liệu có thể chưa đồng bộ từ backend hoặc mạng đang gián đoạn tạm thời.</div>
          <div>
            <button type="button" style={btnOutlineStyle} onClick={onReload}>Thử tải lại</button>
          </div>
        </div>
      ) : null}

      {showCatalogLoading ? (
        <div style={{ ...cardStyle, border: `1px solid ${tokens.colors.border}`, padding: '64px 24px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {loaderIcon} Đang tải dữ liệu...
        </div>
      ) : null}
    </>
  );
}
