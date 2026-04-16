import { Suspense } from 'preact/compat';
import type { ComponentChildren } from 'preact';
import { tokens } from '../../ui/tokens';
import { ui } from '../../ui/styles';

export function FeatureRouteShell({
  children,
  fallbackMessage = 'Đang tải module...',
  maxWidth,
}: {
  children: ComponentChildren;
  fallbackMessage?: string;
  maxWidth?: string;
}) {
  return (
    <div style={{ ...ui.page.shell, padding: 0, ...(maxWidth ? { maxWidth } : {}) }}>
      <Suspense
        fallback={
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: tokens.colors.textSecondary,
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {fallbackMessage}
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}
