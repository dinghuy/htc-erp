import type { JSX } from 'preact';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { getPrimaryImage } from './productAssetData';
import { resolveAssetUrl } from './productAssetUi';
import {
  ProductCardActions,
  getProductSecondaryLabel,
  productCardGridStyle,
  productDesktopCardStyle,
  productMobileCardsStyle,
} from './productsCardSections';
import { getProductQbuWarnings, QbuBadgeRow } from './ProductDetailModal';
import type {
  ProductListItemWithHealth,
  ProductWorkspaceSortKey,
  ProductWorkspaceColumn,
} from './productsWorkspaceData';

type ProductActionHandlers = {
  onView: (product: ProductListItemWithHealth) => void;
  onEdit: (product: ProductListItemWithHealth) => void;
  onDelete: (id: string) => void;
};

type ProductCardSectionProps = {
  isMobile: boolean;
  items: ProductListItemWithHealth[];
  latestRate: number | null;
  userCanEdit: boolean;
  userCanDelete: boolean;
  handlers: ProductActionHandlers;
  renderProductIdentity: (product: ProductListItemWithHealth) => JSX.Element;
  viewButtonStyle: JSX.CSSProperties;
  deleteButtonStyle: JSX.CSSProperties;
  summaryChipStyle: JSX.CSSProperties;
  apiOrigin: string;
};

