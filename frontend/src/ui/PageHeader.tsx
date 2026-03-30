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
    <div style={ui.page.titleRow}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: tokens.colors.textPrimary, margin: 0, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          {title}
        </h2>
        {subtitle ? (
          <p style={{ fontSize: '14px', color: tokens.colors.textSecondary, margin: '6px 0 0' }}>{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div style={ui.page.actions}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
