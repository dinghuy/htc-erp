import { Suspense } from 'preact/compat';
import type { ComponentChildren } from 'preact';
import { PageLoader } from '../../ui/PageLoader';
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
      <Suspense fallback={<PageLoader message={fallbackMessage} />}>
        {children}
      </Suspense>
    </div>
  );
}
