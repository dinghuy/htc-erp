import type { ComponentChildren } from 'preact';
import { tokens } from './tokens';
import { ui } from './styles';

type Tone = 'info' | 'warn' | 'bad' | 'good' | 'neutral';

type HeroAction = {
  key: string;
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
};

type BadgeItem = {
  key: string;
  label: string;
  tone?: Tone;
};

type SummaryMetaItem = {
  key: string;
  label: string;
  value: string;
};

type FilterToolbarControl = {
  key: string;
  node: ComponentChildren;
  grow?: boolean;
};

function badgeStyle(tone: Tone = 'neutral') {
  if (tone === 'good') return ui.badge.success;
  if (tone === 'warn') return ui.badge.warning;
  if (tone === 'bad') return ui.badge.error;
  if (tone === 'info') return ui.badge.info;
  return ui.badge.neutral;
}

function buttonStyle(variant: HeroAction['variant'] = 'outline') {
  if (variant === 'primary') return ui.btn.primary;
  if (variant === 'ghost') return ui.btn.ghost;
  return ui.btn.outline;
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: HeroAction[];
  compact?: boolean;
}) {
  return (
    <section
      style={{
        ...ui.card.base,
        padding: compact ? '22px' : '28px',
        background: 'linear-gradient(135deg, rgba(0, 77, 53, 0.12) 0%, rgba(0, 151, 110, 0.05) 52%, rgba(255,255,255,0.92) 100%)',
        display: 'grid',
        gap: '18px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: actions?.length ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
          gap: '18px',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: '10px', minWidth: 0 }}>
          {eyebrow ? (
            <div style={{ display: 'inline-flex', width: 'fit-content', ...ui.badge.info }}>{eyebrow}</div>
          ) : null}
          <div style={{ display: 'grid', gap: '8px' }}>
            <h1 style={{ margin: 0, fontSize: compact ? '26px' : '30px', lineHeight: 1.1, fontWeight: 900, color: tokens.colors.textPrimary }}>{title}</h1>
            <p style={{ margin: 0, maxWidth: '72ch', fontSize: '14px', lineHeight: 1.65, color: tokens.colors.textSecondary }}>{description}</p>
          </div>
        </div>
        {actions?.length ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'flex-start', alignContent: 'flex-start' }}>
            {actions.map((action) => (
              <button key={action.key} type="button" onClick={action.onClick} style={buttonStyle(action.variant) as any}>
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PageSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ComponentChildren;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: '4px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</h2>
        {description ? <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary }}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  accent?: string;
  hint?: string;
}) {
  return (
    <div style={{ ...ui.card.base, padding: '20px', display: 'grid', gap: '10px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '34px', fontWeight: 900, lineHeight: 1, color: accent || tokens.colors.textPrimary }}>{value}</div>
      {hint ? <div style={{ fontSize: '12px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{hint}</div> : null}
    </div>
  );
}

export function ActionCard({
  eyebrow,
  title,
  description,
  tone = 'neutral',
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: Tone;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...ui.card.base,
        padding: '18px',
        display: 'grid',
        gap: '10px',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        background: tokens.colors.surface,
      }}
    >
      <div>
        <span style={badgeStyle(tone)}>{eyebrow}</span>
      </div>
      <div style={{ fontSize: '17px', fontWeight: 800, color: tokens.colors.textPrimary }}>{title}</div>
      <div style={{ fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary }}>{description}</div>
    </button>
  );
}

export function StatusChipRow({ items }: { items: BadgeItem[] }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {items.map((item) => (
        <span key={item.key} style={badgeStyle(item.tone)}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function EntitySummaryCard({
  title,
  subtitle,
  meta,
  statusItems,
  description,
  primaryLabel,
  primaryHint,
  actions,
  footer,
}: {
  title: string;
  subtitle?: string;
  meta?: SummaryMetaItem[];
  statusItems?: BadgeItem[];
  description?: string;
  primaryLabel?: string;
  primaryHint?: string;
  actions?: ComponentChildren;
  footer?: ComponentChildren;
}) {
  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '14px' }}>
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary }}>{title}</div>
            {subtitle ? <div style={{ fontSize: '13px', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{subtitle}</div> : null}
          </div>
          {statusItems?.length ? <StatusChipRow items={statusItems} /> : null}
        </div>
        {description ? <div style={{ fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary }}>{description}</div> : null}
      </div>

      {meta?.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          {meta.map((item) => (
            <div key={item.key} style={{ display: 'grid', gap: '5px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textPrimary }}>{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {primaryLabel || primaryHint ? (
        <div style={{ display: 'grid', gap: '8px', padding: '12px 14px', borderRadius: tokens.radius.lg, background: tokens.colors.background }}>
          {primaryLabel ? <span style={ui.badge.info}>{primaryLabel}</span> : null}
          {primaryHint ? <div style={{ fontSize: '13px', lineHeight: 1.6, color: tokens.colors.textSecondary }}>{primaryHint}</div> : null}
        </div>
      ) : null}

      {footer}
      {actions ? <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  );
}

export function FilterToolbar({
  controls,
  summary,
}: {
  controls: FilterToolbarControl[];
  summary?: ComponentChildren;
}) {
  return (
    <div style={{ ...ui.card.base, padding: '18px', display: 'grid', gap: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '12px', alignItems: 'center' }}>
        {controls.map((control) => (
          <div
            key={control.key}
            style={{
              gridColumn: control.grow ? 'span 4' : 'span 2',
              minWidth: 0,
            }}
          >
            {control.node}
          </div>
        ))}
      </div>
      {summary ? <div style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.textSecondary }}>{summary}</div> : null}
    </div>
  );
}
