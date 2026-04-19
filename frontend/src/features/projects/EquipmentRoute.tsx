import { lazy } from 'preact/compat';
import type { CurrentUser } from '../../auth';
import { FeatureRouteShell } from '../shared/FeatureRouteShell';

const EquipmentScreen = lazy(async () => {
  const module = await import('../../Products');
  return { default: module.Products };
});

export function EquipmentRoute({
  isMobile,
  currentUser,
  onNavigate,
}: {
  isMobile?: boolean;
  currentUser: CurrentUser;
  onNavigate?: (route: string) => void;
}) {
  void onNavigate;
  return (
    <FeatureRouteShell fallbackMessage="Đang tải danh mục sản phẩm...">
      <EquipmentScreen isMobile={isMobile} currentUser={currentUser} />
    </FeatureRouteShell>
  );
}