export function ProductCardsSection({
  isMobile,
  items,
  latestRate,
  userCanEdit,
  userCanDelete,
  handlers,
  renderProductIdentity,
  viewButtonStyle,
  deleteButtonStyle,
  summaryChipStyle,
  apiOrigin,
}: ProductCardSectionProps) {
  const desktopCards = items.map((product) => ({
    product,
    primaryImage: getPrimaryImage(product.productImages || []),
    warnings: getProductQbuWarnings(product, latestRate),
  }));

  if (isMobile) {
    return (
      <div style={productMobileCardsStyle}>
        {items.map((product) => (
          <div key={String(product.id)} style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, padding: tokens.spacing.lg }}>
            {renderProductIdentity(product)}
            <QbuBadgeRow warnings={getProductQbuWarnings(product, latestRate)} />
            <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Danh mục:</strong> {product.category || '-'}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Giá:</strong> ${Number(product.basePrice || 0).toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Completeness:</strong> {product._completenessScore}%</div>
              <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Thiếu gì:</strong> {product._missingSummary}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', marginTop: '12px', borderTop: `1px solid ${tokens.colors.border}` }}>
              <ProductCardActions
                product={product}
                handlers={handlers}
                userCanEdit={userCanEdit}
                userCanDelete={userCanDelete}
                viewButtonStyle={viewButtonStyle}
                deleteButtonStyle={deleteButtonStyle}
                hideDeleteDivider
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={productCardGridStyle}>
      {desktopCards.map(({ product, primaryImage, warnings }) => (
        <div key={String(product.id)} style={productDesktopCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {primaryImage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={resolveAssetUrl(apiOrigin, primaryImage.url)}
                    alt={primaryImage.alt || product.name}
                    style={{ width: 44, height: 44, borderRadius: '10px', objectFit: 'cover', border: `1px solid ${tokens.colors.border}` }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>{product.name}</div>
                    <div style={summaryChipStyle}>{getProductSecondaryLabel(product.unit, product.category)}</div>
                  </div>
                </div>
              ) : (
                renderProductIdentity(product)
              )}
            </div>
            <div style={{ ...summaryChipStyle, maxWidth: '130px', justifyContent: 'center' }}>{product.category || 'Chưa phân loại'}</div>
          </div>
          <QbuBadgeRow warnings={warnings} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            <div style={{ ...summaryChipStyle, justifyContent: 'space-between' }}>
              <span style={{ color: tokens.colors.textMuted }}>Giá</span>
              <strong style={{ color: tokens.colors.textPrimary }}>${Number(product.basePrice || 0).toLocaleString()}</strong>
            </div>
            <div style={{ ...summaryChipStyle, justifyContent: 'space-between' }}>
              <span style={{ color: tokens.colors.textMuted }}>Completeness</span>
              <strong style={{ color: tokens.colors.textPrimary }}>{product._completenessScore}%</strong>
            </div>
          </div>
          <div style={{ ...summaryChipStyle, whiteSpace: 'normal', lineHeight: 1.4 }}>Thiếu: {product._missingSummary}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <ProductCardActions
              product={product}
              handlers={handlers}
              userCanEdit={userCanEdit}
              userCanDelete={userCanDelete}
              viewButtonStyle={viewButtonStyle}
              deleteButtonStyle={deleteButtonStyle}
              hideDeleteDivider
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type ProductTableSectionProps = {
  items: ProductListItemWithHealth[];
  columns: ProductWorkspaceColumn[];
  requestSort: (key: ProductWorkspaceSortKey) => void;
  getSortLabel: (key: ProductWorkspaceSortKey) => string;
  getSortIcon: (key: ProductWorkspaceSortKey) => string;
  columnAriaSort: (key: ProductWorkspaceSortKey) => 'none' | 'ascending' | 'descending';
  handlers: ProductActionHandlers;
  userCanEdit: boolean;
  userCanDelete: boolean;
  tableSurfaceStyle: JSX.CSSProperties;
  tableHeaderButtonStyle: JSX.CSSProperties;
  tableInfoButtonStyle: JSX.CSSProperties;
  tableEditButtonStyle: JSX.CSSProperties;
  tableDeleteButtonStyle: JSX.CSSProperties;
  renderProductIdentity: (product: ProductListItemWithHealth) => JSX.Element;
  visibleCount: number;
  S: {
    thSortable: JSX.CSSProperties;
    thStatic: JSX.CSSProperties;
    td: JSX.CSSProperties;
  };
};

export function ProductTableSection({
  items,
  columns,
  requestSort,
  getSortLabel,
  getSortIcon,
  columnAriaSort,
  handlers,
  userCanEdit,
  userCanDelete,
  tableSurfaceStyle,
  tableHeaderButtonStyle,
  tableInfoButtonStyle,
  tableEditButtonStyle,
  tableDeleteButtonStyle,
  renderProductIdentity,
  visibleCount,
  S,
}: ProductTableSectionProps) {
  return (
    <div style={tableSurfaceStyle} role="region" aria-label={`Bảng sản phẩm có ${visibleCount} hàng`}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: tokens.colors.background }}>
            {columns.map((c) => (
              <th key={c.k} style={S.thSortable} aria-sort={columnAriaSort(c.k)}>
                <button
                  type="button"
                  onClick={() => requestSort(c.k)}
                  style={tableHeaderButtonStyle}
                  aria-label={`Sắp xếp theo ${c.l}. ${getSortLabel(c.k)}`}
                >
                  <span>{c.l}</span>
                  <span aria-hidden="true">{getSortIcon(c.k)}</span>
                </button>
              </th>
            ))}
            <th style={{ ...S.thStatic, cursor: 'default', textAlign: 'right' }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((product) => (
            <tr
              key={String(product.id)}
              style={{ ...ui.table.row }}
              onMouseEnter={(e: JSX.TargetedMouseEvent<HTMLTableRowElement>) => {
                e.currentTarget.style.background = tokens.colors.background;
              }}
              onMouseLeave={(e: JSX.TargetedMouseEvent<HTMLTableRowElement>) => {
                e.currentTarget.style.background = '';
              }}
            >
              <td style={{ ...S.td, fontWeight: 700, color: tokens.colors.textPrimary, verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{renderProductIdentity(product)}</div>
              </td>
              <td style={S.td}>
                <span style={{ background: tokens.colors.background, padding: '3px 10px', borderRadius: '6px', border: `1px solid ${tokens.colors.border}`, fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted }}>{product.category || '-'}</span>
              </td>
              <td style={{ ...S.td, fontWeight: 800, color: tokens.colors.textPrimary }}>${Number(product.basePrice || 0).toLocaleString()}</td>
              <td style={S.td}>
                <span style={{ ...(product._completenessScore >= 80 ? ui.badge.success : product._completenessScore >= 60 ? ui.badge.info : ui.badge.warning), border: `1px solid ${tokens.colors.border}` }}>
                  {product._completenessScore}%
                </span>
              </td>
              <td style={{ ...S.td, fontSize: '12px', color: tokens.colors.textSecondary }}>{product._missingSummary}</td>
              <td style={S.td}>
                {product._qbuWarningCount > 0 ? (
                  <span style={{ ...ui.badge.warning, border: `1px solid ${tokens.colors.border}` }}>{product._qbuWarningSummary}</span>
                ) : (
                  <span style={{ ...ui.badge.success, border: `1px solid ${tokens.colors.border}` }}>Ổn định</span>
                )}
              </td>
              <td style={{ ...S.td, textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <ProductCardActions
                    product={product}
                    handlers={handlers}
                    userCanEdit={userCanEdit}
                    userCanDelete={userCanDelete}
                    viewButtonStyle={tableInfoButtonStyle}
                    editButtonStyle={tableEditButtonStyle}
                    deleteButtonStyle={tableDeleteButtonStyle}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ProductInsightsAsideProps = {
  sidePanelStyle: JSX.CSSProperties;
  summaryChipStyle: JSX.CSSProperties;
  selectedCategoryLabel: string;
  completenessSummary: {
    averageScore: number;
    warningCount: number;
  };
  topIssueProduct: ProductListItemWithHealth | null;
  topProblemProducts: ProductListItemWithHealth[];
  openDetailProduct: (product: ProductListItemWithHealth) => void;
  btnOutlineStyle: JSX.CSSProperties;
};

export function ProductInsightsAside({
  sidePanelStyle,
  summaryChipStyle,
  selectedCategoryLabel,
  completenessSummary,
  topIssueProduct,
  topProblemProducts,
  openDetailProduct,
  btnOutlineStyle,
}: ProductInsightsAsideProps) {
  return (
    <aside style={sidePanelStyle} aria-label="Insight completeness và rủi ro sản phẩm">
      <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Góc nhanh</div>
      <div style={{ ...summaryChipStyle, justifyContent: 'space-between' }}>
        <span style={{ color: tokens.colors.textMuted }}>Danh mục đang chọn</span>
        <strong style={{ color: tokens.colors.textPrimary }}>{selectedCategoryLabel}</strong>
      </div>
      <div style={{ ...summaryChipStyle, justifyContent: 'space-between' }}>
        <span style={{ color: tokens.colors.textMuted }}>Completeness trung bình</span>
        <strong style={{ color: tokens.colors.textPrimary }}>{completenessSummary.averageScore}%</strong>
      </div>
      <div style={{ ...summaryChipStyle, justifyContent: 'space-between' }}>
        <span style={{ color: tokens.colors.textMuted }}>Cảnh báo QBU</span>
        <strong style={{ color: tokens.colors.textPrimary }}>{completenessSummary.warningCount}</strong>
      </div>
      {topIssueProduct ? (
        <div style={{ ...ui.card.base, border: `1px solid ${tokens.colors.border}`, background: tokens.surface.heroGradientSubtle, display: 'grid', gap: '10px', padding: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>Top issue</div>
          <div style={{ ...summaryChipStyle, justifyContent: 'space-between', width: '100%', fontWeight: 700 }}>
            <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topIssueProduct.name || topIssueProduct.sku || 'N/A'}</span>
            <span>{topIssueProduct._completenessScore}%</span>
          </div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>Thiếu gì:</strong> {topIssueProduct._missingSummary}</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textSecondary }}><strong>QBU warning:</strong> {topIssueProduct._qbuWarningCount > 0 ? topIssueProduct._qbuWarningSummary : 'Ổn định'}</div>
          <button type="button" style={{ ...btnOutlineStyle, width: '100%', justifyContent: 'center' }} onClick={() => openDetailProduct(topIssueProduct)}>Xem chi tiết top issue</button>
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textPrimary }}>Top 5 sản phẩm cần ưu tiên</div>
        <div style={{ fontSize: '11px', color: tokens.colors.textSecondary }}>Xếp hạng theo completeness thấp + rủi ro QBU</div>
        {topProblemProducts.map((item, index) => (
          <button
            key={String(item.id)}
            type="button"
            onClick={() => openDetailProduct(item)}
            style={{
              ...ui.btn.outline,
              justifyContent: 'space-between',
              width: '100%',
              padding: '8px 10px',
              fontSize: '12px',
            }}
          >
            <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {item.name || item.sku}</span>
            <strong>{item._completenessScore}%</strong>
          </button>
        ))}
      </div>
    </aside>
  );
}
