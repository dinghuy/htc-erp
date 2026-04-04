import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const SalesOrdersScreen = lazy(async () => {
  const module = await import('../../SalesOrders');
  return { default: module.SalesOrders };
});

export function SalesOrdersRoute({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  return (
    <FeatureRouteShell fallbackMessage="Đang tải đơn ERP...">
      <SalesOrdersScreen isMobile={isMobile} currentUser={currentUser} onNavigate={onNavigate} />
    </FeatureRouteShell>
  );
}
