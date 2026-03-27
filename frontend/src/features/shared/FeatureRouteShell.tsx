import { Suspense } from 'preact/compat';
import type { ComponentChildren } from 'preact';
import { tokens } from '../../ui/tokens';

export function FeatureRouteShell({
  children,
  fallbackMessage = 'Dang tai module...',
  maxWidth = '1400px',
}: {
  children: ComponentChildren;
  fallbackMessage?: string;
  maxWidth?: string;
}) {
  return (
    <div style={{ padding: 0, maxWidth, margin: '0 auto' }}>
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
