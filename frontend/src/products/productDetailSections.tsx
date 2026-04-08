import { tokens } from '../ui/tokens';
import { ui } from '../ui/styles';

export type ProductProfileStatus = {
  score: number;
  statusLabel: string;
  statusStyle: any;
  summary: string;
  missing: string[];
  pillars: Array<{ label: string; detail: string; complete: boolean }>;
};

export type ProductTimelineEntry = {
  key: string;
  label: string;
  detail: string;
  at: string;
  tone: string;
};

const PRODUCT_DETAIL_PANEL_BG = tokens.surface.panelGradient;
const PRODUCT_DETAIL_SURFACE_BG = tokens.colors.surfaceSubtle;

export function formatDateTimeLabel(value: string | Date | null | undefined, fallback = 'Chưa có dữ liệu') {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('vi-VN');
}

export function DetailField({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: any;
  accent?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: tokens.colors.textMuted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: accent ? '28px' : '15px',
          fontWeight: accent ? 900 : 700,
          lineHeight: accent ? 1.1 : 1.45,
          color: accent ? tokens.colors.primary : tokens.colors.textPrimary,
          wordBreak: 'break-word',
          textAlign: accent ? 'center' : 'left',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function DetailSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: any;
}) {
  return (
    <section
      style={{
        ...ui.card.base,
        background: PRODUCT_DETAIL_PANEL_BG,
        boxShadow: 'none',
        display: 'grid',
        gap: '16px',
        padding: '20px',
      }}
    >
      <div style={{ display: 'grid', gap: subtitle ? '6px' : 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: tokens.colors.textPrimary,
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: '12px', lineHeight: 1.5, color: tokens.colors.textSecondary }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyAssetState({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        borderRadius: '18px',
        border: `1px dashed ${tokens.colors.border}`,
        background: PRODUCT_DETAIL_PANEL_BG,
        padding: '24px 20px',
        display: 'grid',
        gap: '10px',
        justifyItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '16px',
          display: 'grid',
          placeItems: 'center',
          background: tokens.colors.successTint,
          border: `1px solid ${tokens.colors.border}`,
          color: tokens.colors.primary,
          fontSize: '12px',
          fontWeight: 900,
          letterSpacing: '0.08em',
        }}
      >
        {title.includes('video') ? 'VID' : title.includes('hình') ? 'IMG' : 'DOC'}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</div>
      <div style={{ fontSize: '12px', lineHeight: 1.65, color: tokens.colors.textSecondary, maxWidth: '48ch' }}>{description}</div>
    </div>
  );
}

export function ProductProfileStatusPanel({ status }: { status: ProductProfileStatus }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
      <div
        style={{
          ...ui.card.base,
          background: PRODUCT_DETAIL_SURFACE_BG,
          boxShadow: 'none',
          padding: '18px 16px',
          display: 'grid',
          gap: '8px',
          alignContent: 'center',
          justifyItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.textMuted }}>
          Profile Score
        </div>
        <div style={{ fontSize: '42px', fontWeight: 900, lineHeight: 1, color: tokens.colors.primary }}>{status.score}%</div>
        <span style={status.statusStyle}>{status.statusLabel}</span>
      </div>

      <div
        style={{
          ...ui.card.base,
          background: PRODUCT_DETAIL_SURFACE_BG,
          boxShadow: 'none',
          padding: '18px 18px 16px',
          display: 'grid',
          gap: '14px',
        }}
      >
        <div style={{ fontSize: '13px', lineHeight: 1.65, color: tokens.colors.textSecondary }}>{status.summary}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
          {status.pillars.map((pillar) => (
            <div
              key={pillar.label}
              style={{
                borderRadius: '16px',
                border: `1px solid ${tokens.colors.border}`,
                background: pillar.complete ? tokens.colors.successTint : tokens.colors.warningTint,
                padding: '12px 14px',
                display: 'grid',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: tokens.colors.textPrimary }}>{pillar.label}</span>
                <span style={pillar.complete ? ui.badge.success : ui.badge.warning}>{pillar.complete ? 'OK' : 'Thiếu'}</span>
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.55, color: tokens.colors.textSecondary }}>{pillar.detail}</div>
            </div>
          ))}
        </div>
        {status.missing.length ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {status.missing.slice(0, 4).map((item) => (
              <span key={item} style={ui.badge.warning}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ProductTimeline({ entries }: { entries: ProductTimelineEntry[] }) {
  if (!entries.length) {
    return <EmptyAssetState title="Chưa có mốc cập nhật" description="Khi hồ sơ có thêm ảnh, tài liệu hoặc snapshot QBU, timeline sẽ tự suy luận và hiển thị ở đây." />;
  }

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {entries.map((entry) => (
        <div key={`${entry.key}-${entry.at}`} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>
          <div style={{ display: 'grid', justifyItems: 'center', paddingTop: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                background: entry.tone,
                boxShadow: `0 0 0 4px ${entry.tone}22`,
              }}
            />
          </div>
          <div
            style={{
              borderRadius: '16px',
              border: `1px solid ${tokens.colors.border}`,
              background: PRODUCT_DETAIL_SURFACE_BG,
              padding: '14px 16px',
              display: 'grid',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: tokens.colors.textPrimary }}>{entry.label}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.textMuted }}>{formatDateTimeLabel(entry.at)}</span>
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.6, color: tokens.colors.textSecondary }}>{entry.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
