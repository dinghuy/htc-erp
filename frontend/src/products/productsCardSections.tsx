import type { JSX } from 'preact';
import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';
import { EyeIcon, EditIcon, TrashIcon } from '../ui/icons';
import { resolveAssetUrl, type ProductImageAsset } from './productAssetUi';

export type ProductCardActionHandlers<TProduct> = {
  onView: (product: TProduct) => void;
  onEdit: (product: TProduct) => void;
  onDelete: (id: string) => void;
};

export type ProductCardActionsProps<TProduct extends { id: string; name?: string; sku?: string }> = {
  product: TProduct;
  handlers: ProductCardActionHandlers<TProduct>;
  userCanEdit: boolean;
  userCanDelete: boolean;
  viewButtonStyle: JSX.CSSProperties;
  editButtonStyle?: JSX.CSSProperties;
  deleteButtonStyle: JSX.CSSProperties;
  hideDeleteDivider?: boolean;
};

export function ProductCardActions<TProduct extends { id: string; name?: string; sku?: string }>({
  product,
  handlers,
  userCanEdit,
  userCanDelete,
  viewButtonStyle,
  editButtonStyle,
  deleteButtonStyle,
  hideDeleteDivider,
}: ProductCardActionsProps<TProduct>) {
  return (
    <>
      <button
        aria-label={`Xem chi tiết ${product.name || product.sku || 'sản phẩm'}`}
        title="Xem chi tiết"
        onClick={() => handlers.onView(product)}
        style={viewButtonStyle}
      >
        <EyeIcon size={14} />
      </button>
      {userCanEdit ? (
        <button
          aria-label={`Chỉnh sửa ${product.name || product.sku || 'sản phẩm'}`}
          title="Chỉnh sửa"
          onClick={() => handlers.onEdit(product)}
          style={editButtonStyle || viewButtonStyle}
        >
          <EditIcon size={14} />
        </button>
      ) : null}
      {userCanDelete ? (
        hideDeleteDivider ? (
          <button
            aria-label={`Xóa ${product.name || product.sku || 'sản phẩm'}`}
            title="Xóa"
            onClick={() => handlers.onDelete(String(product.id))}
            style={deleteButtonStyle}
          >
            <TrashIcon size={14} />
          </button>
        ) : (
          <div style={{ marginLeft: '8px', paddingLeft: '8px', borderLeft: `1px solid ${tokens.colors.border}` }}>
            <button
              aria-label={`Xóa ${product.name || product.sku || 'sản phẩm'}`}
              title="Xóa"
              onClick={() => handlers.onDelete(String(product.id))}
              style={deleteButtonStyle}
            >
              Xóa
            </button>
          </div>
        )
      ) : null}
    </>
  );
}

export type ProductIdentityProps = {
  name?: string;
  sku?: string;
  unit?: string;
  category?: string;
  primaryImage: ProductImageAsset | null;
  summaryChipStyle: JSX.CSSProperties;
  apiOrigin: string;
};

export function getProductSecondaryLabel(unit?: string, category?: string) {
  if (unit) return `Đơn vị: ${unit}`;
  if (category) return `Nhóm: ${category}`;
  return 'Chưa có metadata phụ';
}

export function ProductIdentity({ name, sku, unit, category, primaryImage, summaryChipStyle, apiOrigin }: ProductIdentityProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {primaryImage ? (
        <img
          src={resolveAssetUrl(apiOrigin, primaryImage.url)}
          alt={primaryImage.alt || name}
          style={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            objectFit: 'cover',
            border: `1px solid ${tokens.colors.border}`,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            background: tokens.colors.background,
            border: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.colors.textMuted,
            fontWeight: 800,
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          {(name || sku || '?')[0]?.toUpperCase()}
        </div>
      )}
      <div style={{ minWidth: 0, display: 'grid', gap: '4px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: tokens.colors.textPrimary }}>{name}</div>
        <div style={summaryChipStyle}>{getProductSecondaryLabel(unit, category)}</div>
      </div>
    </div>
  );
}

export const productCardGridStyle: JSX.CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
  alignItems: 'stretch',
};

export const productMobileCardsStyle: JSX.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
};

export const productDesktopCardStyle: JSX.CSSProperties = {
  ...ui.card.base,
  border: `1px solid ${tokens.colors.border}`,
  padding: '14px',
  display: 'grid',
  gap: '10px',
  background: tokens.surface.heroGradientSubtle,
};
