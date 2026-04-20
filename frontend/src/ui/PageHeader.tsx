import type { ComponentChildren } from 'preact';
import { tokens } from './tokens';
import { ui } from './styles';

type PageHeaderProps = {
  title: ComponentChildren;
  subtitle?: string;
  icon?: ComponentChildren;
  actions?: ComponentChildren;
};

/**
 * Standard page-level header: icon + title + subtitle on the left,
 * action buttons on the right. Wraps gracefully on narrow viewports.
 */
export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <section
      style={{
        ...ui.card.base,
        background: tokens.surface.heroGradientSubtle,
        padding: tokens.spacing.xl,
        display: 'grid',
        gap: tokens.spacing.lg,
      }}
    >
      <div style={ui.page.titleRow}>
        <div style={{ minWidth: 0, display: 'grid', gap: tokens.spacing.sm }}>
          <div style={{ display: 'inline-flex', width: 'fit-content', ...ui.badge.info }}>
            Điều hướng tác nghiệp
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 900, color: tokens.colors.textPrimary, margin: 0, display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            {icon}
            {title}
          </h2>
          {subtitle ? (
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: tokens.colors.textSecondary, margin: 0 }}>{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div style={{ ...ui.page.actions, alignItems: 'flex-start' }}>
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
