import { useState } from 'preact/hooks';
import { useI18n } from '../i18n';
import { OverlayModal } from '../ui/OverlayModal';
import { tokens } from '../ui/tokens';
import {
  ensureArray,
  hasQbuStaleWarning,
  hasRateIncreaseWarning,
  hasSnapshotMissingWarning,
  quotationStyles,
} from './quotationShared';

const S = quotationStyles;

export function KpiCard({ icon, label, value, sub, color }: any) {
  return (
    <div
      style={{
        ...S.card,
        padding: `${tokens.spacing.lg} ${tokens.spacing.xl}`,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.lg,
        flex: 1,
        minWidth: '180px',
        border: `1px solid ${tokens.colors.border}`,
        boxShadow: tokens.shadow.sm,
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: tokens.radius.lg,
          background: tokens.colors.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          flexShrink: 0,
          border: `1px solid ${tokens.colors.border}`,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: '11px',
            color: tokens.colors.textMuted,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: '24px', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  );
}

export function ProductModal({ productsDB, onSelect, onClose, latestRate, rateMissing, catalogError }: any) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('');
  const safeProducts = ensureArray(productsDB);
  const filtered = safeProducts.filter(
    (product: any) =>
      product.name?.toLowerCase().includes(filter.toLowerCase()) ||
      product.sku?.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <OverlayModal
      title={t('sales.quotations.modal.select_product')}
      onClose={onClose}
      maxWidth="520px"
      contentPadding="0"
    >
      <div style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px' }}>
          <input
            type="text"
            placeholder={t('sales.quotations.modal.search_product')}
            style={S.input}
            value={filter}
            onInput={(event: any) => setFilter(event.target.value)}
          />
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
          {filtered.map((product: any) => (
            <div
              key={product.id}
              onClick={() => onSelect(product)}
              style={{
                padding: '14px 12px',
                borderBottom: `1px solid ${tokens.colors.border}`,
                cursor: 'pointer',
                borderRadius: tokens.radius.md,
                transition: '0.15s',
              }}
              onMouseEnter={(event) => ((event.currentTarget as any).style.background = tokens.colors.background)}
              onMouseLeave={(event) => ((event.currentTarget as any).style.background = '')}
            >
              <div style={{ fontWeight: 800, color: tokens.colors.textPrimary }}>
                <span style={{ color: tokens.colors.primary, marginRight: '8px' }}>{product.sku}</span>
                {product.name}
              </div>
              <div style={{ fontSize: '12px', color: tokens.colors.textMuted, marginTop: '4px' }}>
                {product.category} {product.unit ? `· ${product.unit}` : ''}{' '}
                {product.basePrice ? `· $${product.basePrice?.toLocaleString()}` : ''}
              </div>
              {(hasRateIncreaseWarning(latestRate ?? null, product.qbuRateValue) ||
                hasQbuStaleWarning(product.qbuUpdatedAt) ||
                hasSnapshotMissingWarning(product.qbuUpdatedAt, product.qbuRateValue, product.qbuRateDate)) && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {hasRateIncreaseWarning(latestRate ?? null, product.qbuRateValue) && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: tokens.colors.error,
                        border: `1px solid ${tokens.colors.border}`,
                        background: tokens.colors.surface,
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
                      FX +2.5%
                    </span>
                  )}
                  {hasQbuStaleWarning(product.qbuUpdatedAt) && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: tokens.colors.warning,
                        border: `1px solid ${tokens.colors.border}`,
                        background: tokens.colors.surface,
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
                      QBU 6M
                    </span>
                  )}
                  {hasSnapshotMissingWarning(product.qbuUpdatedAt, product.qbuRateValue, product.qbuRateDate) && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: tokens.colors.textMuted,
                        border: `1px solid ${tokens.colors.border}`,
                        background: tokens.colors.surface,
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
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

export function FormField({ label, children, span }: any) {
  return (
    <div style={{ gridColumn: span === 2 ? '1/-1' : undefined }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}
