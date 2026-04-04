import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const ReportsScreen = lazy(async () => {
  const module = await import('../../Reports');
  return { default: module.Reports };
});

export function ReportsRoute({
  isMobile,
  currentUser,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải báo cáo...">
      <ReportsScreen isMobile={isMobile} currentUser={currentUser} />
    </FeatureRouteShell>
  );
}
