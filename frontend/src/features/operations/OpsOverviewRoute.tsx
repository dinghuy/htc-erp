import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const OperationsOverviewScreen = lazy(async () => {
  const module = await import('../../ops/OperationsOverview');
  return { default: module.OperationsOverview };
});

export function OpsOverviewRoute({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải tổng quan vận hành...">
      <OperationsOverviewScreen isMobile={isMobile} currentUser={currentUser} onNavigate={onNavigate} />
    </FeatureRouteShell>
  );
}
