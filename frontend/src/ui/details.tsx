import { type ComponentChildren } from 'preact';
import { OverlayPortal, getOverlayContainerStyle, overlayStyles } from './overlay';
import { tokens } from './tokens';

type DetailModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions?: ComponentChildren;
  children: ComponentChildren;
  width?: string;
};

export function DetailModal({ open, title, subtitle, onClose, actions, children, width = 'min(920px, calc(100vw - 24px))' }: DetailModalProps) {
  if (!open) return null;

  return (
    <OverlayPortal>
      <div
        style={getOverlayContainerStyle('detail', {
          padding: '12px',
        })}
        onClick={onClose}
      >
        <div aria-hidden="true" style={overlayStyles.backdrop} />
        <div
          style={{
            ...overlayStyles.surface,
            width,
            maxHeight: 'calc(100vh - 24px)',
            display: 'flex',
            flexDirection: 'column',
            background: tokens.colors.surface,
          }}
          onClick={(event) => event.stopPropagation()}
        >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${tokens.colors.border}`,
            background: tokens.colors.background,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: tokens.colors.textPrimary, lineHeight: 1.2 }}>{title}</div>
            {subtitle ? <div style={{ marginTop: '6px', fontSize: '13px', lineHeight: 1.5, color: tokens.colors.textSecondary }}>{subtitle}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.surface,
                color: tokens.colors.textSecondary,
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 800,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto' }}>{children}</div>
      </div>
      </div>
    </OverlayPortal>
  );
}

export function DetailSection({ title, children, tone = 'default' }: { title: string; children: ComponentChildren; tone?: 'default' | 'soft' }) {
  return (
    <section
      style={{
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.lg,
        background: tone === 'soft' ? tokens.colors.background : tokens.colors.surface,
        padding: '16px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.colors.textMuted, marginBottom: '12px' }}>
        {title}
      </div>
      {children}
    </section>
  );
}

export function DetailGrid({ children }: { children: ComponentChildren }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
      {children}
    </div>
  );
}

export function DetailField({ label, value, wide = false }: { label: string; value: ComponentChildren; wide?: boolean }) {
  return (
    <div
      style={{
        minWidth: 0,
        gridColumn: wide ? '1 / -1' : undefined,
        padding: '12px 14px',
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.colors.surface,
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.colors.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', lineHeight: 1.55, color: tokens.colors.textPrimary, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
